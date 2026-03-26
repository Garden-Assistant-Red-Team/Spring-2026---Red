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

function prettySunlight(values) {
  if (!Array.isArray(values) || values.length === 0) return null;

  return values
    .map((v) => {
      if (v === "full_sun") return "Full Sun";
      if (v === "part_sun") return "Part Sun";
      if (v === "shade") return "Shade";
      return v;
    })
    .join(", ");
}

function getSunlightLabel(p) {
  if (Array.isArray(p?.sunlight) && p.sunlight.length) {
    return prettySunlight(p.sunlight) || "Unknown";
  }

  const cat = p?.careEffective?.sunlightCategory || p?.sunlight?.category || null;
  if (cat === "full") return "Full Sun";
  if (cat === "partial") return "Part Sun";
  if (cat === "shade") return "Shade";
  return "Unknown";
}

function getWateringDays(p) {
  return (
    p?.careEffective?.wateringEveryDays ??
    p?.wateringEveryDays ??
    p?.watering?.defaultEveryDays ??
    null
  );
}

function getMinZone(p) {
  return p?.careEffective?.minZone ?? p?.minZone ?? p?.hardiness?.minZone ?? null;
}

function getMaxZone(p) {
  return p?.maxZone ?? p?.careEffective?.maxZone ?? p?.hardiness?.maxZone ?? null;
}

function recBadge(text) {
  return <span className="recBadge">{text}</span>;
}

