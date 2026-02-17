import React, { useEffect, useMemo, useState } from "react";

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
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #ddd",
        fontSize: 12,
        marginRight: 6,
        marginTop: 6,
      }}
    >
      {text}
    </span>
  );
}

export default function PlantDictionaryPage() {
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), 350);

  const [limit, setLimit] = useState(10);
  const [sunFilter, setSunFilter] = useState("any"); // any | full | partial | shade
  const [edibleFilter, setEdibleFilter] = useState("any"); // any | edibleOnly

  const [status, setStatus] = useState("idle"); // idle | loading | error | done
  const [error, setError] = useState(null);
  const [plants, setPlants] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);

      // Don’t hammer the API on empty input
      if (!q) {
        setPlants([]);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      try {
        const url = `/api/catalog/search?q=${encodeURIComponent(q)}&limit=${limit}&details=1`;
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
        const s = p?.careEffective?.sunlightCategory || p?.sunlight?.category || null;
        if (s !== sunFilter) return false;
      }
      if (edibleFilter === "edibleOnly") {
        const edible = p?.edible === true; // only true counts as edible
        if (!edible) return false;
      }
      return true;
    });
  }, [plants, sunFilter, edibleFilter]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Plant Dictionary</h1>
      <p style={{ marginTop: 0, color: "#444" }}>
        Search real plants. Data provided by Trefle and sources it aggregates.
      </p>

      {/* Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 12,
          alignItems: "end",
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>
            Search by common name or scientific name
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., basil, tulipa gesneriana, solanum lycopersicum"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>Sunlight</label>
          <select
            value={sunFilter}
            onChange={(e) => setSunFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: 14,
              background: "white",
            }}
          >
            <option value="any">Any</option>
            <option value="full">Full sun</option>
            <option value="partial">Partial</option>
            <option value="shade">Shade</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>Edible</label>
          <select
            value={edibleFilter}
            onChange={(e) => setEdibleFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: 14,
              background: "white",
            }}
          >
            <option value="any">Any</option>
            <option value="edibleOnly">Edible only</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>Import limit</label>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: 14,
              background: "white",
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </select>
        </div>
      </div>

      {/* Status */}
      {status === "loading" && <div style={{ color: "#555" }}>Loading…</div>}
      {status === "error" && (
        <div style={{ color: "crimson" }}>
          <b>Error:</b> {error}
        </div>
      )}
      {status !== "loading" && q && (
        <div style={{ marginTop: 10, color: "#555" }}>
          Showing <b>{filtered.length}</b> result(s)
        </div>
      )}

      {/* Main layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 16,
          marginTop: 16,
        }}
      >
        {/* Results grid */}
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {filtered.map((p) => {
              const name = displayName(p);
              const sun = p?.careEffective?.sunlightCategory || p?.sunlight?.category || "unknown";
              const water = p?.careEffective?.wateringEveryDays || p?.watering?.defaultEveryDays || null;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", gap: 12 }}>
                    <div
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid #eee",
                        background: "#fafafa",
                        flexShrink: 0,
                      }}
                    >
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ padding: 10, fontSize: 12, color: "#666" }}>
                          No image
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{name}</div>
                      <div style={{ color: "#555", fontSize: 13, marginBottom: 6 }}>
                        {p.scientificName || p.slug || ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#555" }}>
                        {badge(`Sun: ${sun}`)}
                        {badge(water ? `Water: every ${water} days` : "Water: unknown")}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {q && status !== "loading" && filtered.length === 0 && (
            <div style={{ marginTop: 16, color: "#555" }}>
              No results yet. Try a different search (e.g., a scientific name).
            </div>
          )}
        </div>

        {/* Details panel */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 14,
            background: "white",
            height: "fit-content",
            position: "sticky",
            top: 16,
          }}
        >
          {!selected ? (
            <div style={{ color: "#555" }}>
              <b>Plant details</b>
              <p style={{ marginTop: 8 }}>
                Click a plant card to see details.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
                {displayName(selected)}
              </div>
              <div style={{ color: "#555", marginBottom: 10 }}>
                {selected.scientificName || selected.slug || ""}
              </div>

              {selected.imageUrl && (
                <img
                  src={selected.imageUrl}
                  alt={displayName(selected)}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    border: "1px solid #eee",
                    marginBottom: 12,
                    objectFit: "cover",
                  }}
                />
              )}

              <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                <div><b>Family:</b> {selected.family || "Unknown"}</div>
                <div><b>Edible:</b> {selected.edible === true ? "Yes" : selected.edible === false ? "No" : "Unknown"}</div>

                <div style={{ marginTop: 10 }}>
                  <b>Care (effective):</b>
                  <div>Sunlight: {selected?.careEffective?.sunlightCategory || "Unknown"}</div>
                  <div>Watering: {selected?.careEffective?.wateringEveryDays ? `Every ${selected.careEffective.wateringEveryDays} days` : "Unknown"}</div>
                  <div>Min zone: {selected?.careEffective?.minZone ?? "Unknown"}</div>
                  <div style={{ color: "#666", fontSize: 12 }}>
                    Source: {selected?.careEffective?.source || "Unknown"}
                  </div>
                </div>

                <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
                  <div><b>Catalog ID:</b> {selected.id}</div>
                  <div><b>Trefle ID:</b> {selected.trefleId}</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <button
                  onClick={() => alert("Next step: properly wire this.")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #222",
                    background: "#222",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Add to My Garden
                </button>

                <button
                  onClick={() => setSelected(null)}
                  style={{
                    width: "100%",
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ccc",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 28, color: "#666", fontSize: 12 }}>
        Plant data is cached from Trefle and its aggregated sources.
      </div>
    </div>
  );
}