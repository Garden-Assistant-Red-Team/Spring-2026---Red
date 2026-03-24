const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { skipTodayWateringReminders } = require('./autoReminders');
const db = admin.firestore();

// GET /api/reminders/:uid — get all reminders for a user
router.get('/:uid', requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }
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
router.post('/:uid', requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const {
      plantInstanceId,
      type,
      title,
      dueAt,
      recurrence,
      frequency,
    } = req.body;

   
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

    // Convert frequency -> recurrence.everyDays so recurring works everywhere
    let everyDays = recurrence?.everyDays;

    if (!everyDays && frequency) {
      if (frequency === "daily") everyDays = 1;
      else if (frequency === "every2days") everyDays = 2;
      else if (frequency === "weekly") everyDays = 7;
      else if (frequency === "biweekly") everyDays = 14;
      else if (frequency === "monthly") everyDays = 30;
    }

    if (everyDays) {
      newReminder.recurrence = { everyDays };
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

// PATCH /api/reminders/:uid/:reminderId — update reminder status / occurrence completion
router.patch('/:uid/:reminderId', requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const { status, occurrenceDueAt } = req.body;

    if (!['pending', 'done', 'skipped', 'paused'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, done, skipped, or paused' });
    }

    const uid = req.params.uid;
    const reminderId = req.params.reminderId;

    const ref = db
      .collection('users')
      .doc(uid)
      .collection('reminders')
      .doc(reminderId);

    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const reminder = snap.data();
    const isRecurring = Boolean(reminder?.recurrence?.everyDays);

    // If it's recurring, "done/skipped" should apply ONLY to the clicked occurrence.
    if (isRecurring && (status === "done" || status === "skipped")) {
      if (!occurrenceDueAt) {
        return res.status(400).json({ error: "occurrenceDueAt is required for recurring reminders" });
      }

      const occDate = new Date(occurrenceDueAt);
      if (Number.isNaN(occDate.getTime())) {
        return res.status(400).json({ error: "occurrenceDueAt is invalid" });
      }

      const patch = {
        status: "pending", // keep series alive
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (status === "done") {
        patch.lastCompletedAt = admin.firestore.Timestamp.fromDate(occDate);
      } else if (status === "skipped") {
        patch.lastSkippedAt = admin.firestore.Timestamp.fromDate(occDate);
        patch.skipReason = 'userDecision';
      }

      await ref.update(patch);

      return res.json({ message: "Occurrence updated!" });
    }

    // Non-recurring reminders: update status normally
    await ref.update({
      status: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ message: 'Reminder updated!' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/reminders/:uid/:reminderId — delete a reminder
router.delete('/:uid/:reminderId', requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }
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

// PATCH /api/reminders/:uid/skip-watering-today
// User-triggered skip after seeing heavy rain alert
router.patch('/:uid/skip-watering-today', requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const skipped = await skipTodayWateringReminders(req.params.uid);
    return res.json({
      message: `Skipped ${skipped} watering reminder(s) for today`,
      skipped
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;