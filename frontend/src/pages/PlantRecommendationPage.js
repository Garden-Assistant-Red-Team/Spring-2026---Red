import React, { useEffect, useState } from "react";
import "./ToolLayout.css";
import { auth } from "../firebase";
import DashboardLayout from "../components/DashboardLayout";

const API_BASE = "http://localhost:5000";

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

function PlantCard({ plant, selected, onSelect }) {
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
          {plant.minZone != null && plant.maxZone != null && (
            <span className="recBadge">Zones {plant.minZone}–{plant.maxZone}</span>
          )}
          {plant.duration && <span className="recBadge">{plant.duration}</span>}
          {plant.pollinatorFriendly && <span className="recBadge">Pollinator</span>}
        </div>

        {plant.recommendation?.score != null && (
          <div className="recCardScore">Score {plant.recommendation.score}</div>
        )}
      </div>
    </button>
  );
}

function Section({ title, plants, selected, setSelected }) {
  return (
    <section className="panel recPanel">
      <div className="recSectionHeader">
        <h2 className="panelTitle">{title}</h2>
      </div>

      {!plants.length ? (
        <p className="muted">No plants found for this section.</p>
      ) : (
        <div className="recGrid">
          {plants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              selected={selected}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function PlantRecommendationPage() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedIds, setAddedIds] = useState(new Set());

  const [filters, setFilters] = useState({
    flower: false,
    tree: false,
    shrub: false,
    edible: false,
    pollinatorFriendly: false,
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) loadRecommendations();
      else {
        setData(null);
        setSelected(null);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      loadRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function loadRecommendations() {
    setLoading(true);
    setError("");

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const params = new URLSearchParams({
        uid,
        flower: String(filters.flower),
        tree: String(filters.tree),
        shrub: String(filters.shrub),
        edible: String(filters.edible),
        pollinatorFriendly: String(filters.pollinatorFriendly),
        nativeOnly: String(filters.nativeOnly),
      });

      const res = await fetch(`${API_BASE}/api/recommendations?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || "Failed to load recommendations");

      setData(json);

      const firstPlant =
        json?.sections?.bestSuited?.[0] ||
        json?.sections?.nativePlants?.[0] ||
        json?.sections?.zoneMatches?.[0] ||
        null;

      setSelected(firstPlant);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addToGarden(plant) {
    if (!auth.currentUser) return alert("You must be logged in.");

    const user = auth.currentUser;
    const uid = user.uid;

    try {
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE}/api/garden/${uid}/plants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: plant.commonName || plant.scientificName,
          commonName: plant.commonName || null,
          scientificName: plant.scientificName || null,
          minZone: plant.minZone ?? null,
          maxZone: plant.maxZone ?? null,
          sunlight: plant.sunlight || [],
          wateringProfile: plant.wateringProfile || null,
          wateringEveryDays: plant.wateringEveryDays ?? null,
          wateringFrequency: plant.wateringEveryDays ?? null,
          duration: plant.duration || null,
          imageUrl: plant.imageUrl || null,

          difficulty: plant.difficulty || null,
          fertilizeEveryDays: plant.fertilizeEveryDays ?? null,
          pruneEveryDays: plant.pruneEveryDays ?? null,
          repotEveryDays: plant.repotEveryDays ?? null,

          potType: plant.potType || null,
          soilType: plant.soilType || null,
          lighting: plant.lighting || null,
          humidity: plant.humidity || null,
          hibernation: plant.hibernation || null,
          temperatureMin: plant.temperatureMin ?? null,
          temperatureMax: plant.temperatureMax ?? null,

          source: "recommendations",
          plantId: plant.id,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to add plant");

      setAddedIds((prev) => new Set(prev).add(plant.id));
      alert(`${plant.commonName || plant.scientificName} added to your garden! 🌿`);
    } catch (e) {
      alert(e.message);
    }
  }

  function toggleFilter(key) {
    setFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  const bestSuited = data?.sections?.bestSuited || [];
  const nativePlants = data?.sections?.nativePlants || [];
  const zoneMatches = data?.sections?.zoneMatches || [];
  const userContext = data?.userContext || {};
  const sunlightLabel = prettySunlight(
    Array.isArray(userContext.sunlight) ? userContext.sunlight : [userContext.sunlight].filter(Boolean)
  );

  return (
    <DashboardLayout
      title="Plant Recommendations"
      subtitle="Find plants that fit your space, climate, and goals."
      badge={userContext.gardenZone ? `Zone ${userContext.gardenZone}` : "Recommendations"}
    >
      <div className="container">
        <section className="panel recHeroPanel">
          <div className="recHeroTop">
            <div>
              <h2 className="panelTitle">Your Garden Info</h2>
              <div className="recInfoRow">
                <span className="recInfoPill">Zone {userContext.gardenZone || "Unknown"}</span>
                {userContext.stateCode && (
                  <span className="recInfoPill">{userContext.stateCode}</span>
                )}
                {sunlightLabel && <span className="recInfoPill">{sunlightLabel}</span>}
              </div>
            </div>

            <div className="recFilterWrap">
              {[
                ["flower", "Flowers"],
                ["tree", "Trees"],
                ["shrub", "Shrubs"],
                ["edible", "Edible"],
                ["pollinatorFriendly", "Pollinator Friendly"],
                ["nativeOnly", "Native Only"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFilter(key)}
                  className={`recFilterChip ${filters[key] ? "active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}
          {loading && <p className="muted" style={{ marginTop: 10 }}>Loading recommendations...</p>}
        </section>

        <div className="recLayout">
          <div className="recMain">
            <Section
              title="Best Suited for You"
              plants={bestSuited}
              selected={selected}
              setSelected={setSelected}
            />
            <Section
              title="Native to Your State"
              plants={nativePlants}
              selected={selected}
              setSelected={setSelected}
            />
            <Section
              title="Matches Your Zone"
              plants={zoneMatches}
              selected={selected}
              setSelected={setSelected}
            />
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
                  <div><strong>Zones:</strong> {selected.minZone != null && selected.maxZone != null ? `${selected.minZone}–${selected.maxZone}` : "Unknown"}</div>
                  {prettySunlight(selected.sunlight) && (
                    <div><strong>Sunlight:</strong> {prettySunlight(selected.sunlight)}</div>
                  )}
                  {selected.duration && (
                    <div><strong>Duration:</strong> {selected.duration}</div>
                  )}
                  {selected.nativeStates?.length > 0 && (
                    <div><strong>Native States:</strong> {selected.nativeStates.join(", ")}</div>
                  )}
                </div>

                {selected.recommendation?.reasons?.length > 0 && (
                  <div className="recReasonBox">
                    <div className="recReasonTitle">Why it was recommended</div>
                    <ul className="recReasonList">
                      {selected.recommendation.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

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
                  onClick={() => addToGarden(selected)}
                  disabled={addedIds.has(selected.id)}
                  style={{ marginTop: 14, width: "100%" }}
                >
                  {addedIds.has(selected.id) ? "Added ✓" : "Add to My Garden"}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}