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
    // For v1, prefer clean seeded records only
    const snap = await db
      .collection("plantCatalog")
      .where("dataSource", "==", "seed")
      .get();

    let plants = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

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
    const bestSuited = scoredPlants.slice(0, 10).map(serializePlant);

    const nativePlants = scoredPlants
      .filter((plant) => nativeToState(plant, userContext.stateCode))
      .slice(0, 10)
      .map(serializePlant);

    const zoneMatches = scoredPlants
      .filter((plant) => matchesZone(userContext.gardenZone, plant))
      .slice(0, 10)
      .map(serializePlant);

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