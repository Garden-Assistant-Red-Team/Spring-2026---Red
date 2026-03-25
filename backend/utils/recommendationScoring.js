function parseZone(zoneValue) {
  if (zoneValue == null) return null;

  if (typeof zoneValue === "number") return zoneValue;

  const str = String(zoneValue).trim().toLowerCase();
  const match = str.match(/^(\d+)([ab])?$/);

  if (!match) return null;

  const base = Number(match[1]);
  const suffix = match[2];

  if (!suffix) return base;
  if (suffix === "a") return base + 0.0;
  if (suffix === "b") return base + 0.5;

  return base;
}

function normalizeUserSunlight(value) {
  if (!value) return null;

  const v = String(value).trim().toLowerCase();

  if (v.includes("full")) return "full_sun";
  if (v.includes("part")) return "part_sun";
  if (v.includes("shade")) return "shade";

  return v;
}

function normalizeUserWatering(value) {
  if (!value) return null;

  const v = String(value).trim().toLowerCase();

  if (["low", "dry"].includes(v)) return "low";
  if (["medium", "moderate"].includes(v)) return "moderate";
  if (["high", "wet"].includes(v)) return "high";

  return v;
}

function getPlantMinZone(plant) {
  return plant.minZone ?? plant.hardiness?.minZone ?? plant.careEffective?.minZone ?? null;
}

function getPlantMaxZone(plant) {
  return plant.maxZone ?? plant.hardiness?.maxZone ?? plant.careEffective?.maxZone ?? null;
}

function getPlantSunlightArray(plant) {
  if (Array.isArray(plant.sunlight) && plant.sunlight.length) {
    return plant.sunlight;
  }

  const category = plant?.sunlight?.category ?? plant?.careEffective?.sunlightCategory ?? null;

  if (!category) return [];

  if (category === "full") return ["full_sun"];
  if (category === "partial") return ["part_sun"];
  if (category === "shade") return ["shade"];

  return [];
}

function getPlantWateringProfile(plant) {
  if (plant.wateringProfile) return plant.wateringProfile;

  const days =
    plant.wateringEveryDays ??
    plant?.watering?.defaultEveryDays ??
    plant?.careEffective?.wateringEveryDays ??
    null;

  if (typeof days !== "number") return null;

  if (days >= 6) return "low";
  if (days >= 3) return "moderate";
  return "high";
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
  if (!Array.isArray(plant.nativeStates)) return false;

  return plant.nativeStates.includes(String(stateCode).toUpperCase());
}

function scoreZone(user, plant) {
  const min = getPlantMinZone(plant);
  const max = getPlantMaxZone(plant);

  if (min == null && max == null) {
    return { points: 0, reason: null };
  }

  if (matchesZone(user.gardenZone, plant)) {
    return { points: 40, reason: "Fits your hardiness zone" };
  }

  return { points: -20, reason: "May not fit your hardiness zone" };
}

function scoreSunlight(user, plant) {
  const userSunlight = normalizeUserSunlight(user.sunlight);
  const plantSunlight = getPlantSunlightArray(plant);

  if (!userSunlight || plantSunlight.length === 0) {
    return { points: 0, reason: null };
  }

  if (plantSunlight.includes(userSunlight)) {
    return { points: 25, reason: "Matches your sunlight needs" };
  }

  return { points: -10, reason: "Sunlight may not be ideal" };
}

function scoreWatering(user, plant) {
  const userWatering = normalizeUserWatering(user.wateringPreference);
  const plantWatering = getPlantWateringProfile(plant);

  if (!userWatering || !plantWatering) {
    return { points: 0, reason: null };
  }

  if (userWatering === plantWatering) {
    return { points: 20, reason: "Matches your watering preference" };
  }

  const adjacent =
    (userWatering === "low" && plantWatering === "moderate") ||
    (userWatering === "moderate" && (plantWatering === "low" || plantWatering === "high")) ||
    (userWatering === "high" && plantWatering === "moderate");

  if (adjacent) {
    return { points: 8, reason: "Close to your watering preference" };
  }

  return { points: -10, reason: "Watering needs may not be ideal" };
}

function scoreNative(user, plant) {
  if (!user.stateCode) {
    return { points: 0, reason: null };
  }

  if (nativeToState(plant, user.stateCode)) {
    return { points: 12, reason: `Native to ${String(user.stateCode).toUpperCase()}` };
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

function scorePlant(plant, user, filters = {}) {
  let score = 0;
  const reasons = [];

  const zone = scoreZone(user, plant);
  score += zone.points;
  if (zone.reason) reasons.push(zone.reason);

  const sunlight = scoreSunlight(user, plant);
  score += sunlight.points;
  if (sunlight.reason) reasons.push(sunlight.reason);

  const watering = scoreWatering(user, plant);
  score += watering.points;
  if (watering.reason) reasons.push(watering.reason);

  const native = scoreNative(user, plant);
  score += native.points;
  if (native.reason) reasons.push(native.reason);

  const tags = scoreTags(filters, plant);
  score += tags.points;
  if (tags.reason) reasons.push(tags.reason);

  let missingPenalty = 0;
  if (getPlantMinZone(plant) == null && getPlantMaxZone(plant) == null) missingPenalty -= 4;
  if (getPlantSunlightArray(plant).length === 0) missingPenalty -= 3;
  if (!getPlantWateringProfile(plant)) missingPenalty -= 3;
  if (!Array.isArray(plant.nativeStates) || plant.nativeStates.length === 0) missingPenalty -= 2;

  score += missingPenalty;
  if (missingPenalty < 0) {
    reasons.push("Some care data is incomplete");
  }

  return {
    score,
    reasons,
  };
}

module.exports = {
  parseZone,
  matchesZone,
  nativeToState,
  scorePlant,
  getPlantMinZone,
  getPlantMaxZone,
  getPlantSunlightArray,
  getPlantWateringProfile,
};