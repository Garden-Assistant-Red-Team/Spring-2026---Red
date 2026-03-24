import React, { useEffect, useMemo, useState } from "react";
import { auth } from "../firebase";
import { ensureUserDoc } from "../utils/ensureUserDoc";
import DashboardLayout from "../components/DashboardLayout";
import "./ToolLayout.css";

function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

function displayName(p) {
  return p?.commonName || p?.scientificName || p?.slug || "Unknown plant";
}

function badge(text) {
  return <span className="dictionaryBadge">{text}</span>;
}

async function addToMyGarden(selected) {
  const user = auth.currentUser;
  if (!user) {
    alert("Please log in to add plants.");
    return;
  }

  await ensureUserDoc(user);

  const uid = user.uid;

  const body = {
    name: selected.scientificName || selected.commonName || selected.id,
    commonName: selected.commonName ?? null,
    scientificName: selected.scientificName ?? null,
    plantId: selected.id,
    trefle_id: typeof selected.trefleId === "number" ? selected.trefleId : null,
    minZone:
      typeof selected?.careEffective?.minZone === "number"
        ? selected.careEffective.minZone
        : null,
    maxZone:
      typeof selected?.careEffective?.maxZone === "number"
        ? selected.careEffective.maxZone
        : null,
    sunlight: selected?.careEffective?.sunlightCategory ?? null,
    wateringFrequency: selected?.careEffective?.wateringEveryDays ?? null,
    reason: "Added from dictionary",
    source: "dictionary",
    confidence: null,
    photoUrl: selected.imageUrl ?? null,
  };

  const res = await fetch(`http://localhost:5000/api/garden/${uid}/plants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data?.error || "Failed to add plant.");
    return;
  }

  alert(data?.message || "Added to My Garden!");
}

export default function PlantDictionaryPage() {
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), 350);

  const [limit, setLimit] = useState(10);
  const [sunFilter, setSunFilter] = useState("any");
  const [edibleFilter, setEdibleFilter] = useState("any");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [plants, setPlants] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);

      if (!q) {
        setPlants([]);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      try {
        const url = `/api/catalog/search?q=${encodeURIComponent(
          q
        )}&limit=${limit}&details=1`;
        const resp = await fetch(url);

        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`Request failed (${resp.status}): ${txt}`);
        }

        const data = await resp.json();

        if (!cancelled) {
          setPlants(Array.isArray(data) ? data : []);
          setStatus("done");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || String(e));
          setStatus("error");
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [q, limit]);

  const filtered = useMemo(() => {
    return plants.filter((p) => {
      if (sunFilter !== "any") {
        const s =
          p?.careEffective?.sunlightCategory || p?.sunlight?.category || null;
        if (s !== sunFilter) return false;
      }

      if (edibleFilter === "edibleOnly") {
        const edible = p?.edible === true;
        if (!edible) return false;
      }

      return true;
    });
  }, [plants, sunFilter, edibleFilter]);

  const commonQuery =
    selected?.commonName || selected?.name || selected?.scientificName || "";

  const scientificQuery =
    selected?.scientificName || selected?.commonName || selected?.name || "";

  const broadQuery = [selected?.commonName, selected?.scientificName]
    .filter(Boolean)
    .join(" ");

  const encodedCommonQuery = encodeURIComponent(commonQuery);
  const encodedBroadQuery = encodeURIComponent(broadQuery || commonQuery);

  const shoppingLinks = commonQuery
    ? [
      {
        label: "Home Depot",
        url: `https://www.homedepot.com/s/${encodedCommonQuery}`,
      },
      {
        label: "Lowe's",
        url: `https://www.lowes.com/search?searchTerm=${encodedCommonQuery}`,
      },
      {
        label: "Google Shopping",
        url: `https://www.google.com/search?tbm=shop&q=${encodedBroadQuery}`,
      },
      {
        label: "Bloomscape",
        url: `https://bloomscape.com/search?type=product&q=${encodedCommonQuery}`,
      },
      {
        label: "FastGrowingTrees",
        url: `https://www.fast-growing-trees.com/search?type=product&q=${encodedCommonQuery}`,
      },
      {
        label: "Costa Farms",
        url: `https://costafarms.com/search?q=${encodedCommonQuery}&type=product`,
      },
    ]
    : [];

  return (
    <DashboardLayout
      title="Resources"
      subtitle="Search the plant dictionary, browse details, and save plants to My Garden."
      badge={selected ? displayName(selected) : "Plant Dictionary"}
    >
      <div className="container">
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="dictionaryControlsGrid">
            <label className="field">
              <span>Search by common name or scientific name</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., basil, tulipa gesneriana, solanum lycopersicum"
              />
            </label>

            <label className="field">
              <span>Sunlight</span>
              <select
                value={sunFilter}
                onChange={(e) => setSunFilter(e.target.value)}
              >
                <option value="any">Any</option>
                <option value="full">Full sun</option>
                <option value="partial">Partial</option>
                <option value="shade">Shade</option>
              </select>
            </label>

            <label className="field">
              <span>Edible</span>
              <select
                value={edibleFilter}
                onChange={(e) => setEdibleFilter(e.target.value)}
              >
                <option value="any">Any</option>
                <option value="edibleOnly">Edible only</option>
              </select>
            </label>

            <label className="field">
              <span>Import limit</span>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </label>
          </div>

          {status === "loading" && <div className="muted">Loading…</div>}

          {status === "error" && (
            <div className="errorText">
              <b>Error:</b> {error}
            </div>
          )}

          {status !== "loading" && q && (
            <div className="muted" style={{ marginTop: 10 }}>
              Showing <b>{filtered.length}</b> result(s)
            </div>
          )}
        </section>

        <div className="dictionaryMainGrid">
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Plant Results</h2>
              <span className="sectionPill">{filtered.length}</span>
            </div>

            <div className="dictionaryResultsGrid">
              {filtered.map((p) => {
                const name = displayName(p);
                const sun =
                  p?.careEffective?.sunlightCategory ||
                  p?.sunlight?.category ||
                  "unknown";
                const water = p?.careEffective?.wateringEveryDays ?? null;

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`dictionaryPlantCard ${selected?.id === p.id ? "active" : ""
                      }`}
                    type="button"
                  >
                    <div className="dictionaryPlantRow">
                      <div className="dictionaryPlantThumb">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={name}
                            className="dictionaryThumbImage"
                            loading="lazy"
                          />
                        ) : (
                          <div className="dictionaryNoImage">No image</div>
                        )}
                      </div>

                      <div className="dictionaryPlantInfo">
                        <div className="dictionaryPlantName">{name}</div>
                        <div className="dictionaryPlantMeta">
                          {p.scientificName || p.slug || ""}
                        </div>
                        <div className="dictionaryBadgeWrap">
                          {badge(`Sun: ${sun}`)}
                          {badge(
                            water
                              ? `Water: every ${water} days`
                              : "Water: unknown"
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {q && status !== "loading" && filtered.length === 0 && (
              <div className="muted" style={{ marginTop: 16 }}>
                No results yet. Try a different search.
              </div>
            )}
          </section>

          <section className="panel dictionaryDetailsPanel">
            {!selected ? (
              <div className="muted">
                <b>Plant details</b>
                <p style={{ marginTop: 8 }}>
                  Click a plant card to see details.
                </p>
              </div>
            ) : (
              <div>
                <div className="dictionaryDetailsTitle">
                  {displayName(selected)}
                </div>
                <div className="dictionaryDetailsMeta">
                  {selected.scientificName || selected.slug || ""}
                </div>

                {selected.imageUrl && (
                  <img
                    src={selected.imageUrl}
                    alt={displayName(selected)}
                    className="dictionaryDetailImage"
                  />
                )}

                <div className="dictionaryDetailsBody">
                  <div>
                    <b>Family:</b> {selected.family || "Unknown"}
                  </div>
                  <div>
                    <b>Edible:</b>{" "}
                    {selected.edible === true
                      ? "Yes"
                      : selected.edible === false
                        ? "No"
                        : "Unknown"}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <b>Care (effective):</b>
                    <div>
                      Sunlight:{" "}
                      {selected?.careEffective?.sunlightCategory || "Unknown"}
                    </div>
                    <div>
                      Watering:{" "}
                      {selected?.careEffective?.wateringEveryDays
                        ? `Every ${selected.careEffective.wateringEveryDays} days`
                        : "Unknown"}
                    </div>
                    <div>
                      Min zone: {selected?.careEffective?.minZone ?? "Unknown"}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Source: {selected?.careEffective?.source || "Unknown"}
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }} className="muted">
                    <div>
                      <b>Catalog ID:</b> {selected.id}
                    </div>
                    <div>
                      <b>Trefle ID:</b> {selected.trefleId}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={() => addToMyGarden(selected)}
                    className="primaryBtn"
                    type="button"
                    style={{ width: "100%" }}
                  >
                    Add to My Garden
                  </button>

                  <button
                    onClick={() => setSelected(null)}
                    className="secondaryBtn"
                    type="button"
                    style={{ width: "100%", marginTop: 10 }}
                  >
                    Clear selection
                  </button>
                </div>

                {selected && commonQuery && (
                  <div
                    className="plantShoppingSection"
                    style={{
                      marginTop: 18,
                      paddingTop: 14,
                      borderTop: "1px solid #d9e4d7",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Where to Buy
                    </div>

                    <div
                      className="muted"
                      style={{ marginBottom: 10, fontSize: 13 }}
                    >
                      Search this plant across a few popular stores.
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      {shoppingLinks.map((link) => (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="secondaryBtn"
                          style={{
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 140,
                          }}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="muted" style={{ marginTop: 20, fontSize: 12 }}>
          Plant data is cached from Trefle and its aggregated sources.
        </div>
      </div>
    </DashboardLayout>
  );
}