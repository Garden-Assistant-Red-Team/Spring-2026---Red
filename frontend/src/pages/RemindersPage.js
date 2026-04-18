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

  async function authFetch(url, options = {}) {
    const token = await auth.currentUser.getIdToken();
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

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
    if (d === 2) return "every 2 days";
    if (d === 7) return "weekly";
    if (d === 14) return "every 2 weeks";
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
      const res = await authFetch(`${API_BASE}/api/reminders/${uid}`);
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
      const res = await authFetch(`${API_BASE}/api/garden/${uid}/plants`);
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

      const res = await authFetch(`${API_BASE}/api/reminders/${uid}`, {
        method: "POST",
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

    const res = await authFetch(`${API_BASE}/api/reminders/${uid}/${reminderId}`, {
      method: "PATCH",
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
    const res = await authFetch(`${API_BASE}/api/reminders/${uid}/${reminderId}`, {
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

  function formatDueTime(dueAtValue) {
    const date = toDate(dueAtValue);
    if (!date || Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getPlantNameFromReminder(r) {
    if (!r?.plantInstanceId) return "";
    const p = plants.find((x) => x.id === r.plantInstanceId);
    return p ? p.commonName || p.name || "" : "";
  }

  function getTypeLabel(reminderType) {
    if (reminderType === "water") return "Water";
    if (reminderType === "fertilize") return "Fertilize";
    if (reminderType === "prune") return "Prune";
    return "Custom";
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

  const dueTodayCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return upcomingItems.filter((r) => {
      const d = toDate(r.dueAt);
      return d && d.toISOString().split("T")[0] === today;
    }).length;
  }, [upcomingItems]);

  return (
    <DashboardLayout
      title="Reminders"
      subtitle="Create reminders, view upcoming occurrences, and manage plant care tasks."
      badge={`${upcomingItems.length} upcoming`}
    >
      <div className="container">
        <section className="summaryGrid">
          <div className="summaryCard">
            <span className="summaryLabel">Upcoming</span>
            <span className="summaryValue">{upcomingItems.length}</span>
          </div>

          <div className="summaryCard">
            <span className="summaryLabel">Due Today</span>
            <span className="summaryValue">{dueTodayCount}</span>
          </div>

          <div className="summaryCard">
            <span className="summaryLabel">Saved Plants</span>
            <span className="summaryValue">{plants.length}</span>
          </div>

          <div className="summaryCard">
            <span className="summaryLabel">Selected</span>
            <span className="summaryValue">
              {selected ? getTypeLabel(selected.type) : "None"}
            </span>
          </div>
        </section>

        <div className="mgPageGrid">
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Create Reminder</h2>
              <span className="sectionPill">New</span>
            </div>

            {!auth.currentUser ? (
              <p className="muted">Log in to create reminders.</p>
            ) : (
              <div className="editorCard">
                <div className="mgEditGrid remindersFormGrid">
                  <div className="mgEditField">
                    <label>Plant</label>
                    <select
                      value={plantId}
                      onChange={(e) => setPlantId(e.target.value)}
                      className="dashboardInput"
                    >
                      <option value="">Select plant</option>
                      {plants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.commonName || p.name || "Unnamed plant"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mgEditField">
                    <label>Title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Prune rose bush"
                      className="dashboardInput"
                    />
                  </div>

                  <div className="mgEditField">
                    <label>Due date</label>
                    <input
                      type="datetime-local"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                      className="dashboardInput"
                    />
                  </div>

                  <div className="mgEditField">
                    <label>Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="dashboardInput"
                    >
                      <option value="water">Water</option>
                      <option value="fertilize">Fertilize</option>
                      <option value="prune">Prune</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div className="mgEditField">
                    <label>Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="dashboardInput"
                    >
                      <option value="daily">Daily</option>
                      <option value="every2days">Every 2 days</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="actionRow">
                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? "Adding..." : "Add Reminder"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Upcoming</h2>
              <span className="sectionPill">{upcomingItems.length}</span>
            </div>

            {!auth.currentUser && <p className="muted">Log in to view reminders.</p>}
            {loading && <p className="muted">Loading...</p>}
            {error && <p className="errorText">{error}</p>}

            {!loading && auth.currentUser && upcomingItems.length === 0 && (
              <div className="softCard">
                <p className="muted">No upcoming reminders in the next 7 days.</p>
              </div>
            )}

            <div className="taskList remindersScrollList">
              {upcomingItems.map((r) => {
                const plantName = r.plantName || getPlantNameFromReminder(r);
                const freqLabel = displayFrequencyLabel(r);
                const isSelected =
                  selected?._virtualKey === r._virtualKey || selected?.id === r.id;

                return (
                  <button
                    key={r._virtualKey || r.id}
                    type="button"
                    className={`taskCard ${isSelected ? "active" : ""}`}
                    onClick={() => setSelected(r)}
                    style={{
                      textAlign: "left",
                      width: "100%",
                      background: "#fff",
                      border: isSelected
                        ? "2px solid rgba(90,139,98,0.45)"
                        : "1px solid rgba(31,35,31,0.08)",
                      cursor: "pointer",
                    }}
                  >
                    <div className="taskContent" style={{ width: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div className="taskText">{r.title}</div>
                        <div className="sectionPill">
                          {formatDue(r.dueAt)} {formatDueTime(r.dueAt)}
                        </div>
                      </div>

                      {plantName && (
                        <div className="taskMeta" style={{ marginTop: 6 }}>
                          Plant: {plantName}
                        </div>
                      )}

                      <div className="taskMeta" style={{ marginTop: 4 }}>
                        Type: {getTypeLabel(r.type)} {freqLabel ? `• ${freqLabel}` : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="sectionHeader">
            <h2 className="panelTitle">Selected Reminder</h2>
            <span className="sectionPill">{selected ? "Details" : "None"}</span>
          </div>

          {!selected ? (
            <div className="softCard">
              <p className="muted">Click a reminder to see details.</p>
            </div>
          ) : (
            <div className="mgDetailPanel">
              <div className="selectedPlantHero">
                <div className="selectedPlantIcon">⏰</div>

                <div className="selectedPlantInfo">
                  <h3 className="selectedPlantName">{selected.title}</h3>

                  <div className="tagRow">
                    <span className="tag">{getTypeLabel(selected.type)}</span>
                    <span className="tag">{displayFrequencyLabel(selected) || "one time"}</span>
                    <span className="tag">{formatDue(selected.dueAt)}</span>
                    {formatDueTime(selected.dueAt) && (
                      <span className="tag">{formatDueTime(selected.dueAt)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mgCareGrid" style={{ marginTop: 18 }}>
                <div className="mgCareCard">
                  <span className="mgCareLabel">Plant</span>
                  <strong>
                    {selected.plantName || getPlantNameFromReminder(selected) || "None"}
                  </strong>
                </div>

                <div className="mgCareCard">
                  <span className="mgCareLabel">Type</span>
                  <strong>{getTypeLabel(selected.type)}</strong>
                </div>

                <div className="mgCareCard">
                  <span className="mgCareLabel">Frequency</span>
                  <strong>{displayFrequencyLabel(selected) || "one time"}</strong>
                </div>

                <div className="mgCareCard">
                  <span className="mgCareLabel">Due</span>
                  <strong>
                    {formatDue(selected.dueAt)}
                    {formatDueTime(selected.dueAt) ? ` at ${formatDueTime(selected.dueAt)}` : ""}
                  </strong>
                </div>
              </div>

              <div className="actionRow" style={{ marginTop: 20 }}>
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

                <button
                  className="dangerBtn"
                  type="button"
                  onClick={() => deleteReminder(selected.id)}
                >
                  Delete Reminder
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}