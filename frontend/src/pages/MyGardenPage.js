import React, { useEffect, useState } from "react";
import "./ToolLayout.css";

import GardenCalendar from "../components/GardenCalendar";

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

export default function MyGardenPage() {
  const [plants, setPlants] = useState([]);
  const [notes, setNotes] = useState("");

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

  return (
    <div className="toolPage">
      <h1 className="toolTitle">My Garden</h1>

      <div className="container">
        <div className="toolGrid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
          {/* LEFT: Plant list */}
          <section className="panel">
            <h2 className="panelTitle">All Plants</h2>

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