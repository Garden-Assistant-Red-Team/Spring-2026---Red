const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { requireAuth } = require("../middleware/auth");
const { createPlantReminders } = require('./autoReminders');

const db = admin.firestore();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, zipCode, gardenZone, phoneNumber } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ 
        error: 'Full name, email and password are all required' 
      });
    }

    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: fullName
    });

    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('users').doc(userRecord.uid).set({
      fullName: fullName,
      email: email,
      zipCode: zipCode || '',
      gardenZone: gardenZone || 'Unknown',
      phoneNumber: phoneNumber || '',
      createdAt: now,

      settings: {
        weatherEnabled: true,
        locationMode: 'manualZip',
        careAutoAdjustEnabled: true,
        weatherRefreshPolicy: 'ttl',
        weatherTTLMinutes: 180,
        units: 'imperial'
      },

      location: {
        geo: null,
        source: 'manual',
        updatedAt: null
      },

      weather: {
        lastCheckedAt: null,
        nextAllowedCheckAt: null,
        lastResultSummary: {
          rainNext12hMm: null,
          rainNext24hMm: null,
          temp: null
        },
        source: 'openweather'
      }
    });

    res.status(201).json({
      message: 'User created successfully!',
      user: {
        id: userRecord.uid,
        fullName: fullName,
        email: email
      }
    });

  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email is already in use' });
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * The following routes use req.user.uid from requireAuth to ensure
 * the user can only access their own plants.
 */

