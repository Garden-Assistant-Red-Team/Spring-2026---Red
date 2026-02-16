const express = require('express');
const router = express.Router();

// Placeholder reminders (in-memory)
let reminders = [
  { id: "1", title: "Water Basil", plantId: "1", due: "Tomorrow", type: "Watering" }
];

// GET /api/reminders
router.get('/', (req, res) => {
  res.json(reminders);
});

// POST /api/reminders
router.post('/', (req, res) => {
  const { title, plantId, due, type } = req.body;

  const newReminder = {
    id: String(Date.now()),
    title: title || "Untitled Reminder",
    plantId: plantId || null,
    due: due || "Unknown",
    type: type || "General"
  };

  reminders.push(newReminder);
  res.status(201).json({ message: "Reminder created (placeholder)", reminder: newReminder });
});

module.exports = router;
