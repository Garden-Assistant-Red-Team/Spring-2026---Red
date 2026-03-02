import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useState, useEffect } from "react";
import { auth } from "../firebase";

const API_BASE = "http://localhost:5000";
const WEATHER_API_KEY = process.env.REACT_APP_WEATHER_API_KEY;

export default function GardenCalendar() {
  const [events, setEvents] = useState([]);
  const [weatherEvents, setWeatherEvents] = useState([]);

 useEffect(() => {
  let intervalId;

  const unsubscribe = auth.onAuthStateChanged((user) => {
    if (user) {
      loadReminders();
      loadWeather();

      // refresh every 30 minutes
      intervalId = setInterval(() => {
        loadWeather();
      }, 30 * 60 * 1000);
    } else {
      setEvents([]);
      setWeatherEvents([]);
    }
  });

  // refresh when tab becomes active again
  const handleVisibility = () => {
    if (document.visibilityState === "visible" && auth.currentUser) {
      loadWeather();
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    unsubscribe();
    clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}, []);

  function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value?._seconds) return new Date(value._seconds * 1000);
    return new Date(value);
  }

  function getColor(type) {
    return type === "water"
      ? "#4A90D9"
      : type === "fertilize"
      ? "#7CB87C"
      : type === "prune"
      ? "#E8A838"
      : "#888";
  }

  // ================= WEATHER =================

  function dayKeyLocal(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function pickMiddayEntry(entries) {
    let best = entries[0];
    let bestDist = Infinity;
    for (const e of entries) {
      const dt = new Date(e.dt * 1000);
      const dist = Math.abs(dt.getHours() - 12);
      if (dist < bestDist) {
        best = e;
        bestDist = dist;
      }
    }
    return best;
  }

  async function loadWeather() {
    try {
      if (!WEATHER_API_KEY) return;

      const city = "Norfolk";
      const state = "VA";
      const q = `${city},${state},US`;

      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${q}&appid=${WEATHER_API_KEY}&units=imperial`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Weather failed");

      const byDay = new Map();
      for (const item of json.list || []) {
        const dt = new Date(item.dt * 1000);
        const key = dayKeyLocal(dt);
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key).push(item);
      }

      const days = Array.from(byDay.keys()).slice(0, 7);
      const evts = days.map((key) => {
        const entries = byDay.get(key);
        const mid = pickMiddayEntry(entries);

        const hi = Math.round(Math.max(...entries.map(e => e.main.temp_max)));
        const lo = Math.round(Math.min(...entries.map(e => e.main.temp_min)));
        const desc = mid.weather?.[0]?.main || "Weather";

        return {
          id: `weather-${key}`,
          title: `🌤 ${hi}°/${lo}° ${desc}`,
          date: key,
          allDay: true,
          display: "background",
          backgroundColor: "#dfefff",
          textColor: "#222"
        };
      });

      setWeatherEvents(evts);
    } catch (e) {
      console.error("Weather error:", e.message);
    }
  }

  // ================= REMINDERS =================

  function expandRecurringToEvents(reminder, daysAhead = 45) {
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

    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);

    const color = getColor(reminder.type);

    if (!every || !Number.isFinite(every) || every <= 0) {
      if (lastAction && baseDue <= lastAction) return [];
      if (baseDue < now) return [];

      const dateStr = baseDue.toISOString().split("T")[0];
      return [{
        id: `${reminder.id || reminder.title}-${dateStr}`,
        title: reminder.title,
        date: dateStr,
        color,
      }];
    }

    const cutoff = lastAction && lastAction > now ? lastAction : now;

    let d = new Date(baseDue);
    while (d <= cutoff) d.setDate(d.getDate() + every);

    const out = [];
    let safety = 0;

    while (d <= end && safety < 500) {
      const dateStr = d.toISOString().split("T")[0];
      out.push({
        id: `${reminder.id || reminder.title}-${dateStr}`,
        title: reminder.title,
        date: dateStr,
        color,
      });
      d.setDate(d.getDate() + every);
      safety++;
    }

    return out;
  }

  async function loadReminders() {
    try {
      const uid = auth.currentUser.uid;
      const res = await fetch(`${API_BASE}/api/reminders/${uid}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load reminders");

      const calendarEvents = (Array.isArray(data) ? data : [])
        .filter((r) => r.status === "pending")
        .flatMap((r) => expandRecurringToEvents(r, 45));

      setEvents(calendarEvents);
    } catch (e) {
      console.error("Failed to load calendar reminders:", e.message);
    }
  }

  return (
    <div style={{ background: "white", padding: 16, borderRadius: 16 }}>
      <h3 style={{ marginTop: 0 }}>Garden Calendar</h3>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        height="auto"
        events={[...weatherEvents, ...events]}
      />

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Your upcoming care reminders are shown here.
      </p>
    </div>
  );
}