// Get current user's plants
router.get('/me/plants', requireAuth, async (req, res) => {
  try {
    const snapshot = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('gardenPlants')
      .get();

    const plants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(plants);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Add a plant for current user
router.post('/me/plants', requireAuth, async (req, res) => { 
  try {
    const {
      catalogId,
      addedFrom,
      nickname,
      locationType,
      notes,
      plantingDate
    } = req.body;

    if (!catalogId) {
      return res.status(400).json({ error: 'catalogId is required' });
    }
    if (!['dictionary', 'recommender', 'manual'].includes(addedFrom)) {
      return res.status(400).json({ error: 'addedFrom must be dictionary, recommender, or manual' });
    }
    if (!['indoor', 'outdoor'].includes(locationType)) {
      return res.status(400).json({ error: 'locationType must be indoor or outdoor' });
    }

    const catalogDoc = await db.collection('plantCatalog').doc(catalogId).get();
    if (!catalogDoc.exists) {
      return res.status(404).json({ error: 'Plant not found in catalog' });
    }

    const catalogData = catalogDoc.data();
    const effectiveWateringDays = catalogData?.careEffective?.wateringEveryDays || 7;
    const effectiveSunlight = catalogData?.careEffective?.sunlightCategory || '';

    const now = admin.firestore.FieldValue.serverTimestamp();

    const newPlant = {
      catalogId,
      addedFrom,
      nickname: nickname || '',
      locationType,
      status: 'active',
      createdAt: now,
      updatedAt: now,

      care: {
        default: {
          sunlightCategory: effectiveSunlight,
          wateringEveryDays: effectiveWateringDays
        },
        override: {
          wateringEveryDays: null
        },
        effective: {
          wateringEveryDays: effectiveWateringDays,
          lastComputedAt: now
        }
      },

      notes: notes || '',
      lastWateredAt: null,
      plantingDate: plantingDate || null
    };

    // Save plant instance to current user's garden (using req.user.uid)
    const plantRef = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('gardenPlants')
      .add(newPlant);

    // Auto-create reminders
    await createPlantReminders(req.user.uid, plantRef.id, catalogData);

    res.status(201).json({
      message: 'Plant added to your garden!',
      id: plantRef.id,
      plant: newPlant,
      remindersCreated: true
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a plant for current user
router.patch('/me/plants/:plantId', requireAuth, async (req, res) => {
  try {
    const { plantId } = req.params;

    // allow only these fields to be updated
    const allowed = ['nickname', 'notes', 'locationType', 'status', 'lastWateredAt', 'plantingDate'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    const plantRef = db
      .collection('users')
      .doc(req.user.uid)
      .collection('gardenPlants')
      .doc(plantId);

    const doc = await plantRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    await plantRef.update(updates);
    return res.json({ message: 'Plant updated', id: plantId, updates });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete a plant for current user
router.delete('/me/plants/:plantId', requireAuth, async (req, res) => {
  try {
    const { plantId } = req.params;

    const plantRef = db
      .collection('users')
      .doc(req.user.uid)
      .collection('gardenPlants')
      .doc(plantId);

    const doc = await plantRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    await plantRef.delete();
    return res.json({ message: 'Plant deleted', id: plantId });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});


// Get a user's info
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ id: doc.id, ...doc.data() });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a user
router.put('/:id', async (req, res) => {
  try {
    const { fullName, email, zipCode, gardenZone, phoneNumber } = req.body;

    if (!fullName && !email && !zipCode && !gardenZone && !phoneNumber) {
      return res.status(400).json({ error: 'Please provide at least one field to update' });
    }

    const updates = {};
    if (fullName) updates.fullName = fullName;
    if (email) updates.email = email;
    if (zipCode) updates.zipCode = zipCode;
    if (gardenZone) updates.gardenZone = gardenZone;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('users').doc(req.params.id).update(updates);

    if (email) {
      await admin.auth().updateUser(req.params.id, { email });
    }
    if (fullName) {
      await admin.auth().updateUser(req.params.id, { displayName: fullName });
    }

    res.json({ message: 'User updated successfully!', updates });

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a user
router.delete('/:id', async (req, res) => {
  try {
    await admin.auth().deleteUser(req.params.id);
    await db.collection('users').doc(req.params.id).delete();

    res.json({ message: 'User deleted successfully!' });

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Add a plant to a user's garden
router.post('/:id/plants', requireAuth, async (req, res) => {
  // Block access if user tries to write to someone else’s data
  if (req.user.uid !== req.params.id) {
    return res.status(403).json({ error: "Forbidden: You can only add plants to your own garden" });
  }  try {
    const {
      catalogId,
      addedFrom,
      nickname,
      locationType,
      notes,
      plantingDate
    } = req.body;

    if (!catalogId) {
      return res.status(400).json({ error: 'catalogId is required' });
    }
    if (!['dictionary', 'recommender', 'manual'].includes(addedFrom)) {
      return res.status(400).json({ error: 'addedFrom must be dictionary, recommender, or manual' });
    }
    if (!['indoor', 'outdoor'].includes(locationType)) {
      return res.status(400).json({ error: 'locationType must be indoor or outdoor' });
    }

    // Look up plant in plantCatalog to get care data
    const catalogDoc = await db.collection('plantCatalog').doc(catalogId).get();
    if (!catalogDoc.exists) {
      return res.status(404).json({ error: 'Plant not found in catalog' });
    }

    const catalogData = catalogDoc.data();
    const effectiveWateringDays = catalogData?.careEffective?.wateringEveryDays || 7;
    const effectiveSunlight = catalogData?.careEffective?.sunlightCategory || '';

    const now = admin.firestore.FieldValue.serverTimestamp();

    const newPlant = {
      catalogId: catalogId,
      addedFrom: addedFrom,
      nickname: nickname || '',
      locationType: locationType,
      status: 'active',
      createdAt: now,
      updatedAt: now,

      care: {
        default: {
          sunlightCategory: effectiveSunlight,
          wateringEveryDays: effectiveWateringDays
        },
        override: {
          wateringEveryDays: null
        },
        effective: {
          wateringEveryDays: effectiveWateringDays,
          lastComputedAt: now
        }
      },

      notes: notes || '',
      lastWateredAt: null,
      plantingDate: plantingDate || null
    };

    // Save plant instance
    const plantRef = await db
      .collection('users')
      .doc(req.params.id)
      .collection('gardenPlants')
      .add(newPlant);

    // Auto-create reminders
    await createPlantReminders(req.params.id, plantRef.id, catalogData);

    res.status(201).json({
      message: 'Plant added to your garden!',
      id: plantRef.id,
      plant: newPlant,
      remindersCreated: true
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }

});
module.exports = router;