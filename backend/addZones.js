const admin = require("firebase-admin");
const serviceAccount = require("./config/serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();



function guessZones(name) {
  name = (name || "").toLowerCase();

  if (name.includes("basil")) return [10, 11];
  if (name.includes("rosemary")) return [7, 10];
  if (name.includes("tomato")) return [3, 11];
  if (name.includes("lettuce")) return [4, 9];
  if (name.includes("pepper")) return [9, 11];
  if (name.includes("cactus")) return [9, 13];

  // default general outdoor plant
  return [5, 9];
}

async function run() {
  const snap = await db.collection("plantCatalog").get();

  let count = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const [minZone, maxZone] = guessZones(data.commonName);

    await doc.ref.update({
      minZone,
      maxZone
    });

    count++;
    if (count % 50 === 0) console.log("Updated:", count);
  }

  console.log("DONE. Updated", count, "plants");
  process.exit();
}

run();