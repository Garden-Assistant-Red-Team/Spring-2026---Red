import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useState, useEffect } from "react";
import { auth } from "../firebase";

const API_BASE = "http://localhost:5000";

export default function GardenCalendar() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) loadReminders();
      else setEvents([]);
    });
    return () => unsubscribe();
  }, []);

  async function loadReminders() {
    try {
      const uid = auth.currentUser.uid;
      const res = await fetch(`${API_BASE}/api/reminders/${uid}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load reminders");

      const calendarEvents = data
        .filter((r) => r.status === "pending")
        .map((r) => {
          const date = r.dueAt?._seconds
            ? new Date(r.dueAt._seconds * 1000)
            : new Date(r.dueAt);

          return {
            title: r.title,
            date: date.toISOString().split("T")[0],
            color: r.type === "water" ? "#4A90D9" : 
                   r.type === "fertilize" ? "#7CB87C" : 
                   r.type === "prune" ? "#E8A838" : "#888",
          };
        });

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
        events={events}
      />

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Your upcoming care reminders are shown here.
      </p>
    </div>
  );
}