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
    s.split(/[^a-z0-9]+/g).forEach((w) => {
      if (w) tokens.add(w);
    });
  };

  add(obj?.common_name);
  add(obj?.scientific_name);
  add(obj?.slug);
  if (q) add(q);

  return Array.from(tokens).slice(0, 60);
}

function getToken() {
  const t = process.env.TREFLE_TOKEN;
  if (!t) throw new Error("Missing TREFLE_TOKEN");
  return t;
}

function isQuotaExceededError(err) {
  const msg = String(err?.message || err || "");
  return (
    err?.code === 8 ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded")
  );
}

async function trefleGET(pathOrUrl) {
  const token = getToken();

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

async function getCareOverride(docId) {
  const snap = await db.collection("careOverrides").doc(docId).get();
  return snap.exists ? snap.data() : null;
}

router.get("/search", async (req, res) => {
  try {
    const q = norm(req.query.q);
    if (!q) {
      return res.json([]);
    }

    const parsedLimit = parseInt(req.query.limit || "10", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 15)
      : 10;

    let firestoreQuotaExceeded = false;

    console.log("[catalog/search] start", { q, limit });

    // 1) Try Firestore cache first
    if (!firestoreQuotaExceeded) {
      try {
        console.log("[catalog/search] trying Firestore cache lookup");
        const snap = await db
          .collection("plantCatalog")
          .where("searchTokens", "array-contains", q)
          .limit(20)
          .get();

        if (!snap.empty) {
          console.log("[catalog/search] returning cached Firestore results");
          return res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }

        console.log("[catalog/search] no cached Firestore results");
      } catch (err) {
        if (isQuotaExceededError(err)) {
          firestoreQuotaExceeded = true;
          console.warn(
            "[catalog/search] Firestore quota exceeded during initial lookup; switching to live mode"
          );
        } else {
          throw err;
        }
      }
    }

    // 2) Search Trefle
    console.log("[catalog/search] searching Trefle species");
    let resp = await speciesSearch(q);
    let items = resp?.data || [];

    if (!items.length) {
      console.log("[catalog/search] species empty, searching Trefle plants");
      resp = await plantSearch(q);
      items = resp?.data || [];
    }

    const toImport = items.slice(0, limit);
    const importedResults = [];

    console.log("[catalog/search] Trefle items selected", toImport.length);

    // 3) Build in-memory results
    for (const item of toImport) {
      const docId = `trefle_${item.id}`;

      let details = null;
      try {
        details = await fetchDetails(item);
      } catch (err) {
        console.warn(
          `[catalog/search] failed to fetch details for ${docId}: ${err.message}`
        );
        details = null;
      }

      const growth = details?.growth || null;
      const specs = details?.specifications || null;

      const light = growth?.light ?? null;
      const soilHumidity = growth?.soil_humidity ?? null;

      const wateringDerived = wateringFromSoilHumidity(soilHumidity);
      const wateringDays = wateringDerived?.days ?? 5;

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

      // 4) Optional care override, only while Firestore is usable
      let override = null;
      if (!firestoreQuotaExceeded) {
        try {
          override = await getCareOverride(docId);
        } catch (err) {
          if (isQuotaExceededError(err)) {
            firestoreQuotaExceeded = true;
            console.warn(
              "[catalog/search] Firestore quota exceeded during care override lookup; continuing without override"
            );
          } else {
            throw err;
          }
        }
      }

      catalogDoc.careEffective = {
        sunlightCategory:
          override?.sunlightCategory ??
          catalogDoc?.sunlight?.category ??
          "partial",

        wateringEveryDays:
          override?.wateringEveryDays ??
          catalogDoc?.watering?.defaultEveryDays ??
          5,

        minZone:
          override?.minZone ??
          catalogDoc?.hardiness?.minZone ??
          null,

        source: override ? "override" : "trefle/fallback",
      };

      importedResults.push({
        id: docId,
        ...catalogDoc,
      });

      // 5) Cache write only if Firestore is still usable
      if (!firestoreQuotaExceeded) {
        try {
          await db.collection("plantCatalog").doc(docId).set(catalogDoc, {
            merge: true,
          });
        } catch (err) {
          if (isQuotaExceededError(err)) {
            firestoreQuotaExceeded = true;
            console.warn(
              "[catalog/search] Firestore quota exceeded during catalog write; returning uncached live results"
            );
          } else {
            throw err;
          }
        }
      }
    }

    console.log("[catalog/search] returning live results", {
      count: importedResults.length,
      firestoreQuotaExceeded,
    });
    return res.json(importedResults);
  } catch (err) {
    console.error("[catalog/search] fatal error:", err);
    return res.status(500).json({
      error: err?.message || "Catalog search failed.",
    });
  }
});

module.exports = router;