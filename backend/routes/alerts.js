const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();
const { requireAuth } = require('../middleware/auth');

//  Build alert objects from weather conditions 
function buildWeatherAlerts(conditions, weather) {
  const alerts = [];
  const now = admin.firestore.Timestamp.now();

  if (conditions.isFrost) {
    alerts.push({
      type: 'frost',
      severity: 'high',
      read: false,
      createdAt: now,
      message: `Frost warning! Temperature is ${Math.round(weather.temp)}°F. Your outdoor plants have been paused.`
    });
  }

  if (conditions.isHeat) {
    alerts.push({
      type: 'heat',
      severity: 'medium',
      read: false,
      createdAt: now,
      message: `Heat warning! Temperature is ${Math.round(weather.temp)}°F. Watering frequency has been increased.`
    });
  }

  if (conditions.isHeavyRain) {
    alerts.push({
      type: 'heavyRain',
      severity: 'low',
      read: false,
      createdAt: now,
      message: `Heavy rain expected (${Math.round(weather.rainNext12hMm)}mm in next 12h). Today's watering reminders have been skipped.`
    });
  }

  return alerts;
}

// Save alerts to user's weatherAlerts subcollection 
async function saveWeatherAlerts(uid, alerts) {
  if (!alerts || alerts.length === 0) return;

  const batch = db.batch();
  alerts.forEach(alert => {
    const ref = db
      .collection('users').doc(uid)
      .collection('weatherAlerts').doc();
    batch.set(ref, alert);
  });
  await batch.commit();
}

// ── GET /api/alerts/:uid — fetch alerts for frontend 
router.get('/:uid', requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const snap = await db
      .collection('users').doc(req.params.uid)
      .collection('weatherAlerts')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const alerts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json({ alerts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

//  PATCH /api/alerts/:uid/:alertId/read — mark as read 
router.patch('/:uid/:alertId/read', requireAuth, async (req, res) => {
  if (req.user.uid !== req.params.uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await db
      .collection('users').doc(req.params.uid)
      .collection('weatherAlerts').doc(req.params.alertId)
      .update({ read: true });

    return res.json({ message: 'Alert marked as read' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = { router, saveWeatherAlerts, buildWeatherAlerts };