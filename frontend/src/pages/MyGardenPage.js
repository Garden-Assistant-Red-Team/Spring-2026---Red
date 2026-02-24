import React, { useEffect, useState } from "react";
import "./ToolLayout.css";

import GardenCalendar from "../components/GardenCalendar";

<<<<<<< HEAD
// Firestore
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";

// Firebase
import { auth, db } from "../firebase";

// Notifications
import { requestNotificationPermission } from "../firebase-messaging";
=======
import { requestNotificationPermission } from "../firebase-messaging";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function MyGardenPage() {
  // ✅ Keep your team’s hardcoded demo plants
  const [plants] = useState([
    { id: 1, name: "Basil", status: "Healthy", nextTask: "Water tomorrow" },
    { id: 2, name: "Tomato", status: "Needs attention", nextTask: "Check leaves" },
    { id: 3, name: "Rosemary", status: "Healthy", nextTask: "Prune this week" },
  ]);
>>>>>>> 64ec885 (Added Firestore garden saving and dynamic My Garden list)

export default function MyGardenPage() {
  const [plants, setPlants] = useState([]);
  const [notes, setNotes] = useState("");

<<<<<<< HEAD
  // ✅ Load user's plants (real data)
  useEffect(() => {
    if (!auth.currentUser) {
      setPlants([]);
      return;
    }

    const q = query(
      collection(db, "users", auth.currentUser.uid, "myPlants"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPlants(list);
    });

    return () => unsub();
  }, []);

  // Ask for notification permission after user hits My Garden
=======
  // Recommendations
  const [recZone, setRecZone] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");

  // ✅ Saved plants pulled from Firestore via backend
  const [savedPlants, setSavedPlants] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");

  // 🔔 Ask for notification permission
>>>>>>> 64ec885 (Added Firestore garden saving and dynamic My Garden list)
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

  // ✅ Load recommendations
  useEffect(() => {
    async function loadRecommendations() {
      if (!auth.currentUser) return;

      setRecLoading(true);
      setRecError("");

      try {
        const uid = auth.currentUser.uid;
        const res = await fetch(`http://localhost:5000/api/recommendations?uid=${uid}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load recommendations");
        }

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

  // ✅ NEW: Load saved plants from backend (Firestore)
  async function loadSavedPlants() {
    try {
      if (!auth.currentUser) return;

      setSavedLoading(true);
      setSavedError("");

      const uid = auth.currentUser.uid;
      const res = await fetch(`http://localhost:5000/api/garden/${uid}/plants`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load saved plants");
      }

      setSavedPlants(Array.isArray(data) ? data : []);
    } catch (e) {
      setSavedError(String(e.message || e));
    } finally {
      setSavedLoading(false);
    }
  }

  // ✅ NEW: Load saved plants when page opens
  useEffect(() => {
    loadSavedPlants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Add recommended plant to user’s garden via backend
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

        plantId: p.id, // plantCatalog doc id like "trefle_101995"
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

      // ✅ NEW: refresh saved list so it appears immediately
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
          {/* LEFT: Plant list */}
          <section className="panel">
            <h2 className="panelTitle">All Plants</h2>

            {/* ✅ Your team’s hardcoded list stays exactly as-is */}
            <div className="listBox">
              {!auth.currentUser ? (
                <div className="muted" style={{ padding: 10 }}>
                  Please log in to see your garden plants.
                </div>
              ) : plants.length === 0 ? (
                <div className="muted" style={{ padding: 10 }}>
                  No plants yet. Add one from Resources → Plant Dictionary.
                </div>
              ) : (
                plants.map((p) => {
                  const displayName =
                    p.nickname || p.commonName || p.scientificName || "Unnamed plant";

                  const nextTask =
                    p.wateringEveryDays
                      ? `Water every ${p.wateringEveryDays} days`
                      : "No schedule yet";

                  return (
                    <button key={p.id} className="listItem" type="button">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span>{displayName}</span>
                        <span style={{ opacity: 0.75, fontWeight: 500 }}>
                          {p.status || "—"}
                        </span>
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        Next: {nextTask}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <p className="muted" style={{ marginTop: 12 }}>
              This page supports the “one screen to see all my plants” idea.
            </p>

            {/* ✅ NEW: Saved plants from Firestore */}
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "10px 0 6px", fontWeight: 700 }}>My Saved Plants</h3>

              {savedLoading && <p className="muted">Loading saved plants…</p>}
              {savedError && <p style={{ color: "crimson" }}>{savedError}</p>}

              {!savedLoading && !savedError && savedPlants.length === 0 && (
                <p className="muted">No saved plants yet. Add one below from recommendations.</p>
              )}

              {!savedLoading && !savedError && savedPlants.length > 0 && (
                <div className="listBox">
                  {savedPlants.map((p) => (
                    <div
                      key={p.id}
                      className="listItem"
                      style={{ cursor: "default" }}
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
                    </div>
                  ))}
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
          </section>

          {/* CENTER: Notes */}
          <section className="panel">
            <h2 className="panelTitle">Notes</h2>
            <p className="muted">Quick notes / observations (placeholder for now).</p>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Moved basil closer to window. Tomato leaves curling slightly..."
              style={{
                width: "100%",
                minHeight: 220,
                borderRadius: 14,
                border: "1px solid rgba(31,35,31,0.12)",
                padding: 12,
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button className="primaryBtn" type="button">
                Save note
              </button>
            </div>
          </section>

          {/* RIGHT: Checklist */}
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

        {/* Garden Calendar */}
        <div style={{ marginTop: 24 }}>
          <GardenCalendar />
        </div>
      </div>
    </div>
  );
}