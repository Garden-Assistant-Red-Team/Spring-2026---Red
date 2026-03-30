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

function canonical(s) {
  return (s || "").toString().trim().toLowerCase().replaceAll(" ", "_");
}

function sunlightCategory(light) {
  const sunlightSet = new Array();

  if (typeof light !== "number") return null;
  if (light <= 3) sunlightSet.push("shade");
  if (light <= 6) sunlightSet.push("part_sun");
  if (6 < light) sunlightSet.push("full_sun");

  return sunlightSet;

}

function wateringFromSoilHumidity(h) {
  if (typeof h !== "number") return null;
  if (h <= 3) return { profile: "low", days: 7 };
  if (h <= 6) return { profile: "moderate", days: 4 };
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
  add(obj?.commonName);
  add(obj?.scientificName);
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

function displayNameFromDoc(p) {
  return p?.commonName || p?.scientificName || p?.slug || "Unknown plant";
}

function normalizeCatalogDoc(doc) {
  const isNormalizedSunlightArray =
    Array.isArray(doc?.sunlight) && doc.sunlight.length > 0;

  const sunlightCategoryFromArray = isNormalizedSunlightArray
    ? doc.sunlight.includes("full_sun")
      ? "full"
      : doc.sunlight.includes("part_sun")
        ? "partial"
        : doc.sunlight.includes("shade")
          ? "shade"
          : null
    : null;

  const sunlightCategoryFromObject =
    typeof doc?.sunlight === "object" && doc?.sunlight !== null && !Array.isArray(doc.sunlight)
      ? doc?.sunlight?.category
      : null;

  const careSun =
    doc?.careEffective?.sunlightCategory ||
    sunlightCategoryFromArray ||
    sunlightCategoryFromObject ||
    null;

  const careWater =
    doc?.careEffective?.wateringEveryDays ??
    doc?.wateringEveryDays ??
    doc?.watering?.defaultEveryDays ??
    null;

  const careMinZone =
    doc?.careEffective?.minZone ??
    doc?.minZone ??
    doc?.hardiness?.minZone ??
    null;

  const normalizedSunlight = isNormalizedSunlightArray
    ? doc.sunlight
    : careSun === "full"
      ? ["full_sun"]
      : careSun === "partial"
        ? ["part_sun"]
        : careSun === "shade"
          ? ["shade"]
          : [];

  return {
    ...doc,
    sunlight: normalizedSunlight,
    wateringEveryDays: doc?.wateringEveryDays ?? careWater ?? null,
    minZone: doc?.minZone ?? careMinZone ?? null,
    careEffective: {
      sunlightCategory: careSun,
      wateringEveryDays: careWater,
      minZone: careMinZone,
      source: doc?.careEffective?.source || "catalog",
    },
  };
}

function serializeCatalogPlant(doc) {
  const p = normalizeCatalogDoc(doc);

  return {
    id: p.id,
    canonicalKey: p.canonicalKey || null,
    commonName: p.commonName || null,
    scientificName: p.scientificName || null,
    imageUrl: p.imageUrl || null,
    family: p.family || null,
    flower: p.flower === true,
    tree: p.tree === true,
    shrub: p.shrub === true,
    herb: p.herb === true,
    edible: p.edible === true,
    pollinatorFriendly: p.pollinatorFriendly === true,
    nativeStates: Array.isArray(p.nativeStates) ? p.nativeStates : [],
    minZone: typeof p.minZone === "number" ? p.minZone : null,
    maxZone: typeof p.maxZone === "number" ? p.maxZone : null,
    sunlight: Array.isArray(p.sunlight) ? p.sunlight : [],
    wateringProfile: p.wateringProfile || null,
    wateringEveryDays:
      typeof p.wateringEveryDays === "number" ? p.wateringEveryDays : null,
    duration: p.duration || null,
    sources:
      p.sources && typeof p.sources === "object" && !Array.isArray(p.sources)
        ? p.sources
        : {},
    slug: p.slug || null,
    trefleId: typeof p.trefleId === "number" ? p.trefleId : null,
    dataSource: p.dataSource || null,
    careEffective: p.careEffective || null,
  };
}

router.get("/browse", async (req, res) => {
  try {
    const parsedPage = parseInt(req.query.page || "1", 10);
    const parsedPageSize = parseInt(req.query.pageSize || "12", 10);

    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(parsedPageSize, 24)
        : 12;

    const sortBy =
      req.query.sortBy === "scientificName" ? "scientificName" : "commonName";

    const snap = await db.collection("plantCatalog").get();

    let plants = snap.docs
      .map((d) => serializeCatalogPlant({ id: d.id, ...d.data() }))
      .filter((p) => p.commonName || p.scientificName);

    plants.sort((a, b) => {
      const aVal = norm(a?.[sortBy] || a?.scientificName || a?.commonName || "");
      const bVal = norm(b?.[sortBy] || b?.scientificName || b?.commonName || "");
      return aVal.localeCompare(bVal);
    });

    const total = plants.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const paged = plants.slice(start, start + pageSize);

    return res.json({
      items: paged,
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        sortBy,
      },
    });
  } catch (err) {
    console.error("[catalog/browse] error:", err);
    return res.status(500).json({
      error: err?.message || "Catalog browse failed.",
    });
  }
});

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

    let localResults = [];

    if (!firestoreQuotaExceeded) {
      try {
        const snap = await db.collection("plantCatalog").get();

        localResults = snap.docs
          .map((d) => serializeCatalogPlant({ id: d.id, ...d.data() }))
          .filter((p) => {
            const haystack = [
              p.commonName,
              p.scientificName,
              p.slug,
              ...(Array.isArray(p.searchTokens) ? p.searchTokens : []),
            ]
              .filter(Boolean)
              .map((x) => norm(x));

            return haystack.some((x) => x.includes(q));
          })
          .sort((a, b) => {
            const aName = norm(displayNameFromDoc(a));
            const bName = norm(displayNameFromDoc(b));

            const aStarts = aName.startsWith(q) ? 1 : 0;
            const bStarts = bName.startsWith(q) ? 1 : 0;

            if (aStarts !== bStarts) return bStarts - aStarts;
            return aName.localeCompare(bName);
          })
          .slice(0, limit);
      } catch (err) {
        if (isQuotaExceededError(err)) {
          firestoreQuotaExceeded = true;
          console.warn(
            "[catalog/search] Firestore quota exceeded during local lookup; switching to live mode"
          );
        } else {
          throw err;
        }
      }
    }

    let resp = await speciesSearch(q);
    let items = resp?.data || [];

    if (!items.length) {
      resp = await plantSearch(q);
      items = resp?.data || [];
    }

    const toImport = items.slice(0, limit);
    const importedResults = [];

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

        canonicalKey: canonical(item.scientific_name ?? "unknown_plant"),
        commonName: item.common_name ?? null,
        scientificName: item.scientific_name ?? null,

        family: details?.family?.name ?? details?.family ?? null,
        dataSource: "trefle_review",

        flower: details?.flower === true ?? null,
        herb: null,
        shrub: null,
        tree: null,
        edible: details?.edible ?? null,
        pollinatorFriendly: null,

        minZone: minZone,
        maxZone: null,

        sunlight: sunlightCategory(light),

        wateringEveryDays: wateringDays,
        wateringProfile: wateringDerived?.profile ?? "moderate",

        nativeStates: [],

        imageUrl: item.image_url ?? null,

        slug: item.slug ?? null,

        searchTokens: buildSearchTokens(item, q),

        trefleId: item.id,

        updatedAt: new Date().toISOString(),

        toxicity: specs?.toxicity ?? null,
        familySlug: details?.family?.slug ?? null,
        vegetable: details?.vegetable ?? null,
        soilHumidity: soilHumidity,
        soilPH: {
          min: growth?.ph_minimum ?? null,
          max: growth?.ph_maximum ?? null,
        },
        temperatureF: {
          min: growth?.minimum_temperature?.deg_f ?? null,
          max: growth?.maximum_temperature?.deg_f ?? null,
        },

        growthRaw: growth,
        specificationsRaw: specs,

      };

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

      importedResults.push(
        serializeCatalogPlant({
          id: docId,
          ...catalogDoc,
        })
      );

      if (!firestoreQuotaExceeded) {
        try {
          const normalizedDoc = serializeCatalogPlant({
            id: docId,
            ...catalogDoc,
          });

          await db.collection("plantCatalog_staging").doc(docId).set(normalizedDoc, {
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

    const localIds = new Set(localResults.map((p) => p.id));
    const merged = [
      ...localResults,
      ...importedResults.filter((p) => !localIds.has(p.id)),
    ];

    console.log("[catalog/search] returning merged results", {
      localCount: localResults.length,
      liveCount: importedResults.length,
      finalCount: merged.length,
      firestoreQuotaExceeded,
    });

    return res.json(merged);
  } catch (err) {
    console.error("[catalog/search] fatal error:", err);
    return res.status(500).json({
      error: err?.message || "Catalog search failed.",
    });
  }
});

module.exports = router;