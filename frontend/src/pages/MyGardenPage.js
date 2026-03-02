import React, { useEffect, useState } from "react";
import "./ToolLayout.css";

import GardenCalendar from "../components/GardenCalendar";
import PlantIdentifyUpload from "../components/PlantIdentifyUpload";

import { requestNotificationPermission } from "../firebase-messaging";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const API_BASE = "http://localhost:5000";

export default function MyGardenPage() {
  // Saved plants pulled from backend (Firestore via Express)
  const [savedPlants, setSavedPlants] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");

  // Notes panel state
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);

  // Recommendations
  const [recZone, setRecZone] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");

  // Checklist
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState("");
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newChecklistDue, setNewChecklistDue] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0]; // YYYY-MM-DD
  });

  // Derived selected plant
  const selectedPlant = savedPlants.find((p) => p.id === selectedPlantId) || null;

  //  Ask for notification permission on entry
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

  // ================= SAVED PLANTS =================

  async function loadSavedPlants() {
    try {
      if (!auth.currentUser) {
        setSavedPlants([]);
        setSavedError("");
        return;
      }

      setSavedLoading(true);
      setSavedError("");

      const uid = auth.currentUser.uid;
      const res = await fetch(`${API_BASE}/api/garden/${uid}/plants`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `Failed to load saved plants (${res.status})`);
      }

      setSavedPlants(Array.isArray(data) ? data : []);
    } catch (e) {
      setSavedError(String(e.message || e));
      setSavedPlants([]);
    } finally {
      setSavedLoading(false);
    }
  }

  // ================= CHECKLIST =================

  async function loadChecklist() {
    try {
      if (!auth.currentUser) {
        setChecklistItems([]);
        setChecklistError("");
        return;
      }

      setChecklistLoading(true);
      setChecklistError("");

      const uid = auth.currentUser.uid;
      const res = await fetch(`${API_BASE}/api/checklist/${uid}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load checklist");

      setChecklistItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setChecklistError(String(e.message || e));
      setChecklistItems([]);
    } finally {
      setChecklistLoading(false);
    }
  }

  async function addChecklistItem() {
    const text = newChecklistText.trim();
    if (!text) return;

    if (!auth.currentUser) return alert("You must be logged in.");

    const uid = auth.currentUser.uid;

    const body = {
      text,
      dueDate: newChecklistDue || null,
      done: false,
      plantInstanceId: selectedPlantId || null,
    };

    const res = await fetch(`${API_BASE}/api/checklist/${uid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Failed to add checklist item");

    setNewChecklistText("");
    await loadChecklist();
  }

  async function toggleChecklistDone(itemId, done) {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const res = await fetch(`${API_BASE}/api/checklist/${uid}/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || "Failed to update checklist item");

    await loadChecklist();
  }

  async function deleteChecklistItem(itemId) {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const res = await fetch(`${API_BASE}/api/checklist/${uid}/${itemId}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || "Failed to delete checklist item");

    await loadChecklist();
  }

  // Load saved plants + checklist on mount
  useEffect(() => {
    loadSavedPlants();
    loadChecklist();
  }, []);

  // Auto-select first saved plant when list loads
  useEffect(() => {
    if (!selectedPlantId && savedPlants.length > 0) {
      setSelectedPlantId(savedPlants[0].id);
    }
  }, [savedPlants, selectedPlantId]);

  // Clear note editor when switching plants
  useEffect(() => {
    setNoteDraft("");
    setEditingIndex(null);
  }, [selectedPlantId]);

  // ================= RECOMMENDATIONS =================

  useEffect(() => {
    async function loadRecommendations() {
      if (!auth.currentUser) return;

      setRecLoading(true);
      setRecError("");

      try {
        const uid = auth.currentUser.uid;
        const res = await fetch(`${API_BASE}/api/recommendations?uid=${uid}`);
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

  // Add plant to garden via backend
  async function addToGarden(p) {
    try {
      if (!auth.currentUser) {
        alert("You must be logged in.");
        return;
      }

      const uid = auth.currentUser.uid;

      const body = {
        name: p.scientificName || p.commonName || p.name || p.id,
        commonName: p.commonName || null,
        scientificName: p.scientificName || null,

        plantId: p.id || p.plantId || null,
        trefle_id:
          typeof p.trefle_id === "number"
            ? p.trefle_id
            : typeof p.trefleId === "number"
              ? p.trefleId
              : null,
        minZone: typeof p.minZone === "number" ? p.minZone : null,
        maxZone: typeof p.maxZone === "number" ? p.maxZone : null,
        sunlight: p.sunlight || null,
        wateringFrequency: p.wateringFrequency || null,
        reason: p.reason || null,

        source: p.source || "recommendations",
        confidence: typeof p.confidence === "number" ? p.confidence : null,
        photoUrl: p.photoUrl || null,
      };

      const res = await fetch(`${API_BASE}/api/garden/${uid}/plants`, {
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

  // Delete plant from "My Garden"
  async function deletePlant(plantDocId) {
    if (!auth.currentUser) {
      alert("You must be logged in.");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to remove this plant from your garden?"
    );
    if (!confirmDelete) return;

    try {
      const uid = auth.currentUser.uid;

      const res = await fetch(`${API_BASE}/api/garden/${uid}/plants/${plantDocId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "Failed to delete plant.");
        return;
      }

      if (plantDocId === selectedPlantId) {
        setSelectedPlantId(null);
      }

      await loadSavedPlants();
    } catch (err) {
      console.error(err);
      alert("Server error while deleting plant.");
    }
  }

  // NOTES: add / edit / delete
  async function addNote(plantDocId) {
    const text = noteDraft.trim();
    if (!text) return;

    if (!auth.currentUser) return alert("You must be logged in.");
    const uid = auth.currentUser.uid;

    const res = await fetch(`${API_BASE}/api/garden/${uid}/plants/${plantDocId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Failed to add note");

    setNoteDraft("");
    await loadSavedPlants();
  }

  async function saveEdit(plantDocId, index) {
    const text = noteDraft.trim();
    if (!text) return;

    if (!auth.currentUser) return alert("You must be logged in.");
    const uid = auth.currentUser.uid;

    const res = await fetch(`${API_BASE}/api/garden/${uid}/plants/${plantDocId}/notes/${index}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Failed to edit note");

    setEditingIndex(null);
    setNoteDraft("");
    await loadSavedPlants();
  }

  async function deleteNote(plantDocId, index) {
    if (!auth.currentUser) return alert("You must be logged in.");
    const uid = auth.currentUser.uid;

    const res = await fetch(`${API_BASE}/api/garden/${uid}/plants/${plantDocId}/notes/${index}`, {
      method: "DELETE",
    });

    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Failed to delete note");

    await loadSavedPlants();
  }

  return (
    <div className="toolPage">
      <h1 className="toolTitle">My Garden</h1>

      <div className="container">
        <div className="toolGrid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
          {/* LEFT */}
          <section className="panel">
            <h2 className="panelTitle">My Saved Plants</h2>

            {!auth.currentUser && <p className="muted">Log in to load your saved plants.</p>}
            {auth.currentUser && savedLoading && <p className="muted">Loading saved plants…</p>}
            {auth.currentUser && savedError && <p style={{ color: "crimson" }}>{savedError}</p>}

            {auth.currentUser && !savedLoading && !savedError && savedPlants.length === 0 && (
              <p className="muted">No saved plants yet. Add one below from recommendations.</p>
            )}

            {auth.currentUser && !savedLoading && !savedError && savedPlants.length > 0 && (
              <div className="listBox" style={{ marginBottom: 14 }}>
                {savedPlants.map((p) => {
                  const isSelected = p.id === selectedPlantId;
                  return (
                    <button
                      key={p.id}
                      className={`listItem ${isSelected ? "active" : ""}`}
                      type="button"
                      onClick={() => setSelectedPlantId(p.id)}
                      style={{ cursor: "pointer", textAlign: "left" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {p.commonName || p.name || "Unnamed plant"}
                          </div>

                          {p.scientificName && (
                            <div className="muted" style={{ marginTop: 4 }}>
                              {p.scientificName}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 6,
                          }}
                        >
                          <span style={{ opacity: 0.75 }}>
                            Zones {p.minZone ?? "?"}–{p.maxZone ?? "?"}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation(); // don't select when deleting
                              deletePlant(p.id);
                            }}
                            style={{
                              background: "rgba(200,60,60,0.15)",
                              border: "1px solid rgba(200,60,60,0.4)",
                              color: "#8a1f1f",
                              borderRadius: 10,
                              padding: "4px 8px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Recommendations */}
            <div style={{ marginTop: 8 }}>
              <h3 style={{ margin: "12px 0 8px", fontWeight: 800 }}>
                Recommended {recZone ? `for Zone ${recZone}` : ""}
              </h3>

              {!auth.currentUser && <p className="muted">Log in to load recommendations.</p>}
              {auth.currentUser && recLoading && <p className="muted">Loading recommendations…</p>}
              {auth.currentUser && recError && <p style={{ color: "crimson" }}>{recError}</p>}
              {auth.currentUser && !recLoading && !recError && recommendations.length === 0 && (
                <p className="muted">No recommendations yet.</p>
              )}

              <div style={{ display: "grid", gap: 12 }}>
                {recommendations.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: "1px solid rgba(31,35,31,0.10)",
                      borderRadius: 16,
                      padding: 12,
                      background: "rgba(255,255,255,0.75)",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
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
                      <button className="primaryBtn" type="button" onClick={() => addToGarden(p)}>
                        Add to My Garden
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plant Identification Upload */}
            <div style={{ marginTop: 18 }}>
              <h3 style={{ margin: "14px 0 8px", fontWeight: 800 }}>
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
                  <div style={{ fontWeight: 850 }}>
                    {selectedPlant.commonName || selectedPlant.name || "Unnamed plant"}
                  </div>
                  {selectedPlant.scientificName && (
                    <div className="muted">{selectedPlant.scientificName}</div>
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: "10px 0 6px", fontWeight: 800 }}>Saved Notes</h3>

                  {Array.isArray(selectedPlant.notes) && selectedPlant.notes.length > 0 ? (
                    <div className="listBox">
                      {selectedPlant.notes.map((n, idx) => {
                        const text = typeof n === "string" ? n : n?.text || "";
                        return (
                          <div
                            key={idx}
                            className="listItem"
                            style={{
                              cursor: "default",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <span>{text}</span>

                            <span style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                className="primaryBtn"
                                style={{ padding: "8px 10px" }}
                                onClick={() => {
                                  setEditingIndex(idx);
                                  setNoteDraft(text);
                                }}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="primaryBtn"
                                style={{ padding: "8px 10px" }}
                                onClick={() => deleteNote(selectedPlant.id, idx)}
                              >
                                Delete
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted">No notes yet.</p>
                  )}
                </div>

                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Type a note for this plant..."
                  style={{
                    width: "100%",
                    minHeight: 140,
                    borderRadius: 16,
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

            {!auth.currentUser ? (
              <p className="muted">Log in to view and edit your checklist.</p>
            ) : (
              <>
                {checklistLoading && <p className="muted">Loading checklist…</p>}
                {checklistError && <p style={{ color: "crimson" }}>{checklistError}</p>}

                {/* Add new item */}
                <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                  <input
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    placeholder="Add a checklist item…"
                    style={{
                      width: "100%",
                      borderRadius: 16,
                      border: "1px solid rgba(31,35,31,0.12)",
                      padding: 12,
                    }}
                  />

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <label className="muted" style={{ fontSize: 12 }}>
                      Due:
                    </label>
                    <input
                      type="date"
                      value={newChecklistDue}
                      onChange={(e) => setNewChecklistDue(e.target.value)}
                      style={{
                        borderRadius: 14,
                        border: "1px solid rgba(31,35,31,0.12)",
                        padding: 10,
                      }}
                    />

                    <button className="primaryBtn" type="button" onClick={addChecklistItem}>
                      Add checklist item
                    </button>
                  </div>

                  <p className="muted" style={{ margin: 0 }}>
                    {selectedPlantId ? "Adding for selected plant." : "No plant selected — item will be general."}
                  </p>
                </div>

                {/* List items */}
                <div className="listBox">
                  {!checklistLoading && !checklistError && checklistItems.length === 0 && (
                    <p className="muted" style={{ padding: 10 }}>
                      No checklist items yet.
                    </p>
                  )}

                  {checklistItems.map((item) => (
                    <div
                      key={item.id}
                      className="listItem"
                      style={{ cursor: "default", display: "flex", gap: 10, alignItems: "flex-start" }}
                    >
                      <input
                        type="checkbox"
                        checked={!!item.done}
                        onChange={(e) => toggleChecklistDone(item.id, e.target.checked)}
                        style={{ marginTop: 4 }}
                      />

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, textDecoration: item.done ? "line-through" : "none" }}>
                          {item.text}
                        </div>

                        <div className="muted" style={{ marginTop: 4 }}>
                          {item.dueDate ? `Due: ${item.dueDate}` : "No due date"}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="primaryBtn"
                        style={{ padding: "8px 10px" }}
                        onClick={() => deleteChecklistItem(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        {/* Calendar panel */}
        <section className="panel" style={{ marginTop: 18, maxHeight: "520px", overflowY: "auto" }}>
          <h2 className="panelTitle">Garden Calendar</h2>
          <GardenCalendar />
        </section>
      </div>
    </div>
  );
}