require("dotenv").config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const cron = require('node-cron');

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
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

// Import routes
const usersRouter = require('./routes/users');
const remindersRouter = require('./routes/maunalReminders');
const recommendationsRouter = require('./routes/recommendations');
const { router: weatherRouter, runDailyWeatherCheck } = require('./routes/weather');
const symptomsRouter = require('./routes/symptoms');
const gardenRouter = require('./routes/garden');
const identifyPlantRouter = require('./routes/identifyPlant');
const catalogRouter = require('./routes/catalog');
const { router: alertsRouter } = require('./routes/alerts');

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

// Health check routes
app.get('/', (req, res) => {
  res.send('Garden Assistant API is running!');
});
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

/*── TEMPORARY TEST ROUTE — remove after testing ───────────────
app.get('/api/test-weather-job', async (req, res) => {
  try {
    await runDailyWeatherCheck();
    res.json({ message: 'Weather job ran successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
*/

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// ── DAILY WEATHER CRON JOB ────────────────────────────────────
// Runs every day at 6:00 AM
cron.schedule('0 6 * * *', () => {
  console.log('[CRON] Running daily weather check...');
  runDailyWeatherCheck().catch(err => {
    console.error('[CRON] Weather check failed:', err.message);
  });
});

console.log('[CRON] Daily weather job scheduled for 6:00 AM');