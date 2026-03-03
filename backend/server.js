require("dotenv").config();

const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const serviceAccount = require("./config/serviceAccountKey.json");

const app = express();

// ✅ Use PORT from env if set, otherwise use 5001 (avoids macOS port conflicts)
const PORT = process.env.PORT || 5001;

// Initialize Firebase Admin ONLY ONCE
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// Import routes
const usersRouter = require("./routes/users");
const remindersRouter = require("./routes/maunalReminders"); // (typo is in filename, but keep as-is)
const weatherRouter = require("./routes/weather");
const recommendationsRouter = require("./routes/recommendations");
const symptomsRouter = require("./routes/symptoms");
const gardenRouter = require("./routes/garden");
const identifyPlantRouter = require("./routes/identifyPlant");
const catalogRouter = require("./routes/catalog");

// Use routes
app.use("/api/users", usersRouter);
app.use("/api/reminders", remindersRouter);
app.use("/api/weather", weatherRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/symptoms", symptomsRouter);
app.use("/api/checklist", require("./routes/checklist"));
app.use("/api/garden", gardenRouter);
app.use("/api/identify-plant", identifyPlantRouter);
app.use("/api/catalog", catalogRouter);

// Simple routes for testing
app.get("/", (req, res) => {
  res.send("Garden Assistant API is running!");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});