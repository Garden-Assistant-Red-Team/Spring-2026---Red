import React, { useState, useEffect } from "react";
import "./ToolLayout.css";
import { auth } from "../firebase";

const API_BASE = "http://localhost:5000";

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [type, setType] = useState("water");
  const [submitting, setSubmitting] = useState(false);

  // Load reminders
  async function loadReminders() {
    if (!auth.currentUser) return;
    setLoading(true);
    setError("");
    try {
      const uid = auth.currentUser.uid;
      const res = await fetch(`${API_BASE}/api/reminders/${uid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load reminders");
      setReminders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) loadReminders();
      else setReminders([]);
    });
    return () => unsubscribe();
  }, []);

  // Create manual reminder
  async function handleSubmit() {
    if (!title || !dueAt) {
      alert("Please fill in title and due date.");
      return;
    }
    if (!auth.currentUser) return alert("You must be logged in.");

    setSubmitting(true);
    try {
      const uid = auth.currentUser.uid;
      const res = await fetch(`${API_BASE}/api/reminders/${uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueAt, type, plantInstanceId: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create reminder");
      setTitle("");
      setDueAt("");
      setType("water");
      await loadReminders();
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Mark reminder as done or skipped
  async function updateStatus(reminderId, status) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const res = await fetch(`${API_BASE}/api/reminders/${uid}/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await loadReminders();
  }

  // Format timestamp for display
  function formatDue(dueAt) {
    if (!dueAt) return "Unknown";
    const date = dueAt?._seconds
      ? new Date(dueAt._seconds * 1000)
      : new Date(dueAt);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="toolPage">
      <h1 className="toolTitle">Reminders</h1>

      <div className="container">
        <div className="toolGrid" style={{ gridTemplateColumns: "1fr 1.2fr 1fr" }}>

          {/* LEFT: Create reminder */}
          <section className="panel">
            <h2 className="panelTitle">Create reminder</h2>

            <label className="field">
              <span>Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Prune rose bush"
              />
            </label>

            <label className="field">
              <span>Due date</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="water">Water</option>
                <option value="fertilize">Fertilize</option>
                <option value="prune">Prune</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <button
              className="primaryBtn"
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Adding..." : "Add reminder"}
            </button>
          </section>

          {/* CENTER: Reminder list */}
          <section className="panel">
            <h2 className="panelTitle">Upcoming</h2>

            {!auth.currentUser && <p className="muted">Log in to view reminders.</p>}
            {loading && <p className="muted">Loading...</p>}
            {error && <p style={{ color: "crimson" }}>{error}</p>}

            {!loading && !error && reminders.length === 0 && auth.currentUser && (
              <p className="muted">No reminders yet.</p>
            )}

            <div className="listBox">
              {reminders
                .filter((r) => r.status === "pending")
                .map((r) => (
                  <button
                    key={r.id}
                    className="listItem"
                    type="button"
                    onClick={() => setSelected(r)}
                    style={{
                      border: selected?.id === r.id ? "2px solid #2F6B4F" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span>{r.title}</span>
                      <span style={{ opacity: 0.75, fontWeight: 500 }}>{r.type}</span>
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {formatDue(r.dueAt)}
                    </div>
                  </button>
                ))}
            </div>
          </section>

          {/* RIGHT: Selected reminder details */}
          <section className="panel">
            <h2 className="panelTitle">Details</h2>

            {!selected ? (
              <p className="muted">Click a reminder to see details.</p>
            ) : (
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
                  {selected.title}
                </div>
                <div className="muted" style={{ marginBottom: 10 }}>
                  Due: {formatDue(selected.dueAt)}
                </div>
                <div className="muted" style={{ marginBottom: 10 }}>
                  Type: {selected.type}
                </div>
                <div className="muted" style={{ marginBottom: 16 }}>
                  Source: {selected.source}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={() => updateStatus(selected.id, "done")}
                  >
                    Mark done
                  </button>
                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={() => updateStatus(selected.id, "skipped")}
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}