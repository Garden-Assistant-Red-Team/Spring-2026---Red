const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require("../config/serviceAccountKey.json");
const seedPlants = require("../data/seedPlants.json");

const {
  canonicalKeyFromScientificName,
  normalizeSunlight,
  normalizeWateringProfile,
  buildSearchTokensFromPlant,
} = require("../utils/plantCatalogHelpers");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function buildSeedDoc(plant) {
  const canonicalKey = canonicalKeyFromScientificName(plant.scientificName);

  return {
    canonicalKey,
    commonName: plant.commonName ?? null,
    scientificName: plant.scientificName ?? null,
    trefleId: typeof plant.trefleId === "number" ? plant.trefleId : null,
    slug: plant.slug ?? null,
    family: plant.family ?? null,
    imageUrl: plant.imageUrl ?? null,

    flower: plant.flower === true,
    tree: plant.tree === true,
    shrub: plant.shrub === true,
    herb: plant.herb === true,
    edible: plant.edible === true,
    pollinatorFriendly: plant.pollinatorFriendly === true,

    nativeStates: Array.isArray(plant.nativeStates) ? plant.nativeStates : [],
    minZone: typeof plant.minZone === "number" ? plant.minZone : null,
    maxZone: typeof plant.maxZone === "number" ? plant.maxZone : null,
    sunlight: normalizeSunlight(plant.sunlight),
    wateringProfile: normalizeWateringProfile(plant.wateringProfile),
    wateringEveryDays:
      typeof plant.wateringEveryDays === "number" ? plant.wateringEveryDays : null,
    duration: plant.duration ?? null,

    sources: plant.sources ?? {},
    searchTokens: buildSearchTokensFromPlant({
      ...plant,
      canonicalKey,
    }),

    updatedAt: new Date().toISOString(),
    dataSource: "seed",
  };
}

async function run() {
  for (const plant of seedPlants) {
    const doc = buildSeedDoc(plant);

    const docId =
      typeof doc.trefleId === "number"
        ? `trefle_${doc.trefleId}`
        : doc.canonicalKey;

    await db.collection("plantCatalog").doc(docId).set(doc, { merge: true });
    console.log(`Seeded ${docId}`);
  }

  console.log("Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});