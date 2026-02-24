require("dotenv").config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require("dotenv").config();

const serviceAccount = require('./config/serviceAccountKey.json');

//Initialize Firebase Admin ONLY ONCE
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = express();

// Use PORT from env if set, otherwise 5000
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const usersRouter = require('./routes/users');
const remindersRouter = require('./routes/maunalReminders');
const weatherRouter = require('./routes/weather');
const recommendationsRouter = require('./routes/recommendations');
const symptomsRouter = require('./routes/symptoms');

const gardenRouter = require('./routes/garden');            
const identifyPlantRouter = require('./routes/identifyPlant');


// Use routes
app.use('/api/users', usersRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/symptoms', symptomsRouter);
// CATALOG ROUTE (Plant Dictionary)
const catalogRouter = require('./routes/catalog');
app.use('/api/catalog', catalogRouter);
console.log("✅ mounted /api/catalog");

// Test routes

app.use('/api/garden', gardenRouter);               
app.use('/api/identifyPlant', identifyPlantRouter);
console.log("✅ mounted /api/identifyPlant");
// Test route
app.get('/', (req, res) => {
  res.send('Garden Assistant API is running!');
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
