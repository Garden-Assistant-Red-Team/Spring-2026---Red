const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.firestore();

// Get all plants
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('plants').get();
    const plants = [];
    snapshot.forEach(doc => {
      plants.push({ id: doc.id, ...doc.data() });
    });
    res.json(plants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new plant
router.post('/', async (req, res) => {
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
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('plants').add(newPlant);
    res.status(201).json({ message: 'Plant added!', id: docRef.id, plant: newPlant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;