function PlantCard({ plant, selected, onSelect }) {
  const minZone = getMinZone(plant);
  const maxZone = getMaxZone(plant);

  return (
    <button
      type="button"
      onClick={() => onSelect(plant)}
      className={`recCard ${selected?.id === plant.id ? "active" : ""}`}
    >
      <div className="recCardImageWrap">
        {plant.imageUrl ? (
          <img
            src={plant.imageUrl}
            alt={plant.commonName || plant.scientificName}
            className="recCardImage"
            loading="lazy"
          />
        ) : (
          <div className="recCardNoImage">No image</div>
        )}
      </div>

      <div className="recCardBody">
        <div className="recCardTitle">{plant.commonName || plant.scientificName}</div>

        {plant.scientificName && (
          <div className="recCardMeta">{plant.scientificName}</div>
        )}

        <div className="recCardBadges">
          {minZone != null && maxZone != null && (
            <span className="recBadge">Zones {minZone}–{maxZone}</span>
          )}
          {plant.duration && <span className="recBadge">{plant.duration}</span>}
          {plant.pollinatorFriendly && <span className="recBadge">Pollinator</span>}
          {plant.edible && <span className="recBadge">Edible</span>}
        </div>
      </div>
    </button>
  );
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
    name: selected.commonName || selected.scientificName || selected.id,
    commonName: selected.commonName ?? null,
    scientificName: selected.scientificName ?? null,
    plantId: selected.id,
    trefle_id: typeof selected.trefleId === "number" ? selected.trefleId : null,
    minZone: getMinZone(selected),
    maxZone: getMaxZone(selected),
    sunlight:
      Array.isArray(selected?.sunlight) && selected.sunlight.length
        ? selected.sunlight
        : selected?.careEffective?.sunlightCategory ?? null,
    wateringFrequency: getWateringDays(selected),
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
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [sortBy, setSortBy] = useState("commonName");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [plants, setPlants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [query, sortBy]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      setStatus("loading");

      try {
        if (!q) {
          const url = `/api/catalog/browse?page=${page}&pageSize=${pageSize}&sortBy=${encodeURIComponent(
            sortBy
          )}`;
          const resp = await fetch(url);

          if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Request failed (${resp.status}): ${txt}`);
          }

          const data = await resp.json();

          if (!cancelled) {
            setPlants(Array.isArray(data?.items) ? data.items : []);
            setPagination(data?.pagination || null);
            setStatus("done");
          }

          return;
        }

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
          setPagination(null);
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
  }, [q, limit, page, pageSize, sortBy]);

  const filtered = useMemo(() => {
    return plants.filter((p) => {
      if (sunFilter !== "any") {
        const s = getSunlightLabel(p).toLowerCase();

        if (
          (sunFilter === "full" && !s.includes("full")) ||
          (sunFilter === "partial" && !s.includes("part")) ||
          (sunFilter === "shade" && !s.includes("shade"))
        ) {
          return false;
        }
      }

      return true;
    });
  }, [plants, sunFilter]);

  const commonQuery =
    selected?.commonName || selected?.name || selected?.scientificName || "";

  const broadQuery = [selected?.commonName, selected?.scientificName]
    .filter(Boolean)
    .join(" ");

  const budgetQuery = [selected?.commonName, "live plant"]
    .filter(Boolean)
    .join(" ");

  const treeQuery = [selected?.commonName || selected?.scientificName, "tree"]
    .filter(Boolean)
    .join(" ");

  const encodedCommonQuery = encodeURIComponent(commonQuery);
  const encodedBroadQuery = encodeURIComponent(broadQuery || commonQuery);
  const encodedBudgetQuery = encodeURIComponent(budgetQuery || commonQuery);
  const encodedTreeQuery = encodeURIComponent(treeQuery || commonQuery);

  const shoppingCards = commonQuery
    ? [
        {
          store: "Home Depot",
          label: "Big Box",
          tag: "Popular",
          description: "Search this plant on Home Depot.",
          url: `https://www.homedepot.com/s/${encodedCommonQuery}`,
        },
        {
          store: "Lowe's",
          label: "Big Box",
          tag: "Compare",
          description: "Search this plant on Lowe's.",
          url: `https://www.lowes.com/search?searchTerm=${encodedCommonQuery}`,
        },
        {
          store: "Amazon",
          label: "Fast",
          tag: "Seeds + kits",
          description: "Search broad listings for seeds and starter plants.",
          url: `https://www.amazon.com/s?k=${encodedBroadQuery}`,
        },
        {
          store: "Etsy",
          label: "Specialty",
          tag: "Unique",
          description: "Find niche or smaller seller listings.",
          url: `https://www.etsy.com/search?q=${encodedBroadQuery}`,
        },
        {
          store: "Walmart",
          label: "Budget",
          tag: "Low cost",
          description: "Search budget-friendly plant listings.",
          url: `https://www.walmart.com/search?q=${encodedBudgetQuery}`,
        },
        {
          store: "FastGrowingTrees",
          label: "Trees",
          tag: "If relevant",
          description: "Good if this plant is sold as a shrub or tree.",
          url: `https://www.fast-growing-trees.com/search?q=${encodedTreeQuery}`,
        },
      ]
    : [];

  return (
    <DashboardLayout>
      <div className="toolPageWrap">
        <header className="toolHero">
          <div>
            <div className="toolEyebrow">Plant tools</div>
            <h1 className="toolTitle">Plant Dictionary</h1>
            <p className="toolSubtitle">
              Browse the catalog, search your database first, and compare the most
              important care details without all the extra clutter.
            </p>
          </div>
        </header>

        <section className="panel recHeroPanel" style={{ marginBottom: 18 }}>
          <div className="recHeroTop" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <h2 className="panelTitle" style={{ marginBottom: 8 }}>
                Search & browse plants
              </h2>
              <p className="muted" style={{ marginBottom: 14 }}>
                Search by common or scientific name. When the search is empty, the
                full catalog loads below as paginated cards.
              </p>

<div className="dictionaryToolbar">
  <label className="dictionaryField dictionaryFieldSearch">
    <span>Search plant catalog</span>
    <input
      type="text"
      placeholder="Try hydrangea, basil, serviceberry..."
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  </label>

  {q && (
    <label className="dictionaryField">
      <span>Results</span>
      <select
        value={limit}
        onChange={(e) => setLimit(Number(e.target.value))}
      >
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={15}>15</option>
      </select>
    </label>
  )}

  <label className="dictionaryField">
    <span>Sort by</span>
    <select
      value={sortBy}
      onChange={(e) => setSortBy(e.target.value)}
    >
      <option value="commonName">Common name</option>
      <option value="scientificName">Scientific name</option>
    </select>
  </label>

  <label className="dictionaryField">
    <span>Sunlight</span>
    <select
      value={sunFilter}
      onChange={(e) => setSunFilter(e.target.value)}
    >
      <option value="any">Any</option>
      <option value="full">Full sun</option>
      <option value="partial">Part sun</option>
      <option value="shade">Shade</option>
    </select>
  </label>
</div>

              {status !== "loading" && (
                <div className="muted" style={{ marginTop: 12 }}>
                  {q ? (
                    <>
                      Showing <b>{filtered.length}</b> result(s)
                    </>
                  ) : (
                    <>
                      Showing page <b>{pagination?.page || 1}</b> of{" "}
                      <b>{pagination?.totalPages || 1}</b> (
                      {pagination?.total || filtered.length} total plants)
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}
          {status === "loading" && (
            <p className="muted" style={{ marginTop: 10 }}>
              Loading plant data...
            </p>
          )}
        </section>

        <div className="recLayout">
          <div className="recMain">
            <section className="panel recPanel">
              <div className="recSectionHeader">
                <h2 className="panelTitle">{q ? "Search Results" : "Plant Catalog"}</h2>
              </div>

              {status === "done" && filtered.length > 0 ? (
                <div className="recGrid">
                  {filtered.map((plant) => (
                    <PlantCard
                      key={plant.id}
                      plant={plant}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  ))}
                </div>
              ) : status === "done" ? (
                <p className="muted">No plants matched your current search or filters.</p>
              ) : null}

              {!q && pagination && pagination.totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginTop: 16,
                  }}
                >
                  <button
                    type="button"
                    className="secondaryBtn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </button>

                  <div className="muted" style={{ alignSelf: "center" }}>
                    Page {pagination.page} of {pagination.totalPages}
                  </div>

                  <button
                    type="button"
                    className="secondaryBtn"
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          </div>

          <aside className="panel recDetailsPanel">
            <h2 className="panelTitle">Selected Plant</h2>

            {!selected ? (
              <p className="muted">Click a plant card to see details.</p>
            ) : (
              <div>
                <div className="recDetailsTitle">
                  {selected.commonName || selected.scientificName}
                </div>

                {selected.scientificName && (
                  <div className="recDetailsMeta">{selected.scientificName}</div>
                )}

                {selected.imageUrl && (
                  <div className="recDetailsImageWrap">
                    <img
                      src={selected.imageUrl}
                      alt={selected.commonName || selected.scientificName}
                      className="recDetailsImage"
                    />
                  </div>
                )}

                <div className="recDetailsFacts">
                  <div>
                    <strong>Zones:</strong>{" "}
                    {getMinZone(selected) != null && getMaxZone(selected) != null
                      ? `${getMinZone(selected)}–${getMaxZone(selected)}`
                      : "Unknown"}
                  </div>

                  {getSunlightLabel(selected) && (
                    <div>
                      <strong>Sunlight:</strong> {getSunlightLabel(selected)}
                    </div>
                  )}

                  {selected.duration && (
                    <div>
                      <strong>Duration:</strong> {selected.duration}
                    </div>
                  )}

                  {getWateringDays(selected) && (
                    <div>
                      <strong>Watering:</strong> Every {getWateringDays(selected)} days
                    </div>
                  )}

                  {selected.family && (
                    <div>
                      <strong>Family:</strong> {selected.family}
                    </div>
                  )}

                  {selected.nativeStates?.length > 0 && (
                    <div>
                      <strong>Native States:</strong> {selected.nativeStates.join(", ")}
                    </div>
                  )}
                </div>

                <div className="recCardBadges" style={{ marginTop: 12 }}>
                  {selected.pollinatorFriendly && recBadge("Pollinator Friendly")}
                  {selected.edible && recBadge("Edible")}
                  {selected.tree && recBadge("Tree")}
                  {selected.shrub && recBadge("Shrub")}
                  {selected.herb && recBadge("Herb")}
                  {selected.flower && recBadge("Flower")}
                </div>

                {selected.sources && (
                  <div className="recSourceLinks">
                    {Object.entries(selected.sources)
                      .filter(([, url]) => !!url)
                      .map(([label, url]) => (
                        <a key={label} href={url} target="_blank" rel="noreferrer">
                          {label}
                        </a>
                      ))}
                  </div>
                )}

                <button
                  className="primaryBtn"
                  type="button"
                  onClick={() => addToMyGarden(selected)}
                  style={{ marginTop: 14, width: "100%" }}
                >
                  Add to My Garden
                </button>

                {selected && commonQuery && (
                  <div
                    className="plantShoppingSection"
                    style={{
                      marginTop: 18,
                      paddingTop: 14,
                      borderTop: "1px solid #d9e4d7",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Buy This Plant
                    </div>

                    <div className="shoppingCardGrid">
                      {shoppingCards.map((card) => (
                        <a
                          key={card.store}
                          href={card.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shoppingCard"
                        >
                          <div className="shoppingCardTop">
                            <span className="shoppingCardLabel">{card.label}</span>
                            <span className="shoppingCardTag">{card.tag}</span>
                          </div>

                          <div className="shoppingCardStore">{card.store}</div>
                          <div className="shoppingCardDescription">
                            {card.description}
                          </div>

                          <div className="shoppingCardAction">Search store ↗</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>

        <div className="muted" style={{ marginTop: 20, fontSize: 12 }}>
          Plant data is loaded from your catalog first, then Trefle results after.
        </div>
      </div>
    </DashboardLayout>
  );
}