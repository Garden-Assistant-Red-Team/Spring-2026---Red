const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");

console.log("✅ catalog.js loaded");

const db = admin.firestore();

router.get("/ping", (req, res) => {
  res.json({ ok: true, route: "catalog ping" });
});

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

function sunlightCategory(light) {
  if (typeof light !== "number") return null;
  if (light <= 3) return "shade";
  if (light <= 6) return "partial";
  return "full";
}

function wateringFromSoilHumidity(h) {
  if (typeof h !== "number") return null;
  if (h <= 3) return { profile: "low", days: 7 };
  if (h <= 6) return { profile: "medium", days: 4 };
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

function buildSearchTokens(obj, q) {
  const tokens = new Set();

  const add = (str) => {
    const s = norm(str);
    if (!s) return;
    tokens.add(s);
    s.split(/[^a-z0-9]+/g).forEach(w => w && tokens.add(w));
  };

  add(obj.common_name);
  add(obj.scientific_name);
  add(obj.slug);
  if (q) add(q);

  return Array.from(tokens).slice(0, 60);
}

function getToken() {
  const t = process.env.TREFLE_TOKEN;
  if (!t) throw new Error("Missing TREFLE_TOKEN");
  return t;
}

async function trefleGET(pathOrUrl) {
  const token = getToken();

  const base = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `https://trefle.io${pathOrUrl}`;

  const url = new URL(base);
  url.searchParams.set("token", token);

  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Trefle error ${r.status}`);
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

async function getCareOverride(docId) {
  const snap = await db.collection("careOverrides").doc(docId).get();
  return snap.exists ? snap.data() : null;
}

// GET /api/catalog/search?q=basil&limit=1
router.get("/search", async (req, res) => {
  try {
    const q = norm(req.query.q);
    if (!q) return res.json([]);

    const limit = Math.min(parseInt(req.query.limit || "10"), 15);

    // DB-first lookup
    let snap = await db.collection("plantCatalog")
      .where("searchTokens", "array-contains", q)
      .limit(20)
      .get();

    if (!snap.empty) {
      return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }

    // Prefer species search
    let resp = await speciesSearch(q);
    let items = resp?.data || [];

    if (!items.length) {
      resp = await plantSearch(q);
      items = resp?.data || [];
    }

    const toImport = items.slice(0, limit);

    for (const item of toImport) {
      const docId = `trefle_${item.id}`;

      const details = await fetchDetails(item);

      const growth = details?.growth || null;
      const specs = details?.specifications || null;

      const light = growth?.light ?? null;
      const soilHumidity = growth?.soil_humidity ?? null;

      const wateringDerived = wateringFromSoilHumidity(soilHumidity);
      const wateringDays = wateringDerived?.days ?? 5; // fallback

      const minZone = minZoneFromMinTempF(
        growth?.minimum_temperature?.deg_f ?? null
      );

      const catalogDoc = {
        trefleId: item.id,
        slug: item.slug ?? null,
        commonName: item.common_name ?? null,
        scientificName: item.scientific_name ?? null,
        imageUrl: item.image_url ?? null,

        family: details?.family?.name ?? details?.family ?? null,
        familySlug: details?.family?.slug ?? null,

        edible: details?.edible ?? null,
        vegetable: details?.vegetable ?? null,

        sunlight: {
          light,
          category: sunlightCategory(light),
        },

        watering: {
          soilHumidity,
          defaultEveryDays: wateringDays,
        },

        hardiness: {
          minZone,
        },

        soilPH: {
          min: growth?.ph_minimum ?? null,
          max: growth?.ph_maximum ?? null,
        },

        temperatureF: {
          min: growth?.minimum_temperature?.deg_f ?? null,
          max: growth?.maximum_temperature?.deg_f ?? null,
        },

        toxicity: specs?.toxicity ?? null,

        searchTokens: buildSearchTokens(item, q),

        growthRaw: growth,
        specificationsRaw: specs,

        updatedAt: new Date().toISOString(),
      };

      // Apply optional override
      const override = await getCareOverride(docId);

      catalogDoc.careEffective = {
        sunlightCategory:
          override?.sunlightCategory ??
          catalogDoc.sunlight.category ??
          "partial",

        wateringEveryDays:
          override?.wateringEveryDays ??
          catalogDoc.watering.defaultEveryDays ??
          5,

        minZone:
          override?.minZone ??
          catalogDoc.hardiness.minZone ??
          null,

        source: override ? "override" : "trefle/fallback",
      };

      await db.collection("plantCatalog")
        .doc(docId)
        .set(catalogDoc, { merge: true });
    }

    // Return newly imported results
    snap = await db.collection("plantCatalog")
      .where("searchTokens", "array-contains", q)
      .limit(20)
      .get();

    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;