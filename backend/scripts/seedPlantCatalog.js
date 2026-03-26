const admin = require("firebase-admin");

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

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveCanonicalKey(plant) {
  return canonicalKeyFromScientificName(plant.scientificName || "");
}

function resolvePreferredDocId(plant, canonicalKey) {
  if (isFiniteNumber(plant.trefleId)) {
    return `trefle_${plant.trefleId}`;
  }

  if (canonicalKey) {
    return canonicalKey;
  }

  throw new Error(
    `Cannot resolve doc ID for plant with scientificName="${plant.scientificName || ""}"`
  );
}

function buildSeedDoc(plant) {
  const canonicalKey = resolveCanonicalKey(plant);

  if (!canonicalKey) {
    throw new Error(
      `Cannot build seed doc without a valid scientificName. commonName="${plant.commonName || ""}"`
    );
  }

  return {
    canonicalKey,
    commonName: plant.commonName ?? null,
    scientificName: plant.scientificName ?? null,
    trefleId: isFiniteNumber(plant.trefleId) ? plant.trefleId : null,
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
    minZone: isFiniteNumber(plant.minZone) ? plant.minZone : null,
    maxZone: isFiniteNumber(plant.maxZone) ? plant.maxZone : null,
    sunlight: normalizeSunlight(plant.sunlight),
    wateringProfile: normalizeWateringProfile(plant.wateringProfile),
    wateringEveryDays: isFiniteNumber(plant.wateringEveryDays)
      ? plant.wateringEveryDays
      : null,
    duration: plant.duration ?? null,

    sources:
      plant.sources && typeof plant.sources === "object" && !Array.isArray(plant.sources)
        ? plant.sources
        : {},

    searchTokens: buildSearchTokensFromPlant({
      ...plant,
      canonicalKey,
    }),

    dataSource: "seed",
  };
}

/**
 * Try to find an already-existing plant doc so we update it instead of creating a duplicate.
 * Match order:
 * 1. trefle_<trefleId>
 * 2. canonicalKey doc ID
 * 3. query by trefleId
 * 4. query by canonicalKey
 * 5. query by scientificName
 */
async function findExistingDocId(seedDoc) {
  const candidateIds = [];

  if (isFiniteNumber(seedDoc.trefleId)) {
    candidateIds.push(`trefle_${seedDoc.trefleId}`);
  }

  if (seedDoc.canonicalKey) {
    candidateIds.push(seedDoc.canonicalKey);
  }

  for (const docId of candidateIds) {
    const snap = await db.collection("plantCatalog").doc(docId).get();
    if (snap.exists) {
      return docId;
    }
  }

  if (isFiniteNumber(seedDoc.trefleId)) {
    const trefleQuery = await db
      .collection("plantCatalog")
      .where("trefleId", "==", seedDoc.trefleId)
      .limit(2)
      .get();

    if (!trefleQuery.empty) {
      if (trefleQuery.size > 1) {
        console.warn(
          `Warning: multiple docs found with trefleId=${seedDoc.trefleId}. Using ${trefleQuery.docs[0].id}`
        );
      }
      return trefleQuery.docs[0].id;
    }
  }

  if (seedDoc.canonicalKey) {
    const canonicalQuery = await db
      .collection("plantCatalog")
      .where("canonicalKey", "==", seedDoc.canonicalKey)
      .limit(2)
      .get();

    if (!canonicalQuery.empty) {
      if (canonicalQuery.size > 1) {
        console.warn(
          `Warning: multiple docs found with canonicalKey=${seedDoc.canonicalKey}. Using ${canonicalQuery.docs[0].id}`
        );
      }
      return canonicalQuery.docs[0].id;
    }
  }

  if (seedDoc.scientificName) {
    const scientificQuery = await db
      .collection("plantCatalog")
      .where("scientificName", "==", seedDoc.scientificName)
      .limit(2)
      .get();

    if (!scientificQuery.empty) {
      if (scientificQuery.size > 1) {
        console.warn(
          `Warning: multiple docs found with scientificName="${seedDoc.scientificName}". Using ${scientificQuery.docs[0].id}`
        );
      }
      return scientificQuery.docs[0].id;
    }
  }

  return null;
}

async function upsertSeedPlant(plant) {
  const seedDoc = buildSeedDoc(plant);
  const preferredDocId = resolvePreferredDocId(plant, seedDoc.canonicalKey);
  const existingDocId = await findExistingDocId(seedDoc);
  const targetDocId = existingDocId || preferredDocId;

  const docRef = db.collection("plantCatalog").doc(targetDocId);
  const existingSnap = await docRef.get();

  const payload = {
    ...seedDoc,
    updatedAt: new Date().toISOString(),
  };

  if (!existingSnap.exists) {
    payload.createdAt = new Date().toISOString();
  }

  await docRef.set(payload, { merge: true });

  console.log(
    `${existingSnap.exists ? "Updated" : "Seeded"} ${targetDocId}` +
      (existingDocId && existingDocId !== preferredDocId
        ? ` (matched existing doc instead of preferred ${preferredDocId})`
        : "")
  );
}

async function run() {
  for (const plant of seedPlants) {
    await upsertSeedPlant(plant);
  }

  console.log("Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});