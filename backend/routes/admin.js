const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");

const db = admin.firestore();

const { requireAdmin } = require("../middleware/requireAdmin");

// GET plants with pagination, search, filtering, sorting
router.get("/plants", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1");
    const pageSize = parseInt(req.query.pageSize || "20");
    const q = (req.query.q || "").toLowerCase();
    const includeArchived = req.query.includeArchived === "true";
    const sortBy = req.query.sortBy || "commonName";

    const snap = await db.collection("plantCatalog").get();

    let plants = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (!includeArchived) {
      plants = plants.filter((p) => !p.archived);
    }

    if (q) {
      plants = plants.filter(
        (p) =>
          (p.commonName || "").toLowerCase().includes(q) ||
          (p.scientificName || "").toLowerCase().includes(q)
      );
    }

    plants.sort((a, b) => {
      const aVal = (a[sortBy] || "").toString().toLowerCase();
      const bVal = (b[sortBy] || "").toString().toLowerCase();
      return aVal.localeCompare(bVal);
    });

    const total = plants.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paged = plants.slice(start, start + pageSize);

    res.json({
      items: paged,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single plant
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

// UPDATE plant with validation & audit
router.patch("/plants/:id", requireAdmin, async (req, res) => {
  try {
    const allowedFields = [
      "commonName",
      "scientificName",
      "wateringEveryDays",
      "sunlight",
      "minZone",
      "maxZone",
      "imageUrl",
    ];

    const updates = {};

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields provided" });
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = req.user.uid;

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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    });

    res.json({ message: "Plant archived" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BULK update plants
router.patch("/plants/bulk", requireAdmin, async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array required" });
    }

    const batch = db.batch();

    ids.forEach((id) => {
      const ref = db.collection("plantCatalog").doc(id);
      batch.update(ref, {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.user.uid,
      });
    });

    await batch.commit();

    res.json({ message: "Bulk update successful", count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stats on plants (total, archived, active)
router.get("/plants/stats", requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("plantCatalog").get();

    const total = snap.size;
    let archived = 0;

    snap.docs.forEach((doc) => {
      if (doc.data().archived) archived++;
    });

    res.json({
      total,
      active: total - archived,
      archived,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET staging plants
router.get("/staging/plants", requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("plantCatalog_staging").get();

    const plants = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
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
    updates.updatedBy = req.user.uid;

    await db.collection("plantCatalog_staging").doc(req.params.id).update(updates);

    res.json({ message: "Staging plant updated", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PROMOTE staging to main catalog
router.post("/staging/plants/:id/promote", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    const doc = await db.collection("plantCatalog_staging").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Staging plant not found" });
    }

    const data = doc.data();

    await db.collection("plantCatalog").doc(id).set({
      ...data,
      promotedAt: admin.firestore.FieldValue.serverTimestamp(),
      promotedBy: req.user.uid,
    });

    await db.collection("plantCatalog_staging").doc(id).delete();

    res.json({ message: "Plant promoted to main catalog" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;