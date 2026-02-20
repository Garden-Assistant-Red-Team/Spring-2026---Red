const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.firestore();

// GET /api/reminders/:uid — get all reminders for a user
router.get('/:uid', async (req, res) => {
  try {
    const snapshot = await db
      .collection('users')
      .doc(req.params.uid)
      .collection('reminders')
      .get();

    const reminders = [];
    snapshot.forEach(doc => {
      reminders.push({ id: doc.id, ...doc.data() });
    });

    res.json(reminders);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reminders/:uid — create a manual reminder
router.post('/:uid', async (req, res) => {
  try {
    const {
      plantInstanceId,
      type,
      title,
      dueAt,
      recurrence,
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!['water', 'fertilize', 'prune', 'custom'].includes(type)) {
      return res.status(400).json({ error: 'type must be water, fertilize, prune, or custom' });
    }
    if (!dueAt) {
      return res.status(400).json({ error: 'dueAt is required' });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const newReminder = {
      plantInstanceId: plantInstanceId || null,
      type: type,
      title: title,
      dueAt: admin.firestore.Timestamp.fromDate(new Date(dueAt)),
      status: 'pending',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };

    // Add recurrence if provided
    if (recurrence?.everyDays) {
      newReminder.recurrence = {
        everyDays: recurrence.everyDays
      };
    }

    const docRef = await db
      .collection('users')
      .doc(req.params.uid)
      .collection('reminders')
      .add(newReminder);

    res.status(201).json({
      message: 'Reminder created!',
      id: docRef.id,
      reminder: newReminder
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/reminders/:uid/:reminderId — update reminder status
router.patch('/:uid/:reminderId', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'done', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, done, or skipped' });
    }

    await db
      .collection('users')
      .doc(req.params.uid)
      .collection('reminders')
      .doc(req.params.reminderId)
      .update({
        status: status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    res.json({ message: 'Reminder updated!' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/reminders/:uid/:reminderId — delete a reminder
router.delete('/:uid/:reminderId', async (req, res) => {
  try {
    await db
      .collection('users')
      .doc(req.params.uid)
      .collection('reminders')
      .doc(req.params.reminderId)
      .delete();

    res.json({ message: 'Reminder deleted!' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;