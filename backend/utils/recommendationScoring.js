function parseZone(zoneValue) {
  if (zoneValue == null) return null;

  if (typeof zoneValue === "number" && Number.isFinite(zoneValue)) {
    return zoneValue;
  }

  const str = String(zoneValue).trim().toLowerCase();

  // supports: "8", "8a", "8b", "zone 8a"
  const match = str.match(/(\d+)([ab])?/);
  if (!match) return null;

  const base = Number(match[1]);
  const suffix = match[2];

  if (!Number.isFinite(base)) return null;
  if (!suffix || suffix === "a") return base;
  if (suffix === "b") return base + 0.5;

  return base;
}

function normalizeSunlightValue(value) {
  if (!value) return null;

  const v = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (
    v === "full" ||
    v === "full_sun" ||
    v.includes("full_sun")
  ) {
    return "full_sun";
  }

  if (
    v === "partial" ||
    v === "part_sun" ||
    v === "partial_sun" ||
    v === "partial_shade" ||
    v.includes("part") ||
    v.includes("partial")
  ) {
    return "part_sun";
  }

  if (
    v === "shade" ||
    v === "full_shade" ||
    v.includes("shade")
  ) {
    return "shade";
  }

  return null;
}

function normalizeSunlightArray(values) {
  if (!Array.isArray(values)) return [];

  const normalized = values
    .map(normalizeSunlightValue)
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function getUserSunlightPreferences(user) {
  // preferred current field
  if (Array.isArray(user?.sunlightPreference) && user.sunlightPreference.length) {
    return normalizeSunlightArray(user.sunlightPreference);
  }

  // fallback for older user shape
  if (user?.sunlight) {
    const single = normalizeSunlightValue(user.sunlight);
    return single ? [single] : [];
  }

  return [];
}

function getPlantMinZone(plant) {
  return plant.minZone ?? plant.hardiness?.minZone ?? plant.careEffective?.minZone ?? null;
}

function getPlantMaxZone(plant) {
  return plant.maxZone ?? plant.hardiness?.maxZone ?? plant.careEffective?.maxZone ?? null;
}

function getPlantSunlightArray(plant) {
  // best case: already normalized array
  if (Array.isArray(plant?.sunlight) && plant.sunlight.length) {
    return normalizeSunlightArray(plant.sunlight);
  }

  // fallback if sunlight is stored as object/category
  const category =
    plant?.sunlight?.category ??
    plant?.careEffective?.sunlightCategory ??
    null;

  const normalizedCategory = normalizeSunlightValue(category);
  if (normalizedCategory) {
    return [normalizedCategory];
  }

  return [];
}

function matchesZone(userZone, plant) {
  const user = parseZone(userZone);
  const min = parseZone(getPlantMinZone(plant));
  const max = parseZone(getPlantMaxZone(plant));

  if (user == null) return false;
  if (min == null && max == null) return false;

  if (min != null && user < min) return false;
  if (max != null && user > max) return false;

  return true;
}

function nativeToState(plant, stateCode) {
  if (!stateCode) return false;
  if (!Array.isArray(plant?.nativeStates)) return false;

  return plant.nativeStates.includes(String(stateCode).toUpperCase());
}

function zoneDistanceFromRange(userZone, plant) {
  const user = parseZone(userZone);
  const min = parseZone(getPlantMinZone(plant));
  const max = parseZone(getPlantMaxZone(plant));

  if (user == null || (min == null && max == null)) return null;

  if (min != null && user < min) return min - user;
  if (max != null && user > max) return user - max;

  return 0;
}

function scoreZone(user, plant) {
  const min = getPlantMinZone(plant);
  const max = getPlantMaxZone(plant);

  if (min == null && max == null) {
    return { points: 0, reason: null };
  }

  const distance = zoneDistanceFromRange(user.gardenZone, plant);

  if (distance === 0) {
    return { points: 40, reason: "Fits your hardiness zone" };
  }

  // slight miss near boundary
  if (distance != null && distance <= 0.5) {
    return { points: -5, reason: "Close to your hardiness zone, but slightly outside it" };
  }

  return { points: -20, reason: "May not fit your hardiness zone" };
}

function getSunlightCompatibilityScore(userSun, plantSun) {
  if (userSun === plantSun) return 20;

  const adjacentPairs = new Set([
    "full_sun|part_sun",
    "part_sun|full_sun",
    "part_sun|shade",
    "shade|part_sun",
  ]);

  if (adjacentPairs.has(`${userSun}|${plantSun}`)) {
    return 8;
  }

  return -10;
}

function scoreSunlight(user, plant) {
  const userSunPrefs = getUserSunlightPreferences(user);
  const plantSunlight = getPlantSunlightArray(plant);

  if (userSunPrefs.length === 0 || plantSunlight.length === 0) {
    return { points: 0, reason: null };
  }

  let bestScore = -Infinity;

  for (const userSun of userSunPrefs) {
    for (const plantSun of plantSunlight) {
      const score = getSunlightCompatibilityScore(userSun, plantSun);
      if (score > bestScore) bestScore = score;
    }
  }

  if (bestScore >= 20) {
    return { points: 20, reason: "Matches your sunlight conditions" };
  }

  if (bestScore >= 8) {
    return { points: 8, reason: "Could work with your sunlight conditions" };
  }

  return { points: -10, reason: "Sunlight may not be ideal" };
}

function scoreNative(user, plant) {
  if (!user?.stateCode) {
    return { points: 0, reason: null };
  }

  if (nativeToState(plant, user.stateCode)) {
    return {
      points: 12,
      reason: `Native to ${String(user.stateCode).toUpperCase()}`,
    };
  }

  return { points: 0, reason: null };
}

function scoreTags(filters, plant) {
  let points = 0;
  const reasons = [];

  if (filters.flower && plant.flower) {
    points += 5;
    reasons.push("Flowering plant");
  }

  if (filters.tree && plant.tree) {
    points += 5;
    reasons.push("Tree");
  }

  if (filters.shrub && plant.shrub) {
    points += 5;
    reasons.push("Shrub");
  }

  if (filters.edible && plant.edible) {
    points += 5;
    reasons.push("Edible");
  }

  if (filters.pollinatorFriendly && plant.pollinatorFriendly) {
    points += 5;
    reasons.push("Good for pollinators");
  }

  return {
    points,
    reason: reasons.length ? reasons.join(", ") : null,
  };
}

function scoreDataCompleteness(plant) {
  let points = 0;
  const missing = [];

  const hasZone =
    getPlantMinZone(plant) != null || getPlantMaxZone(plant) != null;

  const hasSunlight = getPlantSunlightArray(plant).length > 0;
  const hasNativeStates =
    Array.isArray(plant?.nativeStates) && plant.nativeStates.length > 0;

  if (!hasZone) {
    points -= 4;
    missing.push("zone");
  }

  if (!hasSunlight) {
    points -= 3;
    missing.push("sunlight");
  }

  if (!hasNativeStates) {
    points -= 2;
    missing.push("native range");
  }

  return {
    points,
    reason: missing.length
      ? `Some plant data is incomplete (${missing.join(", ")})`
      : null,
  };
}

function scorePlant(plant, user, filters = {}) {
  let score = 0;
  const reasons = [];

  const zone = scoreZone(user, plant);
  score += zone.points;
  if (zone.reason) reasons.push(zone.reason);

  const sunlight = scoreSunlight(user, plant);
  score += sunlight.points;
  if (sunlight.reason) reasons.push(sunlight.reason);

  const native = scoreNative(user, plant);
  score += native.points;
  if (native.reason) reasons.push(native.reason);

  const tags = scoreTags(filters, plant);
  score += tags.points;
  if (tags.reason) reasons.push(tags.reason);

  const dataCompleteness = scoreDataCompleteness(plant);
  score += dataCompleteness.points;
  if (dataCompleteness.reason) reasons.push(dataCompleteness.reason);

  return {
    score,
    reasons,
  };
}

module.exports = {
  parseZone,
  normalizeSunlightValue,
  normalizeSunlightArray,
  getUserSunlightPreferences,
  getPlantMinZone,
  getPlantMaxZone,
  getPlantSunlightArray,
  matchesZone,
  nativeToState,
  scoreZone,
  scoreSunlight,
  scoreNative,
  scoreTags,
  scorePlant,
};