const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.firestore();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Name, email and password are all required' 
      });
    }

    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name
    });

    await db.collection('users').doc(userRecord.uid).set({
      name: name,
      email: email,
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      message: 'User created successfully!',
      user: {
        id: userRecord.uid,
        name: name,
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
    const { name, email } = req.body;

    // Make sure there's something to update
    if (!name && !email) {
      return res.status(400).json({ error: 'Please provide a name or email to update' });
    }

    // Build update object with only provided fields
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    updates.updatedAt = new Date().toISOString();

    // Update in Firestore
    await db.collection('users').doc(req.params.id).update(updates);

    // Update in Firebase Auth too if email changed
    if (email) {
      await admin.auth().updateUser(req.params.id, { email });
    }
    if (name) {
      await admin.auth().updateUser(req.params.id, { displayName: name });
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
    // Delete from Firebase Authentication
    await admin.auth().deleteUser(req.params.id);

    // Delete from Firestore
    await db.collection('users').doc(req.params.id).delete();

    res.json({ message: 'User deleted successfully!' });

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get a user's saved plants
router.get('/:id/plants', async (req, res) => {
  try {
    const snapshot = await db
      .collection('users')
      .doc(req.params.id)
      .collection('plants')
      .get();

    const plants = [];
    snapshot.forEach(doc => {
      plants.push({ id: doc.id, ...doc.data() });
    });

    res.json(plants);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a plant to a user's collection
router.post('/:id/plants', async (req, res) => {
  try {
    const { name, species, wateringFrequency, sunlight, notes } = req.body;

    if (!name || !species) {
      return res.status(400).json({ error: 'Name and species are required' });
    }

    const newPlant = {
      name: name,
      species: species,
      wateringFrequency: wateringFrequency || 'Unknown',
      sunlight: sunlight || 'Unknown',
      notes: notes || '',
      addedAt: new Date().toISOString()
    };

    const docRef = await db
      .collection('users')
      .doc(req.params.id)
      .collection('plants')
      .add(newPlant);

    res.status(201).json({ 
      message: 'Plant added to your collection!', 
      id: docRef.id, 
      plant: newPlant 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;