// backend/routes/checklist.js
const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;

const db = admin.firestore();

// GET /api/checklist/:uid  -> get all checklist items for user
router.get("/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;

    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("checklist")
      .orderBy("createdAt", "desc")
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(items);
  } catch (e) {
    console.error("GET checklist error:", e);
    res.status(500).json({ error: e.message || "Failed to load checklist" });
  }
});

// POST /api/checklist/:uid -> create item
router.post("/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const { text, dueDate = null, plantInstanceId = null, done = false } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Checklist item text is required." });
    }

    // dueDate should be null or "YYYY-MM-DD"
    if (dueDate !== null && typeof dueDate !== "string") {
      return res.status(400).json({ error: "dueDate must be a string (YYYY-MM-DD) or null." });
    }

    const docRef = await db
      .collection("users")
      .doc(uid)
      .collection("checklist")
      .add({
        text: text.trim(),
        done: Boolean(done),
        dueDate,
        plantInstanceId: plantInstanceId || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    const created = await docRef.get();
    res.status(201).json({ id: docRef.id, ...created.data() });
  } catch (e) {
    console.error("POST checklist error:", e);
    res.status(500).json({ error: e.message || "Failed to create checklist item" });
  }
});

// PATCH /api/checklist/:uid/:itemId -> update done, text, dueDate, plantInstanceId
router.patch("/:uid/:itemId", async (req, res) => {
  try {
    const { uid, itemId } = req.params;
    const { done, text, dueDate, plantInstanceId } = req.body || {};

    const update = { updatedAt: FieldValue.serverTimestamp() };

    if (typeof done !== "undefined") update.done = Boolean(done);
    if (typeof text !== "undefined") update.text = String(text).trim();
    if (typeof dueDate !== "undefined") update.dueDate = dueDate; // allow null or YYYY-MM-DD
    if (typeof plantInstanceId !== "undefined") update.plantInstanceId = plantInstanceId || null;

    await db
      .collection("users")
      .doc(uid)
      .collection("checklist")
      .doc(itemId)
      .update(update);

    const updated = await db
      .collection("users")
      .doc(uid)
      .collection("checklist")
      .doc(itemId)
      .get();

    res.json({ id: itemId, ...updated.data() });
  } catch (e) {
    console.error("PATCH checklist error:", e);
    res.status(500).json({ error: e.message || "Failed to update checklist item" });
  }
});

// DELETE /api/checklist/:uid/:itemId -> delete item
router.delete("/:uid/:itemId", async (req, res) => {
  try {
    const { uid, itemId } = req.params;

    await db
      .collection("users")
      .doc(uid)
      .collection("checklist")
      .doc(itemId)
      .delete();

    res.json({ message: "Checklist item deleted." });
  } catch (e) {
    console.error("DELETE checklist error:", e);
    res.status(500).json({ error: e.message || "Failed to delete checklist item" });
  }
});

module.exports = router;