require("dotenv").config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const serviceAccount = require('./config/serviceAccountKey.json');

// Initialize Firebase Admin ONLY ONCE
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

// Import routes
const usersRouter = require('./routes/users');
const remindersRouter = require('./routes/maunalReminders');
const { router: weatherRouter, runDailyWeatherCheck } = require('./routes/weather');
const recommendationsRouter = require('./routes/recommendations');
const symptomsRouter = require('./routes/symptoms');
const gardenRouter = require('./routes/garden');
const identifyPlantRouter = require('./routes/identifyPlant');
const catalogRouter = require('./routes/catalog');
const { router: alertsRouter } = require('./routes/alerts');
const adminRouter = require('./routes/admin');

// Mount routes
app.use('/api/users', usersRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/symptoms', symptomsRouter);
app.use('/api/checklist', require('./routes/checklist'));
app.use('/api/catalog', catalogRouter);
app.use('/api/garden', gardenRouter);
app.use('/api/identify-plant', identifyPlantRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/admin', adminRouter);

// Health check routes
app.get('/', (req, res) => {
  res.send('Garden Assistant API is running!');
});
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});
// TEMPORARY — remove after testing
app.post('/api/get-test-token', async (req, res) => {
  try {
    const axios = require('axios');
    const { email, password } = req.body;
    const apiKey = process.env.FIREBASE_API_KEY;

    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      { email, password, returnSecureToken: true }
    );

    res.json({ token: response.data.idToken, uid: response.data.localId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
