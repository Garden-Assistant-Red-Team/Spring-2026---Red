const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require ("dotenv").config();
const serviceAccount = require('./config/serviceAccountKey.json');

//this prevents double-init if reloads happen 
if(!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert (serviceAccount)
  });
}
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}


const app = express();
//create env port later
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const usersRouter = require('./routes/users');
const plantsRouter = require('./routes/plants');
const remindersRouter = require('./routes/reminders');
const weatherRouter = require('./routes/weather');
const recommendationsRouter = require('./routes/recommendations');
const symptomsRouter = require('./routes/symptoms');


// Use routes
app.use('/api/users', usersRouter);
app.use('/api/plants', plantsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/symptoms', symptomsRouter);

// Test route
app.get('/', (req, res) => {
  res.send('Garden Assistant API is running!');
});
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});