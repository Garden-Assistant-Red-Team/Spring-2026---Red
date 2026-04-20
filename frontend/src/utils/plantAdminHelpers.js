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
      ? plant.nativeStates.map((s) => String(s).trim()).filter(Boolean)
      : [],
    sources: Array.isArray(plant.sources)
      ? plant.sources.map((s) => String(s).trim()).filter(Boolean)
      : [],
    imageUrl: (plant.imageUrl || "").trim(),
    slug: (plant.slug || "").trim(),
    trefleId: plant.trefleId === "" || plant.trefleId == null ? null : Number(plant.trefleId),
  };
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

export function validatePlantDraft(draft) {
  const errors = {};

  const sunlight = safeArray(draft.sunlight);

  // 🔥 IMPORTANT: use TEXT fields here, not raw fields
  const nativeStates = draft.nativeStatesText
    ? draft.nativeStatesText.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const sources = draft.sourcesText
    ? draft.sourcesText.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (!draft.commonName?.trim()) {
    errors.commonName = "Required";
  }

  if (!draft.scientificName?.trim()) {
    errors.scientificName = "Required";
  }

  if (!draft.slug?.trim()) {
    errors.slug = "Required";
  }

  if (!draft.canonicalKey?.trim()) {
    errors.canonicalKey = "Required";
  }

  if (sunlight.length === 0) {
    errors.sunlight = "Select at least one sunlight option";
  }

  return errors;
}

export function hasPlantChanges(originalPlant, draftPlant) {
  if (!originalPlant || !draftPlant) return false;

  const originalNormalized = normalizePlantDraftForSave(originalPlant);
  const draftNormalized = normalizePlantDraftForSave(draftPlant);

  return JSON.stringify(originalNormalized) !== JSON.stringify(draftNormalized);
}