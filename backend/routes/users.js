const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.firestore();

// Create a new user account
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Name, email and password are all required' 
      });
    }

    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name
    });

    // Also save user info in Firestore database
    await db.collection('users').doc(userRecord.uid).set({
      name: name,
      email: email,
      createdAt: new Date().toISOString()
    });

    // Send back success response
    res.status(201).json({
      message: 'User created successfully!',
      user: {
        id: userRecord.uid,
        name: name,
        email: email
      }
    });

  } catch (error) {
    // Handle common errors nicely
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

module.exports = router;