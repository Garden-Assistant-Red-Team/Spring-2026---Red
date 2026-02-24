const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

const db = admin.firestore();

function zoneToNumber(zoneStr) {
  if (!zoneStr) return null;
  const z = zoneStr.toLowerCase().trim();
  const match = z.match(/^(\d+)([ab])?$/);
  if (!match) return null;

  const base = Number(match[1]);
  const letter = match[2];
  return letter === "b" ? base + 0.5 : base; // "8b" => 8.5, "8a" => 8.0
}

router.get('/', async (req, res) => {
  try {
    const { uid, sun } = req.query;

    if (!uid) {
      return res.status(400).json({ error: "Missing uid query param. Use /api/recommendations?uid=..." });
    }

    // 1) Load user and zone
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userDoc.data();
    const userZone = user.gardenZone || user.zone || null; 
    const userZoneNum = zoneToNumber(userZone);

    if (userZoneNum === null) {
      return res.status(400).json({ error: "User gardenZone missing or invalid" });
    }

    // 2) Load plant catalog
    const snap = await db.collection("plantCatalog").get();
    const allPlants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // 3) Filter by zone (+ optional sun)
    let filtered = allPlants.filter((p) => {
      if (typeof p.minZone !== "number" || typeof p.maxZone !== "number") return false;
      return p.minZone <= userZoneNum && userZoneNum <= p.maxZone;
    });

    if (sun) {
      filtered = filtered.filter((p) => {
        if (!p.sunlight) return true; 
        return String(p.sunlight).toLowerCase().includes(String(sun).toLowerCase());
      });
    }

    const recommendations = filtered.slice(0, 20).map((p) => ({
  id: p.id,
  commonName: p.commonName || null,
  scientificName: p.scientificName || null,
  trefle_id: p.trefle_id || null,
  sunlight: p.sunlight || null,
  wateringFrequency: p.wateringFrequency || null,
  minZone: p.minZone,
  maxZone: p.maxZone,
  reason: `Matches your garden zone (${userZone}).`,
}));

    return res.json({
      zone: userZone,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
