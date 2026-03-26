const admin = require("firebase-admin");
const serviceAccount = require("../config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const TREFLE_TOKEN = process.env.TREFLE_TOKEN;

if (!TREFLE_TOKEN) {
  console.error("Missing TREFLE_TOKEN in environment.");
  process.exit(1);
}

async function trefleFetch(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TREFLE_TOKEN}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trefle request failed (${res.status}): ${text}`);
  }

  return res.json();
}

function normalize(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function searchSpeciesByScientificName(scientificName) {
  const url =
    `https://trefle.io/api/v1/species/search?` +
    new URLSearchParams({
      q: scientificName,
      token: TREFLE_TOKEN,
    }).toString();

  const json = await trefleFetch(url);
  return Array.isArray(json.data) ? json.data : [];
}

async function getSpeciesById(id) {
  const url = `https://trefle.io/api/v1/species/${id}?token=${encodeURIComponent(
    TREFLE_TOKEN
  )}`;
  const json = await trefleFetch(url);
  return json?.data || null;
}

function pickBestMatch(results, scientificName) {
  if (!results.length) return null;

  const target = normalize(scientificName);

  const exact = results.find((item) => {
    return (
      normalize(item.scientific_name) === target ||
      normalize(item.slug).replace(/-/g, " ") === target
    );
  });

  if (exact) return exact;

  const genus = target.split(" ")[0];
  const sameGenus = results.find((item) =>
    normalize(item.scientific_name).startsWith(genus + " ")
  );

  return sameGenus || results[0];
}

async function findBestImageForPlant(scientificName) {
  const results = await searchSpeciesByScientificName(scientificName);
  const best = pickBestMatch(results, scientificName);

  if (!best) return null;

  if (best.image_url) {
    return {
      trefleId: best.id ?? null,
      slug: best.slug ?? null,
      commonName: best.common_name ?? null,
      family: best.family ?? null,
      imageUrl: best.image_url,
      source: "species_search",
    };
  }

  if (best.id != null) {
    const detail = await getSpeciesById(best.id);
    if (detail?.image_url) {
      return {
        trefleId: detail.id ?? best.id ?? null,
        slug: detail.slug ?? best.slug ?? null,
        commonName: detail.common_name ?? best.common_name ?? null,
        family: detail.family ?? best.family ?? null,
        imageUrl: detail.image_url,
        source: "species_detail",
      };
    }
  }

  return {
    trefleId: best.id ?? null,
    slug: best.slug ?? null,
    commonName: best.common_name ?? null,
    family: best.family ?? null,
    imageUrl: null,
    source: "no_image_found",
  };
}

async function run() {
  const snap = await db.collection("plantCatalog").get();

  const docs = snap.docs
    .map((doc) => ({
      docId: doc.id,
      ...doc.data(),
    }))
    .filter((plant) => !plant.imageUrl && plant.scientificName);

  console.log(`Found ${docs.length} docs missing imageUrl.`);

  for (const plant of docs) {
    try {
      console.log(`Searching image for ${plant.scientificName}...`);

      const found = await findBestImageForPlant(plant.scientificName);

      if (!found || !found.imageUrl) {
        console.log(`No image found for ${plant.docId} (${plant.scientificName})`);
        continue;
      }

      const patch = {
        imageUrl: found.imageUrl,
        updatedAt: new Date().toISOString(),
      };

      if (!plant.trefleId && typeof found.trefleId === "number") {
        patch.trefleId = found.trefleId;
      }

      if (!plant.slug && found.slug) {
        patch.slug = found.slug;
      }

      if (!plant.commonName && found.commonName) {
        patch.commonName = found.commonName;
      }

      if (!plant.family && found.family) {
        patch.family = found.family;
      }

      if (!plant.dataSource || plant.dataSource === "unknown") {
        patch.dataSource = "trefle_enriched";
      }

      await db.collection("plantCatalog").doc(plant.docId).set(patch, { merge: true });

      console.log(`Updated ${plant.docId} with image from ${found.source}`);
    } catch (err) {
      console.error(`Failed for ${plant.docId}:`, err.message);
    }
  }

  console.log("Trefle image backfill complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});