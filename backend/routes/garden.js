// backend/routes/garden.js
const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();
const db = admin.firestore();

/**
 * POST /api/garden/:uid/plants
 * Accepts plants from recommendations or photo-id.
 */
router.post("/:uid/plants", async (req, res) => {
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
      reason
    } = req.body;

    const finalName = name || scientificName || commonName;
    if (!finalName) {
      return res.status(400).json({ error: "Missing plant name (name/scientificName/commonName)." });
    }

    const gardenPlantsRef = db.collection("users").doc(uid).collection("gardenPlants");

    // Duplicate check (if plantId or trefle_id provided)
    if (plantId || typeof trefle_id === "number") {
      let query = gardenPlantsRef.limit(1);

      if (plantId) query = gardenPlantsRef.where("plantId", "==", plantId).limit(1);
      else query = gardenPlantsRef.where("trefle_id", "==", trefle_id).limit(1);

      const existing = await query.get();
      if (!existing.empty) {
        return res.status(200).json({ message: "Already in garden" });
      }
    }

    const gardenPlant = {
      name: finalName,
      commonName: commonName || null,
      scientificName: scientificName || null,
      confidence: typeof confidence === "number" ? confidence : null,
      photoUrl: photoUrl || null,
      source: source || "manual",
      plantId: plantId || null,
      trefle_id: typeof trefle_id === "number" ? trefle_id : null,
      minZone: typeof minZone === "number" ? minZone : null,
      maxZone: typeof maxZone === "number" ? maxZone : null,
      sunlight: sunlight || null,
      wateringFrequency: wateringFrequency || null,
      reason: reason || null,
      createdAt: new Date().toISOString(),
    };

    const docRef = await gardenPlantsRef.add(gardenPlant);

    return res.status(201).json({ message: "Added to garden", id: docRef.id, plant: gardenPlant });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/:uid/plants", async (req, res) => {
  try {
    const { uid } = req.params;
    const snap = await db.collection("users").doc(uid).collection("gardenPlants").get();
    const plants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json(plants);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;