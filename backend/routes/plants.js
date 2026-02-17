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

// Get a specific plant
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('plants').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    res.json({ id: doc.id, ...doc.data() });

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
    res.status(201).json({ 
      message: 'Plant added!', 
      id: docRef.id, 
      plant: newPlant 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a plant
router.put('/:id', async (req, res) => {
  try {
    const { name, species, wateringFrequency, sunlight, notes } = req.body;

    // Make sure there's something to update
    if (!name && !species && !wateringFrequency && !sunlight && !notes) {
      return res.status(400).json({ error: 'Please provide at least one field to update' });
    }

    // Build update object with only provided fields
    const updates = {};
    if (name) updates.name = name;
    if (species) updates.species = species;
    if (wateringFrequency) updates.wateringFrequency = wateringFrequency;
    if (sunlight) updates.sunlight = sunlight;
    if (notes) updates.notes = notes;
    updates.updatedAt = new Date().toISOString();

    // Check plant exists first
    const doc = await db.collection('plants').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    await db.collection('plants').doc(req.params.id).update(updates);

    res.json({ message: 'Plant updated successfully!', updates });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a plant
router.delete('/:id', async (req, res) => {
  try {
    // Check plant exists first
    const doc = await db.collection('plants').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    await db.collection('plants').doc(req.params.id).delete();

    res.json({ message: 'Plant deleted successfully!' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;