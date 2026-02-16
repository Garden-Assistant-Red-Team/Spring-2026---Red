import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useState } from "react";

export default function GardenCalendar() {
  const [events, setEvents] = useState([
    { title: "Water Basil", date: "2026-02-17" },
    { title: "Fertilize Tomato", date: "2026-02-19" },
  ]);

  const handleDateClick = (info) => {
    const title = prompt("Add reminder (Water / Fertilize / Harvest)");
    if (!title) return;

    setEvents([...events, { title, date: info.dateStr }]);
  };

  return (
    <div style={{ background: "white", padding: 16, borderRadius: 16 }}>
      <h3 style={{ marginTop: 0 }}>Garden Calendar</h3>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        height="auto"
        dateClick={handleDateClick}
        events={events}
      />

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Click a day to add watering or fertilizing reminders
      </p>
    </div>
  );
}