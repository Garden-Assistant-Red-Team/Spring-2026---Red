const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");

const db = admin.firestore();

const { requireAdmin } = require("../middleware/requireAdmin");




// GET all plants
router.get("/plants", requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("plantCatalog").get();

    const plants = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(plants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET one plant
router.get("/plants/:id", requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection("plantCatalog").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Plant not found" });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE plant
router.patch("/plants/:id", requireAdmin, async (req, res) => {
  try {
    const updates = req.body;

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("plantCatalog").doc(req.params.id).update(updates);

    res.json({ message: "Plant updated", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ARCHIVE plant
router.patch("/plants/:id/archive", requireAdmin, async (req, res) => {
  try {
    await db.collection("plantCatalog").doc(req.params.id).update({
      archived: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ message: "Plant archived" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// GET staging plants
router.get("/staging/plants", requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("plantCatalog_staging").get();

    const plants = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(plants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE staging plant
router.patch("/staging/plants/:id", requireAdmin, async (req, res) => {
  try {
    const updates = req.body;

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("plantCatalog_staging").doc(req.params.id).update(updates);

    res.json({ message: "Staging plant updated", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;