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

app.use(express.json());

const plantsRouter = require('./routes/plants');
const usersRouter = require('./routes/users');
const alertsRouter = require('./routes/alerts');
const climateRouter = require('./routes/climate');

// Use routes
app.use('/api/plants', plantsRouter);
app.use('/api/users', usersRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/climate', climateRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
