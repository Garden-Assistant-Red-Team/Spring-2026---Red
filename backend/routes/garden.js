// backend/routes/garden.js
const express = require("express");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const db = admin.firestore();
const { createPlantReminders } = require("./autoReminders");

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

function getToken() {
  const t = process.env.TREFLE_TOKEN;
  return t || null;
}

async function trefleGET(pathOrUrl) {
  const token = getToken();
  if (!token) throw new Error("Missing TREFLE_TOKEN");

  const base = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `https://trefle.io${pathOrUrl}`;

  const url = new URL(base);
  url.searchParams.set("token", token);

  const r = await fetch(url.toString());
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Trefle error ${r.status}${txt ? `: ${txt}` : ""}`);
  }

  return r.json();
}

async function speciesSearch(q) {
  return trefleGET(`/api/v1/species/search?q=${encodeURIComponent(q)}`);
}

async function plantSearch(q) {
  return trefleGET(`/api/v1/plants/search?q=${encodeURIComponent(q)}`);
}

async function fetchDetails(item) {
  if (item?.links?.self) {
    const d = await trefleGET(item.links.self);
    return d?.data ?? null;
  }

  if (typeof item?.id === "number") {
    try {
      const d = await trefleGET(`/api/v1/species/${item.id}`);
      return d?.data ?? null;
    } catch {
      const d = await trefleGET(`/api/v1/plants/${item.id}`);
      return d?.data ?? null;
    }
  }

  return null;
}

function sunlightCategory(light) {
  const sunlightSet = [];
  if (typeof light !== "number") return [];
  if (light <= 3) sunlightSet.push("shade");
  if (light <= 6) sunlightSet.push("part_sun");
  if (6 < light) sunlightSet.push("full_sun");
  return sunlightSet;
}

function wateringFromSoilHumidity(h) {
  if (typeof h !== "number") return null;
  if (h <= 3) return { profile: "low", days: 7 };
  if (h <= 6) return { profile: "moderate", days: 4 };
  return { profile: "high", days: 2 };
}

function minZoneFromMinTempF(minF) {
  if (typeof minF !== "number") return null;
  if (minF <= -30) return 4;
  if (minF <= -20) return 5;
  if (minF <= -10) return 6;
  if (minF <= 0) return 7;
  if (minF <= 10) return 8;
  if (minF <= 20) return 9;
  if (minF <= 30) return 10;
  return 11;
}

function deriveDifficulty({ wateringEveryDays, sunlight, maxZone, minZone }) {
  const sunCount = Array.isArray(sunlight) ? sunlight.length : 0;
  const water = typeof wateringEveryDays === "number" ? wateringEveryDays : null;

  if (water !== null && water >= 10 && sunCount <= 2) return "Easy";
  if (water !== null && water >= 5) return "Moderate";
  if (typeof maxZone === "number" && typeof minZone === "number" && maxZone - minZone >= 4) {
    return "Easy";
  }
  return "Moderate";
}

function buildFallbackCareFields(base = {}) {
  const sunlight = Array.isArray(base.sunlight) ? base.sunlight : [];
  const wateringEveryDays =
    typeof base.wateringEveryDays === "number"
      ? base.wateringEveryDays
      : typeof base.wateringFrequency === "number"
        ? base.wateringFrequency
        : 7;

  const hasShade = sunlight.includes("shade");
  const hasPartSun = sunlight.includes("part_sun");
  const hasFullSun = sunlight.includes("full_sun");

  return {
    difficulty:
      base.difficulty ||
      deriveDifficulty({
        wateringEveryDays,
        sunlight,
        maxZone: base.maxZone,
        minZone: base.minZone,
      }),
    fertilizeEveryDays:
      typeof base.fertilizeEveryDays === "number" ? base.fertilizeEveryDays : 30,
    pruneEveryDays:
      typeof base.pruneEveryDays === "number" ? base.pruneEveryDays : 90,
    repotEveryDays:
      typeof base.repotEveryDays === "number" ? base.repotEveryDays : 365,
    potType:
      base.potType ||
      (base.tree
        ? "Large container with drainage"
        : "Pot with drainage"),
    soilType:
      base.soilType ||
      (base.edible
        ? "Rich well-draining soil"
        : "Well-draining potting mix"),
    lighting:
      base.lighting ||
      (hasFullSun && hasPartSun
        ? "Full sun to partial shade"
        : hasFullSun
          ? "Full sun"
          : hasPartSun
            ? "Partial sun"
            : hasShade
              ? "Shade to low light"
              : "Bright indirect light"),
    humidity: base.humidity || "Medium",
    hibernation:
      base.hibernation ||
      (typeof base.minZone === "number" && base.minZone <= 7 ? "Yes" : "No"),
    temperatureMin:
      typeof base.temperatureMin === "number"
        ? base.temperatureMin
        : typeof base.temperatureF?.min === "number"
          ? base.temperatureF.min
          : 60,
    temperatureMax:
      typeof base.temperatureMax === "number"
        ? base.temperatureMax
        : typeof base.temperatureF?.max === "number"
          ? base.temperatureF.max
          : 85,
  };
}

async function lookupCatalogPlant({ plantId, trefle_id, scientificName, commonName }) {
  const candidates = [];

  if (plantId) {
    candidates.push(
      db.collection("plantCatalog").doc(String(plantId)).get(),
      db.collection("plantCatalog_staging").doc(String(plantId)).get()
    );
  }

  if (typeof trefle_id === "number") {
    const trefleDocId = `trefle_${trefle_id}`;
    candidates.push(
      db.collection("plantCatalog").doc(trefleDocId).get(),
      db.collection("plantCatalog_staging").doc(trefleDocId).get()
    );
  }

  const directSnaps = await Promise.allSettled(candidates);
  for (const result of directSnaps) {
    if (result.status === "fulfilled" && result.value.exists) {
      return { id: result.value.id, ...result.value.data() };
    }
  }

  const searchNames = [scientificName, commonName].filter(Boolean);
  if (!searchNames.length) return null;

  const snap = await db.collection("plantCatalog").get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  for (const name of searchNames) {
    const match = docs.find((doc) => {
      return (
        norm(doc.scientificName) === norm(name) ||
        norm(doc.commonName) === norm(name) ||
        norm(doc.canonicalKey) === norm(name).replaceAll(" ", "_")
      );
    });
    if (match) return match;
  }

  return null;
}

async function fetchPlantInfoFromApi({ scientificName, commonName }) {
  const query = scientificName || commonName;
  if (!query || !getToken()) return null;

  let resp = await speciesSearch(query);
  let items = resp?.data || [];

  if (!items.length) {
    resp = await plantSearch(query);
    items = resp?.data || [];
  }

  if (!items.length) return null;

  const bestItem = items[0];
  const details = await fetchDetails(bestItem);
  const growth = details?.growth || null;
  const specs = details?.specifications || null;

  const wateringDerived = wateringFromSoilHumidity(growth?.soil_humidity ?? null);
  const wateringEveryDays = wateringDerived?.days ?? null;

  return {
    plantId: bestItem?.id ? `trefle_${bestItem.id}` : null,
    trefle_id: typeof bestItem?.id === "number" ? bestItem.id : null,
    commonName: bestItem?.common_name || commonName || null,
    scientificName: bestItem?.scientific_name || scientificName || null,
    imageUrl: bestItem?.image_url || null,
    family: details?.family?.name ?? details?.family ?? null,
    edible: details?.edible ?? null,
    sunlight: sunlightCategory(growth?.light ?? null),
    wateringProfile: wateringDerived?.profile ?? null,
    wateringEveryDays,
    wateringFrequency: wateringEveryDays,
    minZone: minZoneFromMinTempF(growth?.minimum_temperature?.deg_f ?? null),
    temperatureF: {
      min: growth?.minimum_temperature?.deg_f ?? null,
      max: growth?.maximum_temperature?.deg_f ?? null,
    },
    soilHumidity: growth?.soil_humidity ?? null,
    rawApiDetails: {
      growth,
      specifications: specs,
    },
  };
}

function mergePreferInput(input, catalogPlant, apiPlant) {
  return {
    ...(catalogPlant || {}),
    ...(apiPlant || {}),
    ...(input || {}),
  };
}

function buildAutoEnrichedPlant(input, catalogPlant, apiPlant) {
  const merged = mergePreferInput(input, catalogPlant, apiPlant);

  const base = {
    ...merged,
    sunlight: Array.isArray(merged.sunlight) ? merged.sunlight : [],
    wateringEveryDays:
      typeof merged.wateringEveryDays === "number"
        ? merged.wateringEveryDays
        : typeof merged.wateringFrequency === "number"
          ? merged.wateringFrequency
          : null,
    wateringFrequency:
      typeof merged.wateringFrequency === "number"
        ? merged.wateringFrequency
        : typeof merged.wateringEveryDays === "number"
          ? merged.wateringEveryDays
          : null,
    temperatureMin:
      typeof merged.temperatureMin === "number"
        ? merged.temperatureMin
        : typeof merged.temperatureF?.min === "number"
          ? merged.temperatureF.min
          : null,
    temperatureMax:
      typeof merged.temperatureMax === "number"
        ? merged.temperatureMax
        : typeof merged.temperatureF?.max === "number"
          ? merged.temperatureF.max
          : null,
  };

  return {
    ...base,
    ...buildFallbackCareFields(base),
  };
}

/**
 * POST /api/garden/:uid/plants
 * Accepts plants from recommendations or photo-id.
 */
router.post("/:uid/plants", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid } = req.params;

    const {
      name,
      commonName,
      scientificName,
      confidence,
      photoUrl,
      source,
      plantId,
      trefle_id,
      minZone,
      maxZone,
      sunlight,
      wateringFrequency,
      wateringProfile,
      wateringEveryDays,
      duration,
      imageUrl,
      difficulty,
      fertilizeEveryDays,
      pruneEveryDays,
      repotEveryDays,
      potType,
      soilType,
      lighting,
      humidity,
      hibernation,
      temperatureMin,
      temperatureMax,
      reason,
      locationType,
    } = req.body;

    const finalName = name || scientificName || commonName;
    if (!finalName) {
      return res
        .status(400)
        .json({ error: "Missing plant name (name/scientificName/commonName)." });
    }

    const finalLocationType = locationType || "outdoor";

    if (!["indoor", "outdoor"].includes(finalLocationType)) {
      return res
        .status(400)
        .json({ error: "locationType must be indoor or outdoor" });
    }

    const gardenPlantsRef = db.collection("users").doc(uid).collection("gardenPlants");

    // Duplicate check (if plantId or trefle_id provided)
    if (plantId || typeof trefle_id === "number") {
      let query = gardenPlantsRef.limit(1);

      if (plantId) {
        query = gardenPlantsRef.where("plantId", "==", plantId).limit(1);
      } else {
        query = gardenPlantsRef.where("trefle_id", "==", trefle_id).limit(1);
      }

      const existing = await query.get();
      if (!existing.empty) {
        return res.status(200).json({ message: "Already in garden" });
      }
    }

    const incomingPlant = {
      name: finalName,
      commonName: commonName || null,
      scientificName: scientificName || null,
      confidence: typeof confidence === "number" ? confidence : null,
      photoUrl: photoUrl || null,
      imageUrl: imageUrl || null,
      source: source || "manual",
      plantId: plantId || null,
      trefle_id: typeof trefle_id === "number" ? trefle_id : null,
      minZone: typeof minZone === "number" ? minZone : null,
      maxZone: typeof maxZone === "number" ? maxZone : null,
      sunlight: sunlight || null,
      wateringFrequency:
        typeof wateringFrequency === "number"
          ? wateringFrequency
          : typeof wateringEveryDays === "number"
            ? wateringEveryDays
            : null,
      wateringProfile: wateringProfile || null,
      wateringEveryDays:
        typeof wateringEveryDays === "number" ? wateringEveryDays : null,
      duration: duration || null,

      difficulty: difficulty || null,
      fertilizeEveryDays:
        typeof fertilizeEveryDays === "number" ? fertilizeEveryDays : null,
      pruneEveryDays:
        typeof pruneEveryDays === "number" ? pruneEveryDays : null,
      repotEveryDays:
        typeof repotEveryDays === "number" ? repotEveryDays : null,

      potType: potType || null,
      soilType: soilType || null,
      lighting: lighting || null,
      humidity: humidity || null,
      hibernation: hibernation || null,
      temperatureMin:
        typeof temperatureMin === "number" ? temperatureMin : null,
      temperatureMax:
        typeof temperatureMax === "number" ? temperatureMax : null,

      reason: reason || null,
      locationType: finalLocationType,
    };

    let catalogPlant = null;
    try {
      catalogPlant = await lookupCatalogPlant({
        plantId: incomingPlant.plantId,
        trefle_id: incomingPlant.trefle_id,
        scientificName: incomingPlant.scientificName,
        commonName: incomingPlant.commonName,
      });
    } catch (lookupErr) {
      console.warn("Catalog lookup failed:", lookupErr.message);
    }

    let apiPlant = null;
    const needsApiFill =
      !incomingPlant.difficulty ||
      !incomingPlant.potType ||
      !incomingPlant.soilType ||
      !incomingPlant.lighting ||
      !incomingPlant.humidity ||
      !incomingPlant.hibernation ||
      typeof incomingPlant.temperatureMin !== "number" ||
      typeof incomingPlant.temperatureMax !== "number";

    if (needsApiFill) {
      try {
        apiPlant = await fetchPlantInfoFromApi({
          scientificName: incomingPlant.scientificName,
          commonName: incomingPlant.commonName,
        });
      } catch (apiErr) {
        console.warn("Plant API enrichment failed:", apiErr.message);
      }
    }

    const enrichedPlant = buildAutoEnrichedPlant(incomingPlant, catalogPlant, apiPlant);

    const gardenPlant = {
      name: enrichedPlant.name,
      commonName: enrichedPlant.commonName || null,
      scientificName: enrichedPlant.scientificName || null,
      confidence: typeof enrichedPlant.confidence === "number" ? enrichedPlant.confidence : null,
      photoUrl: enrichedPlant.photoUrl || null,
      imageUrl: enrichedPlant.imageUrl || null,
      source: enrichedPlant.source || "manual",
      plantId: enrichedPlant.plantId || null,
      trefle_id: typeof enrichedPlant.trefle_id === "number" ? enrichedPlant.trefle_id : null,
      minZone: typeof enrichedPlant.minZone === "number" ? enrichedPlant.minZone : null,
      maxZone: typeof enrichedPlant.maxZone === "number" ? enrichedPlant.maxZone : null,
      sunlight: Array.isArray(enrichedPlant.sunlight) ? enrichedPlant.sunlight : null,
      wateringFrequency:
        typeof enrichedPlant.wateringFrequency === "number"
          ? enrichedPlant.wateringFrequency
          : typeof enrichedPlant.wateringEveryDays === "number"
            ? enrichedPlant.wateringEveryDays
            : null,
      wateringProfile: enrichedPlant.wateringProfile || null,
      wateringEveryDays:
        typeof enrichedPlant.wateringEveryDays === "number" ? enrichedPlant.wateringEveryDays : null,
      duration: enrichedPlant.duration || null,

      difficulty: enrichedPlant.difficulty || null,
      fertilizeEveryDays:
        typeof enrichedPlant.fertilizeEveryDays === "number" ? enrichedPlant.fertilizeEveryDays : null,
      pruneEveryDays:
        typeof enrichedPlant.pruneEveryDays === "number" ? enrichedPlant.pruneEveryDays : null,
      repotEveryDays:
        typeof enrichedPlant.repotEveryDays === "number" ? enrichedPlant.repotEveryDays : null,

      potType: enrichedPlant.potType || null,
      soilType: enrichedPlant.soilType || null,
      lighting: enrichedPlant.lighting || null,
      humidity: enrichedPlant.humidity || null,
      hibernation: enrichedPlant.hibernation || null,
      temperatureMin:
        typeof enrichedPlant.temperatureMin === "number" ? enrichedPlant.temperatureMin : null,
      temperatureMax:
        typeof enrichedPlant.temperatureMax === "number" ? enrichedPlant.temperatureMax : null,

      reason: enrichedPlant.reason || null,
      locationType: enrichedPlant.locationType || finalLocationType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await gardenPlantsRef.add(gardenPlant);

    // Auto-create reminders
    try {
      await createPlantReminders(uid, docRef.id, {
        commonName: gardenPlant.commonName,
        scientificName: gardenPlant.scientificName,
        careEffective: {
          wateringEveryDays:
            typeof gardenPlant.wateringFrequency === "number"
              ? gardenPlant.wateringFrequency
              : 7,
        },
      });
    } catch (reminderErr) {
      console.error("Failed to create reminders:", reminderErr.message);
    }

    return res.status(201).json({
      message: "Added to garden",
      id: docRef.id,
      plant: gardenPlant,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/:uid/plants", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid } = req.params;
    const snap = await db.collection("users").doc(uid).collection("gardenPlants").get();
    const plants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json(plants);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Add a note
// PATCH /api/garden/:uid/plants/:plantId/notes  body: { text }
router.patch("/:uid/plants/:plantId/notes", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid, plantId } = req.params;
    const { text } = req.body;

    const clean = String(text || "").trim();
    if (!clean) return res.status(400).json({ error: "text is required" });

    const ref = db.collection("users").doc(uid).collection("gardenPlants").doc(plantId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Plant not found" });

    const plant = snap.data();
    const notes = Array.isArray(plant.notes) ? plant.notes : [];

    notes.push({
      text: clean,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ref.update({
      notes,
      updatedAt: new Date().toISOString(),
    });

    return res.json({ ok: true, notes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Edit a note by index
// PUT /api/garden/:uid/plants/:plantId/notes/:index  body: { text }
router.put("/:uid/plants/:plantId/notes/:index", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid, plantId, index } = req.params;
    const { text } = req.body;

    const i = Number(index);
    if (!Number.isInteger(i) || i < 0) {
      return res.status(400).json({ error: "index must be a non-negative integer" });
    }

    const clean = String(text || "").trim();
    if (!clean) return res.status(400).json({ error: "text is required" });

    const ref = db.collection("users").doc(uid).collection("gardenPlants").doc(plantId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Plant not found" });

    const plant = snap.data();
    const notes = Array.isArray(plant.notes) ? plant.notes : [];

    if (i >= notes.length) {
      return res.status(404).json({ error: "Note index out of range" });
    }

    const existing = notes[i];
    const createdAt =
      typeof existing === "object" && existing?.createdAt
        ? existing.createdAt
        : new Date().toISOString();

    notes[i] = {
      text: clean,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    await ref.update({
      notes,
      updatedAt: new Date().toISOString(),
    });

    return res.json({ ok: true, notes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete a note by index
// DELETE /api/garden/:uid/plants/:plantId/notes/:index
router.delete("/:uid/plants/:plantId/notes/:index", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid, plantId, index } = req.params;

    const i = Number(index);
    if (!Number.isInteger(i) || i < 0) {
      return res.status(400).json({ error: "index must be a non-negative integer" });
    }

    const ref = db.collection("users").doc(uid).collection("gardenPlants").doc(plantId);
    const snap = await ref.get();

    if (!snap.exists) return res.status(404).json({ error: "Plant not found" });

    const plant = snap.data();
    const notes = Array.isArray(plant.notes) ? plant.notes : [];

    if (i >= notes.length) {
      return res.status(404).json({ error: "Note index out of range" });
    }

    notes.splice(i, 1);

    await ref.update({
      notes,
      updatedAt: new Date().toISOString(),
    });

    return res.json({ ok: true, notes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE a plant from My Garden
// DELETE /api/garden/:uid/plants/:plantId
router.delete("/:uid/plants/:plantId", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid, plantId } = req.params;

    const ref = db.collection("users").doc(uid).collection("gardenPlants").doc(plantId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Plant not found" });
    }

    await ref.delete();

    return res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete plant:", err);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/garden/:uid/plants/:plantId/placement
router.patch("/:uid/plants/:plantId/placement", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid, plantId } = req.params;
    const { placement, startDate } = req.body;

    if (!placement) {
      return res.status(400).json({ error: "placement is required" });
    }

    const ref = db.collection("users").doc(uid).collection("gardenPlants").doc(plantId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Plant not found" });
    }

    await ref.update({
      "layout.placement": placement,
      "layout.startDate": startDate || new Date().toISOString(),
      "layout.updatedAt": new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      message: "Plant placement saved",
      plantId,
      placement,
      startDate: startDate || new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/garden/:uid/plants/:plantId
// update locationType or other editable fields
router.patch("/:uid/plants/:plantId", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid, plantId } = req.params;
    const allowed = ["locationType", "nickname", "notes", "status"];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    if (
      updates.locationType &&
      !["indoor", "outdoor"].includes(updates.locationType)
    ) {
      return res
        .status(400)
        .json({ error: "locationType must be indoor or outdoor" });
    }

    updates.updatedAt = new Date().toISOString();

    const ref = db.collection("users").doc(uid).collection("gardenPlants").doc(plantId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Plant not found" });
    }

    await ref.update(updates);

    return res.json({ message: "Plant updated", plantId, updates });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/garden/:uid/layout
router.get("/:uid/layout", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid } = req.params;
    const snap = await db.collection("users").doc(uid).collection("gardenPlants").get();

    const layout = snap.docs
      .filter((doc) => doc.data().layout?.placement)
      .map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        commonName: doc.data().commonName,
        locationType: doc.data().locationType || "outdoor",
        placement: doc.data().layout?.placement,
        startDate: doc.data().layout?.startDate,
        updatedAt: doc.data().layout?.updatedAt,
        sunlight: doc.data().sunlight,
        wateringFrequency: doc.data().wateringFrequency,
      }));

    return res.json({ count: layout.length, layout });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/garden/:uid/plants/:plantId/placement
router.delete("/:uid/plants/:plantId/placement", requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { uid, plantId } = req.params;
    const ref = db.collection("users").doc(uid).collection("gardenPlants").doc(plantId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Plant not found" });
    }

    await ref.update({
      layout: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });

    return res.json({ message: "Plant placement removed", plantId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;