import React, { useEffect, useState } from "react";

export default function RecommendedPlants({ uid, onAdd }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!uid) return;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`http://localhost:5000/api/recommendations?uid=${uid}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load recommendations");
        setData(json);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [uid]);

  if (!uid) return <div>Please log in.</div>;
  if (loading) return <div>Loading recommendations…</div>;
  if (error) return <div style={{ color: "crimson" }}>{error}</div>;
  if (!data?.recommendations?.length) return <div>No recommendations yet.</div>;

  return (
    <div style={{ border: "1px solid #dbe7df", borderRadius: 14, padding: 16, background: "white" }}>
      <h3 style={{ marginTop: 0 }}>Recommended for Zone {data.zone}</h3>
      <p style={{ marginTop: 6, color: "#667085" }}>
        Plants that match your garden zone.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {data.recommendations.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #e6efe7",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>
                {p.commonName || p.scientificName || p.id}
              </div>
              <div style={{ color: "#667085", fontSize: 13 }}>
                {p.scientificName || ""}
              </div>
              <div style={{ color: "#344054", fontSize: 13, marginTop: 4 }}>
                Zones {p.minZone}–{p.maxZone} • {p.reason}
              </div>
            </div>

            <button
              onClick={() => onAdd(p)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #2F6B4F",
                background: "#2F6B4F",
                color: "white",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Add to My Garden
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}