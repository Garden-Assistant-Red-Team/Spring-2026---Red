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
  const [plants, setPlants] = useState([]);
  const [plantId, setPlantId] = useState("");
  const [frequency, setFrequency] = useState("weekly");

  function toDate(dueAtValue) {
    if (!dueAtValue) return null;
    if (dueAtValue instanceof Date) return dueAtValue;
    if (dueAtValue?._seconds) return new Date(dueAtValue._seconds * 1000);
    return new Date(dueAtValue);
  }

  function isWithinNextDays(dueAtValue, days = 7) {
    const d = toDate(dueAtValue);
    if (!d || Number.isNaN(d.getTime())) return false;

    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    return d >= now && d <= end;
  }

  function displayFrequencyLabel(r) {
    if (r?.frequency) return r.frequency;
    const d = r?.recurrence?.everyDays;
    if (!d) return "";
    if (d === 1) return "daily";
    if (d === 2) return "every2days";
    if (d === 7) return "weekly";
    if (d === 14) return "biweekly";
    if (d === 30) return "monthly";
    return `every ${d} days`;
  }

  function expandRecurringForDays(reminder, daysAhead = 7) {
    const baseDue = toDate(reminder.dueAt);
    if (!baseDue || Number.isNaN(baseDue.getTime())) return [];

    const every = reminder?.recurrence?.everyDays
      ? Number(reminder.recurrence.everyDays)
      : null;

    const lastCompleted = toDate(reminder.lastCompletedAt);
    const lastSkipped = toDate(reminder.lastSkippedAt);
    const lastAction =
      lastCompleted && lastSkipped
        ? (lastCompleted > lastSkipped ? lastCompleted : lastSkipped)
        : (lastCompleted || lastSkipped || null);

    // Non-recurring: return as-is
    if (!every || !Number.isFinite(every) || every <= 0) {
      return [{ ...reminder, _virtualKey: reminder.id, _occurrenceDueAtISO: baseDue.toISOString() }];
    }

    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);

    let d = new Date(baseDue);
  
    const cutoff = lastAction && lastAction > now ? lastAction : (lastAction || now);

    while (d <= cutoff) d.setDate(d.getDate() + every);

    const out = [];
    let safety = 0;

    while (d <= end && safety < 200) {
      out.push({
        ...reminder,
        dueAt: new Date(d),
        _virtualKey: `${reminder.id}-${d.toISOString()}`,
        _isVirtual: true,
        _occurrenceDueAtISO: d.toISOString(), // <-- send this to backend
      });
      d.setDate(d.getDate() + every);
      safety++;
    }

    return out;
  }

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
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadPlants() {
    if (!auth.currentUser) return;

    try {
      const uid = auth.currentUser.uid;
      const res = await fetch(`${API_BASE}/api/garden/${uid}/plants`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load plants");
      setPlants(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load plants:", e);
      setPlants([]);
    }
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadReminders();
        loadPlants();
      } else {
        setReminders([]);
        setPlants([]);
        setSelected(null);
      }
    });
    return () => unsubscribe();
  }, []);

  async function handleSubmit() {
    if (!plantId) return alert("Please select a plant.");
    if (!title || !dueAt) return alert("Please fill in title and due date.");
    if (!auth.currentUser) return alert("You must be logged in.");

    setSubmitting(true);
    try {
      const uid = auth.currentUser.uid;

      const res = await fetch(`${API_BASE}/api/reminders/${uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          dueAt,
          type,
          plantInstanceId: plantId,
          frequency,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create reminder");

      setTitle("");
      setDueAt("");
      setType("water");
      setFrequency("weekly");

      await loadReminders();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // send occurrenceDueAt for recurring reminders
  async function updateStatus(reminderId, status, occurrenceDueAtISO) {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;

    const body = { status };
    if (occurrenceDueAtISO) body.occurrenceDueAt = occurrenceDueAtISO;

    const res = await fetch(`${API_BASE}/api/reminders/${uid}/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSelected(null);
      await loadReminders();
    }
  }
async function deleteReminder(reminderId) {
  if (!auth.currentUser) return;

  const uid = auth.currentUser.uid;
  const res = await fetch(`${API_BASE}/api/reminders/${uid}/${reminderId}`, {
    method: "DELETE",
  });

  if (res.ok) {
    setSelected(null);
    await loadReminders();
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data?.error || "Failed to delete reminder");
  }
}

  function formatDue(dueAtValue) {
    const date = toDate(dueAtValue);
    if (!date || Number.isNaN(date.getTime())) return "Unknown";

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function getPlantNameFromReminder(r) {
    if (!r?.plantInstanceId) return "";
    const p = plants.find((x) => x.id === r.plantInstanceId);
    return p ? (p.commonName || p.name || "") : "";
  }

  // Build Upcoming list
  const upcomingItems = reminders
    .filter((r) => r.status === "pending")
    .flatMap((r) => expandRecurringForDays(r, 7))
    .filter((r) => isWithinNextDays(r.dueAt, 7))
    .sort((a, b) => {
      const da = toDate(a.dueAt);
      const db = toDate(b.dueAt);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });

  return (
    <div className="toolPage">
      <h1 className="toolTitle">Reminders</h1>

      <div className="container">
        <div className="toolGrid" style={{ gridTemplateColumns: "1fr 1.2fr 1fr" }}>
          {/* LEFT */}
          <section className="panel">
            <h2 className="panelTitle">Create reminder</h2>

            <label className="field">
              <span>Plant</span>
              <select value={plantId} onChange={(e) => setPlantId(e.target.value)}>
                <option value="">Select plant</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.commonName || p.name || "Unnamed plant"}
                  </option>
                ))}
              </select>
            </label>

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

            <label className="field">
              <span>Frequency</span>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="every2days">Every 2 days</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
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

          {/* CENTER */}
          <section className="panel">
            <h2 className="panelTitle">Upcoming</h2>

            {!auth.currentUser && <p className="muted">Log in to view reminders.</p>}
            {loading && <p className="muted">Loading...</p>}
            {error && <p style={{ color: "crimson" }}>{error}</p>}

            <div className="listBox">
              {upcomingItems.map((r) => {
                const plantName = r.plantName || getPlantNameFromReminder(r);
                const freqLabel = displayFrequencyLabel(r);

                return (
                  <button
                    key={r._virtualKey || r.id}
                    className="listItem"
                    type="button"
                    onClick={() => setSelected(r)}
                    style={{
                      border:
                        (selected?._virtualKey && selected._virtualKey === r._virtualKey) ||
                        (!selected?._virtualKey && selected?.id === r.id)
                          ? "2px solid #2F6B4F"
                          : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span>
                        {r.title}
                        {plantName ? (
                          <span className="muted" style={{ marginLeft: 8 }}>
                            • {plantName}
                          </span>
                        ) : null}
                      </span>
                      <span style={{ opacity: 0.75, fontWeight: 500 }}>{r.type}</span>
                    </div>

                    <div className="muted" style={{ marginTop: 6 }}>
                      {formatDue(r.dueAt)}
                      {freqLabel ? (
                        <span className="muted" style={{ marginLeft: 10 }}>
                          • {freqLabel}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {!loading && !error && auth.currentUser && upcomingItems.length === 0 && (
              <p className="muted" style={{ marginTop: 10 }}>
                No reminders due in the next 7 days.
              </p>
            )}
          </section>

          {/* RIGHT */}
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

                {displayFrequencyLabel(selected) && (
                  <div className="muted" style={{ marginBottom: 10 }}>
                    Frequency: {displayFrequencyLabel(selected)}
                  </div>
                )}

                {(selected.plantName || selected.plantInstanceId) && (
                  <div className="muted" style={{ marginBottom: 10 }}>
                    Plant:{" "}
                    {selected.plantName ||
                      getPlantNameFromReminder(selected) ||
                      selected.plantInstanceId}
                  </div>
                )}

                <div className="muted" style={{ marginBottom: 16 }}>
                  Source: {selected.source}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={() =>
                      updateStatus(
                        selected.id,
                        "done",
                        selected._occurrenceDueAtISO || toDate(selected.dueAt)?.toISOString()
                      )
                    }
                  >
                    Mark done
                  </button>

                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={() =>
                      updateStatus(
                        selected.id,
                        "skipped",
                        selected._occurrenceDueAtISO || toDate(selected.dueAt)?.toISOString()
                      )
                    }
                  >
                    Skip
                  </button>
                  <button
    className="primaryBtn"
    type="button"
    onClick={() => {
      const isRecurring = Boolean(selected?.recurrence?.everyDays);
      const msg = isRecurring
        ? "Delete this reminder series? This removes all future occurrences."
        : "Delete this reminder?";
      if (window.confirm(msg)) deleteReminder(selected.id);
    }}
    style={{ background: "#B00020" }}
  >
    {selected?.recurrence?.everyDays ? "Delete series" : "Delete reminder"}
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