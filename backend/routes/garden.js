// backend/routes/garden.js
const express = require("express");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;

const router = express.Router();
const db = admin.firestore();
const { createPlantReminders } = require('./autoReminders');

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

    // Auto-create reminders
    try {
      await createPlantReminders(uid, docRef.id, {
        commonName: gardenPlant.commonName,
        scientificName: gardenPlant.scientificName,
        careEffective: {
          wateringEveryDays: typeof gardenPlant.wateringFrequency === 'number' 
            ? gardenPlant.wateringFrequency 
            : 7
        }
      });
    } catch (reminderErr) {
      console.error('Failed to create reminders:', reminderErr.message);
    }

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

//Add a note
//PATCH is /api/garden/:uid/plantsId/notes  body: { text }
router.patch("/:uid/plants/:plantId/notes", async (req, res) => {
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

    await ref.update({ notes });

    return res.json({ ok: true, notes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// NOTES: Edit a note by index
// PUT /api/garden/:uid/plants/:plantId/notes/:index  body: { text }
router.put("/:uid/plants/:plantId/notes/:index", async (req, res) => {
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

    if (i >= notes.length) return res.status(404).json({ error: "Note index out of range" });

    // support string notes too, just in case
    const existing = notes[i];
    const createdAt =
      typeof existing === "object" && existing?.createdAt ? existing.createdAt : new Date().toISOString();

    notes[i] = {
      text: clean,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    await ref.update({ notes });

    return res.json({ ok: true, notes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// NOTES: Delete a note by index
// DELETE /api/garden/:uid/plants/:plantId/notes/:index
router.delete("/:uid/plants/:plantId/notes/:index", async (req, res) => {
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

    if (i >= notes.length) return res.status(404).json({ error: "Note index out of range" });

    notes.splice(i, 1);

    await ref.update({ notes });

    return res.json({ ok: true, notes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
// DELETE a plant from My Garden
// DELETE /api/garden/:uid/plants/:plantId
router.delete("/:uid/plants/:plantId", async (req, res) => {
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

module.exports = router;