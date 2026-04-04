const express = require("express");
const router = express.Router();
const axios = require("axios");
const admin = require("firebase-admin");
const db = admin.firestore();

// Weather adjustment helpers
const {
  pauseOutdoorPlantsForFrost,
  increaseWateringForHeat,
  // helper for heavy rain
  adjustWateringRemindersForRain
} = require('./autoReminders');
const { saveWeatherAlerts, buildWeatherAlerts } = require('./alerts');

// Thresholds for weather conditions
const THRESHOLDS = {
  frost: 32,    
  heat: 95,      
  heavyRainMm: 10
};

// GET /api/weather?city=Norfolk
router.get("/", async (req, res) => {
  const { city } = req.query;

  if (!process.env.OPENWEATHER_API_KEY) {
    return res.json({
      placeholder: true,
      city: city || "Unknown",
      temp: 72,
      condition: "Clear",
      humidity: 50,
      message: "No OPENWEATHER_API_KEY set. Returning placeholder weather."
    });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const q = city || "Norfolk";

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=${apiKey}&units=imperial`;
    const response = await axios.get(url);

    const data = response.data;
    return res.json({
      placeholder: false,
      city: data.name,
      temp: data.main.temp,
      condition: data.weather?.[0]?.main,
      humidity: data.main.humidity
    });
  } catch (err) {
    return res.status(500).json({ error: "Weather lookup failed", details: err.message });
  }
});

// helper: Adjust watering reminders for heavy rain
/*
async function adjustWateringRemindersForRain(uid) {
  const now = admin.firestore.Timestamp.now();
  const remindersSnap = await db
    .collection('users').doc(uid)
    .collection('reminders')
    .where('type', '==', 'water')
    .where('status', '==', 'pending')
    .get();

  if (remindersSnap.empty) return 0;

  const batch = db.batch();
  remindersSnap.docs.forEach(doc => {
    const reminder = doc.data();
    // Push due date by 1 day
    const newDue = reminder.dueAt.toDate();
    newDue.setDate(newDue.getDate() + 1);

    batch.update(doc.ref, {
      dueAt: admin.firestore.Timestamp.fromDate(newDue),
      updatedAt: now,
      skipReason: 'heavyRain'
    });
  });

  await batch.commit();
  return remindersSnap.size;
}
*/

// USER WEATHER CHECK
router.get("/users/:uid/check", async (req, res) => {
  try {
    const { uid } = req.params;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ exists: false, message: "User not found" });
    }

    const userData = userSnap.data();
    const settings = userData.settings;
    const weatherMeta = userData.weather;

    if (!settings?.weatherEnabled) {
      return res.json({
        message: "Weather is disabled by user",
        weather: weatherMeta
      });
    }

    const now = Date.now();
    const nextAllowed = weatherMeta?.nextAllowedCheckAt?.toMillis?.() || 0;

    if (settings.weatherRefreshPolicy === "ttl" && now < nextAllowed) {
      return res.json({
        message: "Using cached weather data",
        weather: weatherMeta
      });
    }

    if(!process.env.OPENWEATHER_API_KEY) {
      return res.json({ error: "No OPENWEATHER_API_KEY set" });
    }

    const zip = userData.zipCode || "Norfolk";
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(zip)}&appid=${apiKey}&units=imperial`;
    const response = await axios.get(url);
    const forecast = response.data;

    const rainNext12hMm = forecast.list.slice(0, 4).reduce((sum, e) => sum + (e.rain?.["3h"] || 0), 0);
    const rainNext24hMm = forecast.list.slice(0, 8).reduce((sum, e) => sum + (e.rain?.["3h"] || 0), 0);
    const temp = forecast.list[0].main.temp;

    const ttlMinutes = settings.weatherTTLMinutes || 180;
    const ttlMs = ttlMinutes * 60 * 1000;

    const updatedWeather = {
      lastCheckedAt: admin.firestore.Timestamp.now(),
      nextAllowedCheckAt: admin.firestore.Timestamp.fromMillis(now + ttlMs),
      lastResultSummary: { rainNext12hMm, rainNext24hMm, temp },
      source: "openweather"
    };

    await userRef.update({ weather: updatedWeather });

    return res.json({ message: "Weather refreshed", weather: updatedWeather });

  } catch (err) {
    console.error("Weather check error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// LOGIN WEATHER CHECK
router.post("/users/:uid/login-check", async (req, res) => {
  try {
    const { uid } = req.params;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "User not found" });

    const userData = userSnap.data();
    const settings = userData.settings;
    if (!settings?.weatherEnabled || !settings?.careAutoAdjustEnabled) {
      return res.json({ message: "Weather or auto-adjust disabled, skipping" });
    }

    const weatherMeta = userData.weather;
    const now = Date.now();
    const nextAllowed = weatherMeta?.nextAllowedCheckAt?.toMillis?.() || 0;

    let weather;
    if (settings.weatherRefreshPolicy === "ttl" && now < nextAllowed) {
      weather = weatherMeta.lastResultSummary;
    } else {
      const zip = userData.zipCode || "Norfolk";
      const apiKey = process.env.OPENWEATHER_API_KEY;
      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(zip)}&appid=${apiKey}&units=imperial`;
      const response = await axios.get(url);
      const forecast = response.data;

      const rainNext12hMm = forecast.list.slice(0, 4).reduce((sum, e) => sum + (e.rain?.["3h"] || 0), 0);
      const rainNext24hMm = forecast.list.slice(0, 8).reduce((sum, e) => sum + (e.rain?.["3h"] || 0), 0);
      const temp = forecast.list[0].main.temp;
      const condition = forecast.list[0].weather?.[0]?.main || "Unknown";

      weather = { temp, condition, rainNext12hMm, rainNext24hMm };

      const ttlMs = (settings.weatherTTLMinutes || 180) * 60 * 1000;
      await userRef.update({
        "weather.lastCheckedAt": admin.firestore.Timestamp.now(),
        "weather.nextAllowedCheckAt": admin.firestore.Timestamp.fromMillis(now + ttlMs),
        "weather.lastResultSummary": weather,
        "weather.source": "openweather"
      });
    }

    const conditions = {
      isFrost: weather.temp <= THRESHOLDS.frost,
      isHeat: weather.temp >= THRESHOLDS.heat,
      isHeavyRain: weather.rainNext12hMm >= THRESHOLDS.heavyRainMm
    };

    // Adjust reminders
    const results = {};
    if (conditions.isFrost) results.pausedForFrost = await pauseOutdoorPlantsForFrost(uid);
    if (conditions.isHeat) results.adjustedForHeat = await increaseWateringForHeat(uid);
    if (conditions.isHeavyRain) results.delayedForRain = await adjustWateringRemindersForRain(uid);

    // Save alerts
    const alerts = buildWeatherAlerts(conditions, weather);
    await saveWeatherAlerts(uid, alerts);

    return res.json({ message: "Login weather check complete", weather, conditions, adjustments: results });
  } catch (err) {
    console.error("Login weather check error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// DAILY WEATHER CHECK
async function runDailyWeatherCheck() {
  console.log('[Weather Job] Starting daily weather check...');

  const usersSnap = await db.collection('users').get();
  if (usersSnap.empty) return;

  await Promise.all(usersSnap.docs.map(async (userDoc) => {
    const uid = userDoc.id;
    const zip = userDoc.data().zipCode;
    if (!zip) return;

    try {
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) throw new Error('OPENWEATHER_API_KEY not set');

      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(zip)}&appid=${apiKey}&units=imperial`;
      const response = await axios.get(url);
      const forecast = response.data;

      const rainNext12hMm = forecast.list.slice(0, 4).reduce((sum, e) => sum + (e.rain?.['3h'] || 0), 0);
      const rainNext24hMm = forecast.list.slice(0, 8).reduce((sum, e) => sum + (e.rain?.['3h'] || 0), 0);
      const temp = forecast.list[0].main.temp;
      const condition = forecast.list[0].weather?.[0]?.main || 'Unknown';

      const weather = { temp, condition, rainNext12hMm, rainNext24hMm };
      const conditions = {
        isFrost:     temp <= THRESHOLDS.frost,
        isHeat:      temp >= THRESHOLDS.heat,
        isHeavyRain: rainNext12hMm >= THRESHOLDS.heavyRainMm
      };

      // Save alerts
      const alerts = buildWeatherAlerts(conditions, weather);
      await saveWeatherAlerts(uid, alerts);

      // Adjust reminders
      if (conditions.isFrost) await pauseOutdoorPlantsForFrost(uid);
      if (conditions.isHeat) await increaseWateringForHeat(uid);
      if (conditions.isHeavyRain) await adjustWateringRemindersForRain(uid);

      // Cache result
      await db.collection('users').doc(uid).update({
        'weather.lastCheckedAt': admin.firestore.Timestamp.now(),
        'weather.lastResultSummary': {
          temp, condition, rainNext12hMm, rainNext24hMm,
          isFrost: conditions.isFrost,
          isHeat: conditions.isHeat,
          isHeavyRain: conditions.isHeavyRain
        },
        'weather.source': 'openweather'
      });

    } catch (err) {
      console.error(`[Weather Job] Failed for user ${uid}:`, err.message);
    }
  }));

  console.log('[Weather Job] Daily check complete.');
}

module.exports = { router, runDailyWeatherCheck };