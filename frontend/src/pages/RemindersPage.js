import React, { useState } from "react";
import "./ToolLayout.css";

export default function RemindersPage() {
  const [reminders] = useState([
    { id: 1, title: "Water Basil", when: "Tomorrow 9:00 AM", type: "Watering" },
    { id: 2, title: "Prune Rosemary", when: "Sat", type: "Maintenance" },
    { id: 3, title: "Frost risk check", when: "Tonight", type: "Weather alert" },
  ]);

  return (
    <div className="toolPage">
      <h1 className="toolTitle">Reminders</h1>

      <div className="container">
        <div className="toolGrid" style={{ gridTemplateColumns: "1fr 1.2fr 1fr" }}>
          {/* LEFT: Create reminder (placeholder) */}
          <section className="panel">
            <h2 className="panelTitle">Create reminder</h2>

            <label className="field">
              <span>Title</span>
              <input placeholder="e.g., Water Basil" />
            </label>

            <label className="field">
              <span>When</span>
              <input placeholder="e.g., Tomorrow 9:00 AM" />
            </label>

            <label className="field">
              <span>Type</span>
              <input placeholder="Watering / Pruning / Weather" />
            </label>

            <button className="primaryBtn" type="button">
              Add reminder
            </button>

            <p className="muted" style={{ marginTop: 12 }}>
              Later this connects to scheduling + weather alerts.
            </p>
          </section>

          {/* CENTER: Reminder list */}
          <section className="panel">
            <h2 className="panelTitle">Upcoming</h2>

            <div className="listBox">
              {reminders.map((r) => (
                <button key={r.id} className="listItem" type="button">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>{r.title}</span>
                    <span style={{ opacity: 0.75, fontWeight: 500 }}>{r.type}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {r.when}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* RIGHT: Selected reminder details (placeholder) */}
          <section className="panel">
            <h2 className="panelTitle">Details</h2>
            <div className="imageBox">Calendar / Weather Widget Placeholder</div>
            <p className="muted">
              Future: show weather context (rain chance, frost risk) and allow snooze/complete.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}