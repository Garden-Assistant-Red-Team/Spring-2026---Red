const admin = require('firebase-admin');
const db = admin.firestore();

// CREATE REMINDERS FOR NEW PLANT
async function createPlantReminders(uid, plantInstanceId, catalogData) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const plantName = catalogData.commonName || catalogData.scientificName || 'Your plant';
  const wateringEveryDays = catalogData?.careEffective?.wateringEveryDays || 7;

  const remindersToCreate = [];

  // Watering reminder
  const waterDueAt = new Date();
  waterDueAt.setDate(waterDueAt.getDate() + wateringEveryDays);
  remindersToCreate.push({
    plantInstanceId,
    type: 'water',
    title: `Water ${plantName}`,
    dueAt: admin.firestore.Timestamp.fromDate(waterDueAt),
    status: 'pending',
    source: 'auto',
    createdAt: now,
    updatedAt: now,
    recurrence: { everyDays: wateringEveryDays }
  });

  // Fertilizing reminder (default 30 days)
  const fertilizeDueAt = new Date();
  fertilizeDueAt.setDate(fertilizeDueAt.getDate() + 30);
  remindersToCreate.push({
    plantInstanceId,
    type: 'fertilize',
    title: `Fertilize ${plantName}`,
    dueAt: admin.firestore.Timestamp.fromDate(fertilizeDueAt),
    status: 'pending',
    source: 'auto',
    createdAt: now,
    updatedAt: now,
    recurrence: { everyDays: 30 }
  });

  const batch = db.batch();
  remindersToCreate.forEach(reminder => {
    const ref = db.collection('users').doc(uid).collection('reminders').doc();
    batch.set(ref, reminder);
  });

  await batch.commit();
}

// SKIP TODAY WATERING
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
    .where('dueAt', '<', admin.firestore.Timestamp.fromDate(tomorrowStart))
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

// FROST OVERRIDE
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

// HEAT OVERRIDE
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

// HEAVY RAIN OVERRIDE
async function adjustWateringRemindersForRain(uid) {
  const now = admin.firestore.Timestamp.now();

  const remindersSnap = await db
    .collection('users').doc(uid)
    .collection('reminders')
    .where('type', '==', 'water')
    .where('status', '==', 'pending')
    .get();

  if (remindersSnap.empty) return 0;

  const batch = db.batch();
  remindersSnap.docs.forEach(doc => {
    const reminder = doc.data();
    const newDue = reminder.dueAt.toDate();
    newDue.setDate(newDue.getDate() + 1);

    batch.update(doc.ref, {
      dueAt: admin.firestore.Timestamp.fromDate(newDue),
      updatedAt: now,
      skipReason: 'heavyRain'
    });
  });

  await batch.commit();
  return remindersSnap.size;
}

module.exports = {
  createPlantReminders,
  skipTodayWateringReminders,
  pauseOutdoorPlantsForFrost,
  increaseWateringForHeat,
  adjustWateringRemindersForRain
};