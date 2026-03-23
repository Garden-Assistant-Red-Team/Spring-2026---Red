import React, { useEffect, useState } from "react";
import "./ToolLayout.css";
import { auth } from "../firebase";
import DashboardLayout from "../components/DashboardLayout";

const API_BASE = "http://localhost:5000";

export default function PlantRecommendationPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [zone, setZone] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedIds, setAddedIds] = useState(new Set());

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) loadRecommendations();
      else setRecommendations([]);
    });
    return () => unsubscribe();
  }, []);

  async function loadRecommendations() {
    setLoading(true);
    setError("");
    try {
      const uid = auth.currentUser.uid;
      const res = await fetch(`${API_BASE}/api/recommendations?uid=${uid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load recommendations");
      setZone(data.zone || "");
      setRecommendations(data.recommendations || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addToGarden(plant) {
    if (!auth.currentUser) return alert("You must be logged in.");
    const uid = auth.currentUser.uid;

    try {
      const res = await fetch(`${API_BASE}/api/garden/${uid}/plants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: plant.commonName || plant.scientificName,
          commonName: plant.commonName || null,
          scientificName: plant.scientificName || null,
          minZone: plant.minZone || null,
          maxZone: plant.maxZone || null,
          sunlight: plant.sunlight || null,
          wateringFrequency: plant.wateringFrequency || null,
          source: "recommendations",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add plant");

      setAddedIds((prev) => new Set(prev).add(plant.id));
      alert(`${plant.commonName || plant.scientificName} added to your garden! 🌿`);
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <DashboardLayout
      title="Plant Recommendation"
      subtitle="See plants that match your garden zone and save them to My Garden."
      badge={zone ? `Zone ${zone}` : "Recommendations"}
    >
      <div className="container">
        <div className="toolGrid">
          <section className="panel">
            <h2 className="panelTitle">Your Garden Info</h2>

            {!auth.currentUser && <p className="muted">Log in to see recommendations.</p>}

            {zone && (
              <>
                <p className="muted">
                  Garden Zone: <strong>{zone}</strong>
                </p>
                <p className="muted">Showing plants that thrive in your zone.</p>
              </>
            )}

            {error && <p style={{ color: "crimson" }}>{error}</p>}
            {loading && <p className="muted">Loading recommendations...</p>}

            {!zone && !loading && auth.currentUser && (
              <p className="muted">
                No garden zone set. Update your profile with a zip code and garden zone to get
                recommendations.
              </p>
            )}
          </section>

          <section className="panel">
            <h2 className="panelTitle">Plant Suggestions {zone ? `for Zone ${zone}` : ""}</h2>

            {!loading && recommendations.length === 0 && auth.currentUser && (
              <p className="muted">No recommendations found for your zone.</p>
            )}

            <div className="listBox">
              {recommendations.map((p) => (
                <button
                  key={p.id}
                  className={`listItem ${selected?.id === p.id ? "active" : ""}`}
                  onClick={() => setSelected(p)}
                  type="button"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontWeight: 700 }}>
                      {p.commonName || p.scientificName || p.id}
                    </span>
                    <span className="muted">
                      Zones {p.minZone}–{p.maxZone}
                    </span>
                  </div>

                  {p.scientificName && (
                    <div className="muted" style={{ marginTop: 4 }}>
                      {p.scientificName}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2 className="panelTitle">Selected Plant</h2>

            {!selected ? (
              <p className="muted">Click a plant to see details.</p>
            ) : (
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
                  {selected.commonName || selected.scientificName}
                </div>

                <div className="muted" style={{ marginBottom: 12 }}>
                  {selected.scientificName}
                </div>

                {selected.imageUrl && (
                  <img
                    src={selected.imageUrl}
                    alt={selected.commonName || selected.scientificName}
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      marginBottom: 12,
                      objectFit: "cover",
                    }}
                  />
                )}

                <p className="muted">Zones: {selected.minZone}–{selected.maxZone}</p>

                <p className="muted">
                  Sunlight:{" "}
                  {selected.sunlight?.category ||
                    (typeof selected.sunlight === "string" ? selected.sunlight : null) ||
                    "Unknown"}
                </p>

                <p className="muted">
                  Watering:{" "}
                  {selected.watering?.defaultEveryDays
                    ? `Every ${selected.watering.defaultEveryDays} days`
                    : selected.wateringFrequency
                      ? `Every ${selected.wateringFrequency} days`
                      : "Unknown"}
                </p>

                <p className="muted">{selected.reason}</p>

                <button
                  className="primaryBtn"
                  type="button"
                  onClick={() => addToGarden(selected)}
                  disabled={addedIds.has(selected.id)}
                  style={{ marginTop: 12, width: "100%" }}
                >
                  {addedIds.has(selected.id) ? "Added ✓" : "Add to My Garden"}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}