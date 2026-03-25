const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const serviceAccount = require("../config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const TREFLE_TOKEN = process.env.TREFLE_TOKEN;
const AUDIT_PATH = path.join(__dirname, "../output/plantCatalogAudit.json");

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

async function searchTrefleByScientificName(scientificName) {
  const url =
    `https://trefle.io/api/v1/species/search?` +
    new URLSearchParams({
      q: scientificName,
      token: TREFLE_TOKEN,
    }).toString();

  const json = await trefleFetch(url);

  return Array.isArray(json.data) ? json.data : [];
}

function normalize(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

async function enrichDoc(record) {
  const { docId, scientificName } = record;

  if (!scientificName) {
    console.log(`Skipping ${docId}: no scientificName`);
    return;
  }

  console.log(`Searching Trefle for ${scientificName}...`);

  const results = await searchTrefleByScientificName(scientificName);
  const best = pickBestMatch(results, scientificName);

  if (!best) {
    console.log(`No Trefle match found for ${scientificName}`);
    return;
  }

  const plantRef = db.collection("plantCatalog").doc(docId);
  const snap = await plantRef.get();

  if (!snap.exists) {
    console.log(`Skipping ${docId}: doc no longer exists`);
    return;
  }

  const current = snap.data();
  const patch = {};

  if (!current.imageUrl && best.image_url) {
    patch.imageUrl = best.image_url;
  }

  if (!current.family && best.family) {
    patch.family = best.family;
  }

  if (!current.slug && best.slug) {
    patch.slug = best.slug;
  }

  if (current.trefleId == null && best.id != null) {
    patch.trefleId = best.id;
  }

  if (!current.commonName && best.common_name) {
    patch.commonName = best.common_name;
  }

  if (!current.scientificName && best.scientific_name) {
    patch.scientificName = best.scientific_name;
  }

  if (!current.dataSource) {
    patch.dataSource = "trefle_enriched";
  }

  if (Object.keys(patch).length === 0) {
    console.log(`No enrichment needed for ${docId}`);
    return;
  }

  patch.updatedAt = new Date().toISOString();

  await plantRef.set(patch, { merge: true });
  console.log(`Updated ${docId}`, patch);
}

async function run() {
  if (!fs.existsSync(AUDIT_PATH)) {
    throw new Error(`Audit file not found: ${AUDIT_PATH}`);
  }

  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const candidates = (audit.records || []).filter(
    (record) => record.needsTrefleEnrichment
  );

  console.log(`Found ${candidates.length} Trefle enrichment candidates.`);

  for (const record of candidates) {
    try {
      await enrichDoc(record);
    } catch (err) {
      console.error(`Failed for ${record.docId}:`, err.message);
    }
  }

  console.log("Image enrichment complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});