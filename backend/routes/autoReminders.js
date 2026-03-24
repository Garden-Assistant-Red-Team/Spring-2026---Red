const admin = require('firebase-admin');

const db = admin.firestore();

// Auto-create care reminders when a plant is added to a user's garden
async function createPlantReminders(uid, plantInstanceId, catalogData) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const plantName = catalogData.commonName || catalogData.scientificName || 'Your plant';
  const wateringEveryDays = catalogData?.careEffective?.wateringEveryDays || 7;

  const remindersToCreate = [];

  // Watering reminder
  const waterDueAt = new Date();
  waterDueAt.setDate(waterDueAt.getDate() + wateringEveryDays);

  remindersToCreate.push({
    plantInstanceId: plantInstanceId,
    type: 'water',
    title: `Water ${plantName}`,
    dueAt: admin.firestore.Timestamp.fromDate(waterDueAt),
    status: 'pending',
    source: 'auto',
    createdAt: now,
    updatedAt: now,
    recurrence: {
      everyDays: wateringEveryDays
    }
  });

  // Fertilizing reminder — every 30 days by default
  const fertilizeDueAt = new Date();
  fertilizeDueAt.setDate(fertilizeDueAt.getDate() + 30);

  remindersToCreate.push({
    plantInstanceId: plantInstanceId,
    type: 'fertilize',
    title: `Fertilize ${plantName}`,
    dueAt: admin.firestore.Timestamp.fromDate(fertilizeDueAt),
    status: 'pending',
    source: 'auto',
    createdAt: now,
    updatedAt: now,
    recurrence: {
      everyDays: 30
    }
  });

  // Write all reminders to Firestore
  const batch = db.batch();

  remindersToCreate.forEach(reminder => {
    const ref = db
      .collection('users')
      .doc(uid)
      .collection('reminders')
      .doc();
    batch.set(ref, reminder);
  });

  await batch.commit();
}

// ── USER-TRIGGERED ONLY: Skip a watering reminder ────────────
// Not called automatically by the weather job.
// The weather job sends a heavy rain ALERT instead,
// and the user decides whether to skip using this function.
async function skipTodayWateringReminders(uid) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const snap = await db
    .collection('users').doc(uid)
    .collection('reminders')
    .where('type', '==', 'water')
    .where('status', '==', 'pending')
    .where('dueAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
    .where('dueAt', '<',  admin.firestore.Timestamp.fromDate(tomorrowStart))
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach(doc => {
    batch.update(doc.ref, {
      status: 'skipped',
      skipReason: 'userDecision',
      updatedAt: admin.firestore.Timestamp.now()
    });
  });
  await batch.commit();
  return snap.size;
}

// Pause outdoor plants + reminders (frost)
async function pauseOutdoorPlantsForFrost(uid) {
  const now = admin.firestore.Timestamp.now();

  const plantsSnap = await db
    .collection('users').doc(uid)
    .collection('gardenPlants')
    .where('status', '==', 'active')
    .where('locationType', '==', 'outdoor')
    .get();

  if (plantsSnap.empty) return 0;

  const batch = db.batch();

  for (const plantDoc of plantsSnap.docs) {
    batch.update(plantDoc.ref, {
      status: 'paused',
      'care.weatherOverride.reason': 'frost',
      'care.weatherOverride.appliedAt': now,
      updatedAt: now
    });

    const remSnap = await db
      .collection('users').doc(uid)
      .collection('reminders')
      .where('plantInstanceId', '==', plantDoc.id)
      .where('type', '==', 'water')
      .where('status', '==', 'pending')
      .get();

    remSnap.docs.forEach(remDoc => {
      batch.update(remDoc.ref, {
        status: 'paused',
        pauseReason: 'frost',
        updatedAt: now
      });
    });
  }

  await batch.commit();
  return plantsSnap.size;
}

// Shorten watering interval by 1 day (heat)
async function increaseWateringForHeat(uid) {
  const now = admin.firestore.Timestamp.now();

  const plantsSnap = await db
    .collection('users').doc(uid)
    .collection('gardenPlants')
    .where('status', '==', 'active')
    .get();

  if (plantsSnap.empty) return 0;

  const batch = db.batch();

  plantsSnap.docs.forEach(plantDoc => {
    const plant = plantDoc.data();
    const current =
      plant.care?.effective?.wateringEveryDays ||
      plant.care?.default?.wateringEveryDays ||
      7;
    const adjusted = Math.max(1, current - 1);

    batch.update(plantDoc.ref, {
      'care.weatherOverride.wateringEveryDays': adjusted,
      'care.weatherOverride.reason': 'heat',
      'care.weatherOverride.appliedAt': now,
      'care.effective.wateringEveryDays': adjusted,
      'care.effective.lastComputedAt': now,
      updatedAt: now
    });
  });

  await batch.commit();
  return plantsSnap.size;
}

module.exports = {
  createPlantReminders,
  skipTodayWateringReminders,
  pauseOutdoorPlantsForFrost,
  increaseWateringForHeat
};