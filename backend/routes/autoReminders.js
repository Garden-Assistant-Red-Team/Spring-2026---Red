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

module.exports = { createPlantReminders };