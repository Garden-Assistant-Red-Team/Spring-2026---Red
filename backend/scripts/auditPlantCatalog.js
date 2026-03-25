const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const serviceAccount = require("../config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function getMissingFields(data) {
  const missing = [];

  if (!data.canonicalKey) missing.push("canonicalKey");
  if (!data.commonName) missing.push("commonName");
  if (!data.scientificName) missing.push("scientificName");

  if (data.minZone == null) missing.push("minZone");
  if (data.maxZone == null) missing.push("maxZone");

  if (!Array.isArray(data.sunlight) || data.sunlight.length === 0) {
    missing.push("sunlight");
  }

  if (!data.wateringProfile) missing.push("wateringProfile");
  if (!data.duration) missing.push("duration");

  if (!Array.isArray(data.nativeStates) || data.nativeStates.length === 0) {
    missing.push("nativeStates");
  }

  if (!data.imageUrl) missing.push("imageUrl");

  return missing;
}

function classifyRecord(missingFields) {
  const trefleFriendly = ["imageUrl"];
  const manualLikely = ["nativeStates", "duration"];
  const normalization = [
    "canonicalKey",
    "sunlight",
    "wateringProfile",
    "minZone",
    "maxZone",
  ];

  return {
    needsTrefleEnrichment: missingFields.some((f) =>
      trefleFriendly.includes(f)
    ),
    needsManualReview: missingFields.some((f) => manualLikely.includes(f)),
    needsNormalization: missingFields.some((f) =>
      normalization.includes(f)
    ),
  };
}

function completenessScore(missingFields) {
  const totalFields = 10;
  return Number(((totalFields - missingFields.length) / totalFields).toFixed(2));
}

async function run() {
  const snap = await db.collection("plantCatalog").get();

  const results = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const missingFields = getMissingFields(data);

    if (missingFields.length > 0) {
      const classification = classifyRecord(missingFields);

      results.push({
        docId: doc.id,
        scientificName: data.scientificName || null,
        commonName: data.commonName || null,
        dataSource: data.dataSource || "unknown",
        missingFields,
        completenessScore: completenessScore(missingFields),
        ...classification,
      });
    }
  }

  results.sort((a, b) => a.completenessScore - b.completenessScore);

  const output = {
    generatedAt: new Date().toISOString(),
    totalDocsScanned: snap.size,
    incompleteCount: results.length,
    records: results,
  };

  const outputDir = path.join(__dirname, "../output");
  const outputPath = path.join(outputDir, "plantCatalogAudit.json");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`Scanned ${snap.size} docs.`);
  console.log(`Found ${results.length} incomplete plant records.`);
  console.log(`Audit written to: ${outputPath}`);

  const preview = results.slice(0, 10);
  if (preview.length) {
    console.log("\nWorst 10 records:");
    for (const item of preview) {
      console.log(JSON.stringify(item, null, 2));
    }
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});