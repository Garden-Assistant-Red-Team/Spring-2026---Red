import React, { useEffect, useState } from "react";
import "./ToolLayout.css";

import GardenCalendar from "../components/GardenCalendar";

import { requestNotificationPermission } from "../firebase-messaging";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import PlantIdentifyUpload from "../components/PlantIdentifyUpload";

export default function MyGardenPage() {

  const [plants] = useState([
    { id: 1, name: "Basil", status: "Healthy", nextTask: "Water tomorrow" },
    { id: 2, name: "Tomato", status: "Needs attention", nextTask: "Check leaves" },
    { id: 3, name: "Rosemary", status: "Healthy", nextTask: "Prune this week" },
  ]);

  const [notes, setNotes] = useState("");

  // Recommendations
  const [recZone, setRecZone] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");

  const [savedPlants, setSavedPlants] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");

  useEffect(() => {
    async function setupNotifications() {
      if (!auth.currentUser) return;

      const token = await requestNotificationPermission();
      if (!token) return;

      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        fcmToken: token,
      });
    }

    setupNotifications();
  }, []);

  useEffect(() => {
    async function loadRecommendations() {
      if (!auth.currentUser) return;

      setRecLoading(true);
      setRecError("");

      try {
        const uid = auth.currentUser.uid;
        const res = await fetch(`http://localhost:5000/api/recommendations?uid=${uid}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to load recommendations");

        setRecZone(data.zone || "");
        setRecommendations(data.recommendations || []);
      } catch (e) {
        setRecError(String(e.message || e));
      } finally {
        setRecLoading(false);
      }
    }

    loadRecommendations();
  }, []);

  async function loadSavedPlants() {
    try {
      if (!auth.currentUser) return;

      setSavedLoading(true);
      setSavedError("");

      const uid = auth.currentUser.uid;
      const res = await fetch(`http://localhost:5000/api/garden/${uid}/plants`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || `Failed to load saved plants (${res.status})`);

      setSavedPlants(Array.isArray(data) ? data : []);
    } catch (e) {
      setSavedError(String(e.message || e));
      setSavedPlants([]);
    } finally {
      setSavedLoading(false);
    }
  }


  useEffect(() => {
    loadSavedPlants();

  }, []);

  async function addToGarden(p) {
    try {
      if (!auth.currentUser) {
        alert("You must be logged in.");
        return;
      }

      const uid = auth.currentUser.uid;

      const body = {
        name: p.scientificName || p.commonName || p.id,
        commonName: p.commonName || null,
        scientificName: p.scientificName || null,

        plantId: p.id, 
        trefle_id: typeof p.trefle_id === "number" ? p.trefle_id : null,
        minZone: typeof p.minZone === "number" ? p.minZone : null,
        maxZone: typeof p.maxZone === "number" ? p.maxZone : null,
        sunlight: p.sunlight || null,
        wateringFrequency: p.wateringFrequency || null,
        reason: p.reason || null,
        source: "recommendations",
        confidence: null,
        photoUrl: null,
      };

      const res = await fetch(`http://localhost:5000/api/garden/${uid}/plants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to add plant");
        return;
      }

      alert("Added to My Garden 🌿");

    
      await loadSavedPlants();
    } catch (e) {
      console.error(e);
      alert("Server error while adding plant.");
    }
  }

  return (
    <div className="toolPage">
      <h1 className="toolTitle">My Garden</h1>

      <div className="container">
        <div className="toolGrid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
          {/* LEFT */}
          <section className="panel">
            <h2 className="panelTitle">All Plants</h2>

            
            <div className="listBox">
              {plants.map((p) => (
                <button key={p.id} className="listItem" type="button">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>{p.name}</span>
                    <span style={{ opacity: 0.75, fontWeight: 500 }}>{p.status}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Next: {p.nextTask}
                  </div>
                </button>
              ))}
            </div>

            <p className="muted" style={{ marginTop: 12 }}>
              This page supports the “one screen to see all my plants” idea.
            </p>

            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "10px 0 6px", fontWeight: 700 }}>My Saved Plants</h3>

              {savedLoading && <p className="muted">Loading saved plants…</p>}
              {savedError && <p style={{ color: "crimson" }}>{savedError}</p>}

              {!savedLoading && !savedError && savedPlants.length === 0 && (
                <p className="muted">No saved plants yet. Add one below from recommendations.</p>
              )}

              {!savedLoading && !savedError && savedPlants.length > 0 && (
                <div className="listBox">
                  {savedPlants.map((p) => {
                    const isSelected = p.id === selectedPlantId;
                    return (
                      <button
                        key={p.id}
                        className="listItem"
                        type="button"
                        onClick={() => setSelectedPlantId(p.id)}
                        style={{
                          cursor: "pointer",
                          border: isSelected ? "2px solid #2F6B4F" : undefined,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ fontWeight: 700 }}>
                            {p.commonName || p.name || "Unnamed plant"}
                          </span>
                          <span style={{ opacity: 0.75 }}>
                            Zones {p.minZone ?? "?"}–{p.maxZone ?? "?"}
                          </span>
                        </div>

                        {p.scientificName && (
                          <div className="muted" style={{ marginTop: 6 }}>
                            {p.scientificName}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "10px 0 6px", fontWeight: 700 }}>
                Recommended {recZone ? `for Zone ${recZone}` : ""}
              </h3>

              {recLoading && <p className="muted">Loading recommendations…</p>}
              {recError && <p style={{ color: "crimson" }}>{recError}</p>}

              {!recLoading && !recError && recommendations.length === 0 && (
                <p className="muted">No recommendations yet.</p>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                {recommendations.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: "1px solid rgba(31,35,31,0.12)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(255,255,255,0.75)",
                    }}
                  >
                    <div style={{ fontWeight: 750 }}>
                      {p.commonName || p.scientificName || p.id}
                    </div>

                    {p.scientificName && (
                      <div className="muted" style={{ marginTop: 2 }}>
                        {p.scientificName}
                      </div>
                    )}

                    <div className="muted" style={{ marginTop: 6 }}>
                      Zones {p.minZone}–{p.maxZone}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                      <button className="add-btn" onClick={() => addToGarden(p)}>
                        Add to My Garden
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Plant Identification Upload */}
<div style={{ marginTop: 24 }}>
  <h3 style={{ margin: "14px 0 8px", fontWeight: 700 }}>
    Identify a Plant from Photo
  </h3>

  <PlantIdentifyUpload onAddToGarden={addToGarden} />
</div>
          </section>

          {/* CENTER */}
          <section className="panel">
            <h2 className="panelTitle">Notes</h2>

            {!auth.currentUser ? (
              <p className="muted">Log in to view and edit notes.</p>
            ) : !selectedPlant ? (
              <p className="muted">Click a saved plant to view notes.</p>
            ) : (
              <>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 800 }}>
                    {selectedPlant.commonName || selectedPlant.name || "Unnamed plant"}
                  </div>
                  {selectedPlant.scientificName && (
                    <div className="muted">{selectedPlant.scientificName}</div>
                  )}
                </div>

                {/* Existing notes list */}
                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: "10px 0 6px", fontWeight: 700 }}>Saved Notes</h3>

                  {Array.isArray(selectedPlant.notes) && selectedPlant.notes.length > 0 ? (
                    <div className="listBox">
                      {selectedPlant.notes.map((n, idx) => (
                        <div key={idx} className="listItem" style={{ cursor: "default" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <span>{typeof n === "string" ? n : n.text}</span>

                            <span style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                className="primaryBtn"
                                style={{ padding: "6px 10px" }}
                                onClick={() => {
                                  setEditingIndex(idx);
                                  setNoteDraft(typeof n === "string" ? n : n.text);
                                }}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="primaryBtn"
                                style={{ padding: "6px 10px" }}
                                onClick={() => deleteNote(selectedPlant.id, idx)}
                              >
                                Delete
                              </button>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No notes yet.</p>
                  )}
                </div>

                {/* Add / edit note */}
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Type a note for this plant..."
                  style={{
                    width: "100%",
                    minHeight: 140,
                    borderRadius: 14,
                    border: "1px solid rgba(31,35,31,0.12)",
                    padding: 12,
                    resize: "vertical",
                  }}
                />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  {editingIndex !== null && (
                    <button
                      className="primaryBtn"
                      type="button"
                      onClick={() => {
                        setEditingIndex(null);
                        setNoteDraft("");
                      }}
                    >
                      Cancel
                    </button>
                  )}

                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={() => {
                      if (editingIndex === null) addNote(selectedPlant.id);
                      else saveEdit(selectedPlant.id, editingIndex);
                    }}
                  >
                    {editingIndex === null ? "Add note" : "Save changes"}
                  </button>
                </div>
              </>
            )}
          </section>

          {/* RIGHT */}
          <section className="panel">
            <h2 className="panelTitle">Checklist</h2>
            <p className="muted">“Notes and custom checklists” placeholder.</p>

            <div className="issueBox">
              <h3 style={{ margin: 0, fontWeight: 650 }}>Today</h3>
              <p className="muted">☐ Water Basil</p>
              <p className="muted">☐ Inspect Tomato leaves</p>
              <p className="muted">☐ Check forecast for frost</p>
            </div>

            <button className="primaryBtn" type="button">
              Add checklist item
            </button>
          </section>
        </div>

        {/* 🌱 Garden Calendar */}
        <div style={{ marginTop: 24 }}>
          <GardenCalendar />
        </div>
      </div>
    </div>
  );
}