import React, { useState } from "react";
import "./ToolLayout.css";
import GardenCalendar from "../components/GardenCalendar";

export default function MyGardenPage() {
  const [plants] = useState([
    { id: 1, name: "Basil", status: "Healthy", nextTask: "Water tomorrow" },
    { id: 2, name: "Tomato", status: "Needs attention", nextTask: "Check leaves" },
    { id: 3, name: "Rosemary", status: "Healthy", nextTask: "Prune this week" },
  ]);

  const [notes, setNotes] = useState("");

  return (
    <div className="toolPage">
      <h1 className="toolTitle">My Garden</h1>

      <div className="container">
        <div className="toolGrid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
          {/* LEFT: Plant list */}
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

          {/* RIGHT: Checklist (placeholder) */}
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