/*
This file provides plant recommendations based on the user's garden zone,
sunlight, watering preferences, and optional filter tags.

If the user doesn't have a zone saved yet, we try to figure it out from their ZIP code
and save it back to Firestore so next time it's faster.
*/

const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

const {
  scorePlant,
  matchesZone,
  nativeToState,
} = require("../utils/recommendationScoring");

const db = admin.firestore();

function zoneToNumber(zoneStr) {
  if (!zoneStr) return null;

  const z = String(zoneStr).toLowerCase().trim();
  const match = z.match(/^(\d+)([ab])?$/);
  if (!match) return null;

  const base = Number(match[1]);
  const letter = match[2];
  return letter === "b" ? base + 0.5 : base;
}

function normalizeZip(zip) {
  if (!zip) return null;
  const digits = String(zip).replace(/[^\d]/g, "");
  if (digits.length < 5) return null;
  return digits.slice(0, 5);
}

async function getZoneFromZip(zip5) {
  const url = `https://phzmapi.org/${zip5}.json`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`Zone lookup failed (${res.status})`);

  const data = await res.json();
  const zone = data?.zone ? String(data.zone).trim() : null;

  if (!zone || zoneToNumber(zone) === null) {
    throw new Error("Zone lookup returned something invalid");
  }

  return zone;
}

