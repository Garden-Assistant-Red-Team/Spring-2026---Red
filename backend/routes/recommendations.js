/* 
This file provides plant recommendations based on the user's garden zone and optional sunlight preferences.
If the user doesn't have a zone saved yet, we try to figure it out from their ZIP code
and then save it back to Firestore so next time it's faster.
*/

// External dependencies
const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

const db = admin.firestore();

/*
   This function converts a zone string like "8a" or "8b" to a number (8.0 or 8.5) for easier comparison.
   * Returns null if the input is invalid.
   */
function zoneToNumber(zoneStr) {
  if (!zoneStr) return null;

  const z = String(zoneStr).toLowerCase().trim();
  const match = z.match(/^(\d+)([ab])?$/);
  if (!match) return null;

  const base = Number(match[1]);
  const letter = match[2];
  return letter === "b" ? base + 0.5 : base;
}

/* This function takes a ZIP code input and normalizes it to the first 5 digits.
    * Returns null if the input is missing or doesn't contain at least 5 digits.  
  */
function normalizeZip(zip) {
  if (!zip) return null;
  const digits = String(zip).replace(/[^\d]/g, "");
  if (digits.length < 5) return null;
  return digits.slice(0, 5);
}

/* This function looks up the garden zone for a given 5-digit ZIP code using the phzmapi.org API.
   * Returns the zone string (e.g. "8a") if successful.
   * Throws an error if the lookup fails or returns invalid data.
  */
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

// Main route: GET /api/recommendations?uid=...&sun=...
router.get("/", async (req, res) => {
  try {
    const { uid, sun } = req.query;
    if (!uid) return res.status(400).json({ error: "Missing uid" });

    // 1) Load user
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "User not found" });

    const user = userSnap.data() || {};

    // 2) Get zone (or auto-detect from ZIP)
    let zone = user.gardenZone || user.zone || null;
    let zoneNum = zoneToNumber(zone);

    // If they don't have a zone saved, try to create it from their ZIP code and save it back to Firestore for next time
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

      // Save back to Firestore for next time so we don't have to do the lookup again
      await userRef.set(
        {
          gardenZone: zone,
          zoneSource: "zip",
          zoneUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // 3) Load the plant catalog
    const snap = await db.collection("plantCatalog").get();
    const allPlants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 4) Filter by zone 
    let matches = allPlants.filter((p) => {
      if (typeof p.minZone !== "number" || typeof p.maxZone !== "number") return false;
      return p.minZone <= zoneNum && zoneNum <= p.maxZone;
    });

    // 5) Return top 10 matches with a reason field explaining why they were recommended
    const recommendations = matches.slice(0, 10).map((p) => ({
      id: p.id,
      commonName: p.commonName || null,
      scientificName: p.scientificName || null,
      trefle_id: p.trefle_id ?? null,
      sunlight: p.sunlight || null,
      wateringFrequency: p.wateringFrequency || null,
      minZone: p.minZone,
      maxZone: p.maxZone,
      reason: `Matches your zone (${zone}).`,
    }));

    return res.json({
      zone,
      count: recommendations.length,
      recommendations,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
