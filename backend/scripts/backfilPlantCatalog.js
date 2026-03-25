const admin = require("firebase-admin");
const serviceAccount = require("../config/serviceAccountKey.json");
const {
  canonicalKeyFromScientificName,
  normalizeSunlight,
} = require("../utils/plantCatalogHelpers");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function wateringProfileFromDays(days) {
  if (typeof days !== "number") return null;
  if (days >= 6) return "low";
  if (days >= 3) return "moderate";
  return "high";
}

function sunlightArrayFromDoc(data) {
  if (Array.isArray(data.sunlight)) {
    return normalizeSunlight(data.sunlight);
  }

  const category = data?.careEffective?.sunlightCategory || data?.sunlight?.category;

  if (!category) return [];

  if (category === "full") return ["full_sun"];
  if (category === "partial") return ["part_sun"];
  if (category === "shade") return ["shade"];

  return normalizeSunlight(category);
}

async function run() {
  const snap = await db.collection("plantCatalog").get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = {};

    if (!data.canonicalKey && data.scientificName) {
      patch.canonicalKey = canonicalKeyFromScientificName(data.scientificName);
    }

    if (data.minZone == null) {
      const minZone =
        data?.hardiness?.minZone ??
        data?.careEffective?.minZone ??
        null;

      if (typeof minZone === "number") patch.minZone = minZone;
    }

    if (data.wateringEveryDays == null) {
      const wateringEveryDays =
        data?.careEffective?.wateringEveryDays ??
        data?.watering?.defaultEveryDays ??
        null;

      if (typeof wateringEveryDays === "number") {
        patch.wateringEveryDays = wateringEveryDays;
      }
    }

    if (!data.wateringProfile) {
      const days =
        patch.wateringEveryDays ??
        data?.wateringEveryDays ??
        data?.careEffective?.wateringEveryDays ??
        data?.watering?.defaultEveryDays ??
        null;

      const profile = wateringProfileFromDays(days);
      if (profile) patch.wateringProfile = profile;
    }

    if (!Array.isArray(data.sunlight) || data.sunlight.length === 0) {
      const sunlight = sunlightArrayFromDoc(data);
      if (sunlight.length) patch.sunlight = sunlight;
    }

    if (
      (!Array.isArray(data.searchTokens) || data.searchTokens.length === 0) &&
      (data.commonName || data.scientificName || data.slug)
    ) {
      const tokens = new Set();
      const add = (s) => {
        const v = String(s || "").trim().toLowerCase();
        if (!v) return;
        tokens.add(v);
        v.split(/[^a-z0-9]+/g).forEach((part) => part && tokens.add(part));
      };

      add(data.commonName);
      add(data.scientificName);
      add(data.slug);
      add(patch.canonicalKey || data.canonicalKey);

      patch.searchTokens = Array.from(tokens).slice(0, 60);
    }

    if (Object.keys(patch).length) {
      patch.updatedAt = new Date().toISOString();
      await doc.ref.set(patch, { merge: true });
      console.log(`Patched ${doc.id}`, patch);
    }
  }

  console.log("Backfill done.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});