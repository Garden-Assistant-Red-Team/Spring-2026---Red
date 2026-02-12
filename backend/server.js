const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const serviceAccount = require('./config/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const usersRouter = require('./routes/users');
const plantsRouter = require('./routes/plants');

// Use routes
app.use('/api/users', usersRouter);
app.use('/api/plants', plantsRouter);

// Test route
app.get('/', (req, res) => {
  res.send('Garden Assistant API is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});