const express = require('express');
const admin = require('firebase-admin');

// Initialize Firebase
const serviceAccount = require('./config/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const PORT = 3000;

// Middleware to parse JSON
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Garden Assistant API is running!');
});

// Example: Get all plants
app.get('/api/plants', async (req, res) => {
  try {
    const plantsSnapshot = await db.collection('plants').get();
    const plants = [];
    plantsSnapshot.forEach(doc => {
      plants.push({ id: doc.id, ...doc.data() });
    });
    res.json(plants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});