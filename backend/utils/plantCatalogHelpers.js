function normalizeScientificName(name) {
  return (name || "").trim();
}

function canonicalKeyFromScientificName(name) {
  return normalizeScientificName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSunlight(values) {
  if (!values) return [];
  const arr = Array.isArray(values) ? values : [values];

  const out = new Set();

  for (const value of arr) {
    const v = String(value).trim().toLowerCase();

    if (!v) continue;
    if (v.includes("full")) out.add("full_sun");
    else if (v.includes("part")) out.add("part_sun");
    else if (v.includes("shade")) out.add("shade");
  }

  return Array.from(out);
}

function normalizeWateringProfile(value) {
  const v = String(value || "").trim().toLowerCase();

  if (!v) return null;
  if (["low", "dry"].includes(v)) return "low";
  if (["medium", "moderate"].includes(v)) return "moderate";
  if (["high", "wet"].includes(v)) return "high";

  return null;
}

function buildSearchTokensFromPlant(plant) {
  const tokens = new Set();

  const add = (str) => {
    const s = String(str || "").trim().toLowerCase();
    if (!s) return;
    tokens.add(s);
    s.split(/[^a-z0-9]+/g).forEach((part) => {
      if (part) tokens.add(part);
    });
  };

  add(plant.commonName);
  add(plant.scientificName);
  add(plant.slug);
  add(plant.canonicalKey);

  return Array.from(tokens).slice(0, 60);
}

module.exports = {
  canonicalKeyFromScientificName,
  normalizeSunlight,
  normalizeWateringProfile,
  buildSearchTokensFromPlant,
};