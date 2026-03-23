import React, { useEffect, useMemo, useState } from "react";
import "./ToolLayout.css";
import { auth } from "../firebase";
import DashboardLayout from "../components/DashboardLayout";

const API_BASE = "http://localhost:5000";

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

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
        ? lastCompleted > lastSkipped
          ? lastCompleted
          : lastSkipped
        : lastCompleted || lastSkipped || null;

    if (!every || !Number.isFinite(every) || every <= 0) {
      return [
        {
          ...reminder,
          _virtualKey: reminder.id,
          _occurrenceDueAtISO: baseDue.toISOString(),
        },
      ];
    }

    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);

    let d = new Date(baseDue);
    const cutoff = lastAction && lastAction > now ? lastAction : lastAction || now;

    while (d <= cutoff) d.setDate(d.getDate() + every);

    const out = [];
    let safety = 0;

    while (d <= end && safety < 200) {
      out.push({
        ...reminder,
        dueAt: new Date(d),
        _virtualKey: `${reminder.id}-${d.toISOString()}`,
        _isVirtual: true,
        _occurrenceDueAtISO: d.toISOString(),
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
      setPlantId("");

      await loadReminders();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

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
    return p ? p.commonName || p.name || "" : "";
  }

  const upcomingItems = useMemo(() => {
    return reminders
      .filter((r) => r.status === "pending")
      .flatMap((r) => expandRecurringForDays(r, 7))
      .filter((r) => isWithinNextDays(r.dueAt, 7))
      .sort((a, b) => {
        const da = toDate(a.dueAt);
        const db = toDate(b.dueAt);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      });
  }, [reminders]);

  return (
    <DashboardLayout
      title="Reminders"
      subtitle="Create reminders, view upcoming occurrences, and manage plant care tasks."
      badge={`${upcomingItems.length} upcoming`}
    >
      <div className="container">
        <div className="toolGrid" style={{ gridTemplateColumns: "1fr 1.2fr 1fr" }}>
          <section className="panel">
            <h2 className="panelTitle">Create Reminder</h2>

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
                placeholder="e.g. Prune rose bush"
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
              {submitting ? "Adding..." : "Add Reminder"}
            </button>
          </section>

          <section className="panel">
            <h2 className="panelTitle">Upcoming</h2>

            {!auth.currentUser && <p className="muted">Log in to view reminders.</p>}
            {loading && <p className="muted">Loading...</p>}
            {error && <p style={{ color: "crimson" }}>{error}</p>}

            <div className="listBox">
              {upcomingItems.map((r) => {
                const plantName = r.plantName || getPlantNameFromReminder(r);
                const freqLabel = displayFrequencyLabel(r);
                const isSelected =
                  selected?._virtualKey === r._virtualKey || selected?.id === r.id;

                return (
                  <button
                    key={r._virtualKey || r.id}
                    className="listItem"
                    type="button"
                    onClick={() => setSelected(r)}
                    style={{
                      border: isSelected
                        ? "2px solid rgba(90,139,98,0.45)"
                        : "1px solid rgba(31,35,31,0.1)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontWeight: 700 }}>{r.title}</span>
                      <span className="muted">{formatDue(r.dueAt)}</span>
                    </div>

                    {plantName ? (
                      <div className="muted" style={{ marginTop: 6 }}>
                        Plant: {plantName}
                      </div>
                    ) : null}

                    <div className="muted" style={{ marginTop: 6 }}>
                      Type: {r.type || "custom"} {freqLabel ? `• ${freqLabel}` : ""}
                    </div>
                  </button>
                );
              })}

              {!loading && auth.currentUser && upcomingItems.length === 0 && (
                <p className="muted">No upcoming reminders in the next 7 days.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <h2 className="panelTitle">Selected Reminder</h2>

            {!selected ? (
              <p className="muted">Click a reminder to see details.</p>
            ) : (
              <div className="toolContentStack">
                <div className="issueBox">
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{selected.title}</div>

                  <div className="muted" style={{ marginTop: 8 }}>
                    Due: {formatDue(selected.dueAt)}
                  </div>

                  <div className="muted" style={{ marginTop: 6 }}>
                    Plant: {selected.plantName || getPlantNameFromReminder(selected) || "None"}
                  </div>

                  <div className="muted" style={{ marginTop: 6 }}>
                    Type: {selected.type || "custom"}
                  </div>

                  <div className="muted" style={{ marginTop: 6 }}>
                    Frequency: {displayFrequencyLabel(selected) || "one time"}
                  </div>
                </div>

                <div className="splitActions">
                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={() =>
                      updateStatus(selected.id, "done", selected._occurrenceDueAtISO)
                    }
                  >
                    Mark Done
                  </button>

                  <button
                    className="secondaryBtn"
                    type="button"
                    onClick={() =>
                      updateStatus(selected.id, "skipped", selected._occurrenceDueAtISO)
                    }
                  >
                    Skip
                  </button>
                </div>

                <button
                  className="dangerBtn"
                  type="button"
                  onClick={() => deleteReminder(selected.id)}
                >
                  Delete Reminder
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}