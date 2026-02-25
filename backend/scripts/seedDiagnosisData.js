const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require("../config/serviceAccountKey.json");

// Initialize Firebase Admin ONLY ONCE
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function readJsonFromData(filename) {
  const abs = path.join(__dirname, "..", "data", filename);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

async function upsertCollection(collectionName, items) {
  if (!Array.isArray(items)) throw new Error(`${collectionName} must be an array`);

  const batch = db.batch();
  for (const item of items) {
    if (!item.id) throw new Error(`${collectionName} item missing "id": ${JSON.stringify(item).slice(0, 120)}...`);
    const ref = db.collection(collectionName).doc(item.id);
    batch.set(ref, item, { merge: true });
  }
  await batch.commit();
  console.log(`Seeded ${items.length} docs into "${collectionName}"`);
}

async function main() {
  const symptoms = readJsonFromData("symptoms.seed.json");
  const observations = readJsonFromData("observations.seed.json");
  const conditions = readJsonFromData("conditions.seed.json");

  await upsertCollection("symptoms", symptoms);
  await upsertCollection("observations", observations);
  await upsertCollection("conditions", conditions);

  console.log("Done seeding diagnosis data.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});