async function getStateFromZip(zip5) {
  const url = `https://api.zippopotam.us/us/${zip5}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`State lookup failed (${res.status})`);
  }

  const data = await res.json();
  const place = Array.isArray(data?.places) ? data.places[0] : null;
  const stateCode = place?.["state abbreviation"]
    ? String(place["state abbreviation"]).trim().toUpperCase()
    : null;

  if (!stateCode) {
    throw new Error("State lookup returned something invalid");
  }

  return stateCode;
}

function parseBoolean(value) {
  return String(value).toLowerCase() === "true";
}

function buildFilters(query) {
  return {
    flower: parseBoolean(query.flower),
    tree: parseBoolean(query.tree),
    shrub: parseBoolean(query.shrub),
    edible: parseBoolean(query.edible),
    pollinatorFriendly: parseBoolean(query.pollinatorFriendly),
    nativeOnly: parseBoolean(query.nativeOnly),
  };
}

function applyFilters(plants, user, filters) {
  return plants.filter((plant) => {
    if (filters.flower && !plant.flower) return false;
    if (filters.tree && !plant.tree) return false;
    if (filters.shrub && !plant.shrub) return false;
    if (filters.edible && !plant.edible) return false;
    if (filters.pollinatorFriendly && !plant.pollinatorFriendly) return false;
    if (filters.nativeOnly && !nativeToState(plant, user.stateCode)) return false;

    return true;
  });
}

function serializePlant(plant) {
  return {
    id: plant.id,
    canonicalKey: plant.canonicalKey || null,
    commonName: plant.commonName || null,
    scientificName: plant.scientificName || null,
    imageUrl: plant.imageUrl || null,
    family: plant.family || null,
    flower: !!plant.flower,
    tree: !!plant.tree,
    shrub: !!plant.shrub,
    herb: !!plant.herb,
    edible: !!plant.edible,
    pollinatorFriendly: !!plant.pollinatorFriendly,
    nativeStates: Array.isArray(plant.nativeStates) ? plant.nativeStates : [],
    minZone: plant.minZone ?? null,
    maxZone: plant.maxZone ?? null,
    sunlight: Array.isArray(plant.sunlight) ? plant.sunlight : [],
    wateringProfile: plant.wateringProfile || null,
    wateringEveryDays: plant.wateringEveryDays ?? null,
    duration: plant.duration || null,
    sources: plant.sources || {},
    recommendation: plant.recommendation || null,
  };
}

// GET /api/recommendations?uid=...&flower=true&pollinatorFriendly=true
router.get("/", async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ error: "Missing uid" });
    }

    const filters = buildFilters(req.query);

    // 1) Load user
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userSnap.data() || {};

    // 2) Get zone (or auto-detect from ZIP)
    let zone = user.gardenZone || user.zone || null;
    let zoneNum = zoneToNumber(zone);

    if (zoneNum === null) {
      const zip5 = normalizeZip(user.zipCode || user.zip);

      if (!zip5) {
        return res.status(400).json({
          error: "No gardenZone saved and zipCode is missing/invalid",
          needsZip: true,
        });
      }

      zone = await getZoneFromZip(zip5);
      zoneNum = zoneToNumber(zone);

      await userRef.set(
        {
          gardenZone: zone,
          zoneSource: "zip",
          zoneUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // 3) Build normalized user context for scoring
    let stateCode = user.stateCode || null;

    if (!stateCode) {
      const zip5 = normalizeZip(user.zipCode || user.zip);
      if (zip5) {
        try {
          stateCode = await getStateFromZip(zip5);

          await userRef.set(
            {
              stateCode,
              stateSource: "zip",
              stateUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch (err) {
          console.warn("State lookup failed:", err.message);
        }
      }
    }

    const userContext = {
      stateCode,
      gardenZone: zone,
      sunlight: user.sunlight || null,
      wateringPreference: user.wateringPreference || null,
    };

    // 4) Load plant catalog
    // Load all docs, then keep only recommendation-safe ones in code
    const snap = await db.collection("plantCatalog").get();

    let plants = snap.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((plant) => {
        // Must have basic usable structure
        if (!plant.commonName || !plant.scientificName) return false;
        if (typeof plant.minZone !== "number" || typeof plant.maxZone !== "number") return false;
        if (!Array.isArray(plant.sunlight) || plant.sunlight.length === 0) return false;

        // Optional future flag if you add it later
        if (plant.recommendationEligible === false) return false;

        return true;
      });

    console.log("recommendations: total catalog docs =", snap.size);
    console.log("recommendations: usable docs after filter =", plants.length);
    console.log(
      "recommendations: sample plants =",
      plants.slice(0, 10).map((p) => ({
        id: p.id,
        scientificName: p.scientificName,
        commonName: p.commonName,
        dataSource: p.dataSource || null,
      }))
    );

    // 5) Apply optional filters
    plants = applyFilters(plants, userContext, filters);

    // 6) Score plants
    const scoredPlants = plants
      .map((plant) => {
        const recommendation = scorePlant(plant, userContext, filters);
        return {
          ...plant,
          recommendation,
        };
      })
      .sort((a, b) => b.recommendation.score - a.recommendation.score);

    // 7) Build sections
    function getPrimaryType(plant) {
      if (plant.tree) return "tree";
      if (plant.shrub) return "shrub";
      if (plant.herb) return "herb";
      if (plant.flower) return "flower";
      if (plant.edible) return "edible";
      return "other";
    }

    function pickDiversePlants(plants, limit = 10, excludedIds = new Set()) {
      const picked = [];
      const usedIds = new Set(excludedIds);
      const typeCounts = {};

      // first pass: try to balance types
      for (const plant of plants) {
        if (picked.length >= limit) break;
        if (usedIds.has(plant.id)) continue;

        const type = getPrimaryType(plant);
        const count = typeCounts[type] || 0;

        // soft cap: don't let one type dominate too early
        if (count >= 3 && picked.length < limit - 2) continue;

        picked.push(plant);
        usedIds.add(plant.id);
        typeCounts[type] = count + 1;
      }

      // second pass: fill remaining slots if needed
      if (picked.length < limit) {
        for (const plant of plants) {
          if (picked.length >= limit) break;
          if (usedIds.has(plant.id)) continue;

          picked.push(plant);
          usedIds.add(plant.id);

          const type = getPrimaryType(plant);
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
      }

      return picked;
    }

    // 7) Build sections with some diversity
    const bestSuitedBase = scoredPlants;
    const nativePlantsBase = scoredPlants.filter((plant) =>
      nativeToState(plant, userContext.stateCode)
    );
    const zoneMatchesBase = scoredPlants.filter((plant) =>
      matchesZone(userContext.gardenZone, plant)
    );

    const bestSuitedPicked = pickDiversePlants(bestSuitedBase, 10);
    const bestSuitedIds = new Set(bestSuitedPicked.map((p) => p.id));

    const nativePlantsPicked = pickDiversePlants(nativePlantsBase, 10, bestSuitedIds);
    const nativePlantsIds = new Set(nativePlantsPicked.map((p) => p.id));

    const zoneMatchesPicked = pickDiversePlants(
      zoneMatchesBase,
      10,
      new Set([...bestSuitedIds, ...nativePlantsIds])
    );

    const bestSuited = bestSuitedPicked.map(serializePlant);
    const nativePlants = nativePlantsPicked.map(serializePlant);
    const zoneMatches = zoneMatchesPicked.map(serializePlant);

    return res.json({
      userContext: {
        stateCode: userContext.stateCode,
        gardenZone: userContext.gardenZone,
        sunlight: userContext.sunlight,
        wateringPreference: userContext.wateringPreference,
      },
      filters,
      sections: {
        bestSuited,
        nativePlants,
        zoneMatches,
      },
    });
  } catch (err) {
    console.error("recommendations route error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;