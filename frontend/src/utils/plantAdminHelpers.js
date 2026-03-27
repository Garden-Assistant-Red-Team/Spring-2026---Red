export const ALLOWED_SUNLIGHT = ["full_sun", "part_sun", "shade"];

export function plantMatchesSearch(plant, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    plant.commonName,
    plant.scientificName,
    plant.canonicalKey,
    plant.slug,
    ...(plant.nativeStates || []),
    ...(plant.sunlight || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export function normalizePlantDraftForSave(plant) {
  return {
    commonName: (plant.commonName || "").trim(),
    scientificName: (plant.scientificName || "").trim(),
    canonicalKey: (plant.canonicalKey || "").trim(),
    minZone: plant.minZone === "" || plant.minZone == null ? null : Number(plant.minZone),
    maxZone: plant.maxZone === "" || plant.maxZone == null ? null : Number(plant.maxZone),
    sunlight: Array.isArray(plant.sunlight)
      ? plant.sunlight.filter(Boolean).map((v) => String(v).trim().toLowerCase())
      : [],
    wateringEveryDays:
      plant.wateringEveryDays === "" || plant.wateringEveryDays == null
        ? null
        : Number(plant.wateringEveryDays),
    wateringProfile: (plant.wateringProfile || "").trim(),
    flower: !!plant.flower,
    shrub: !!plant.shrub,
    tree: !!plant.tree,
    herb: !!plant.herb,
    edible: !!plant.edible,
    pollinatorFriendly: !!plant.pollinatorFriendly,
    nativeStates: Array.isArray(plant.nativeStates)
      ? plant.nativeStates.filter(Boolean).map((v) => String(v).trim().toUpperCase())
      : [],
    sources: Array.isArray(plant.sources)
      ? plant.sources.filter(Boolean).map((v) => String(v).trim())
      : [],
    imageUrl: (plant.imageUrl || "").trim(),
    slug: (plant.slug || "").trim(),
    trefleId: plant.trefleId === "" || plant.trefleId == null ? null : Number(plant.trefleId),
  };
}

export function validatePlantDraft(plant) {
  const errors = {};

  const commonName = (plant.commonName || "").trim();
  const scientificName = (plant.scientificName || "").trim();

  if (!commonName && !scientificName) {
    errors.identity = "Plant should have at least a common name or scientific name.";
  }

  if (
    plant.minZone !== "" &&
    plant.minZone != null &&
    plant.maxZone !== "" &&
    plant.maxZone != null &&
    Number(plant.minZone) > Number(plant.maxZone)
  ) {
    errors.zone = "Min zone cannot be greater than max zone.";
  }

  if (
    plant.wateringEveryDays !== "" &&
    plant.wateringEveryDays != null &&
    Number(plant.wateringEveryDays) <= 0
  ) {
    errors.wateringEveryDays = "Watering Every Days must be greater than 0.";
  }

  const badSunlight = (plant.sunlight || []).filter(
    (value) => !ALLOWED_SUNLIGHT.includes(String(value).trim().toLowerCase())
  );

  if (badSunlight.length > 0) {
    errors.sunlight = `Invalid sunlight value(s): ${badSunlight.join(", ")}`;
  }

  return errors;
}

export function hasPlantChanges(originalPlant, draftPlant) {
  if (!originalPlant || !draftPlant) return false;

  const originalNormalized = normalizePlantDraftForSave(originalPlant);
  const draftNormalized = normalizePlantDraftForSave(draftPlant);

  return JSON.stringify(originalNormalized) !== JSON.stringify(draftNormalized);
}