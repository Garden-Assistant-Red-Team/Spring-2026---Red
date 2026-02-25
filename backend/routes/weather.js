const express = require("express");
const router = express.Router();
const axios = require("axios");
const admin = require("firebase-admin");
const db = admin.firestore();

// GET /api/weather?city=Norfolk
router.get("/", async (req, res) => {
  const { city } = req.query;

  // If no API key, return placeholder
  if (!process.env.REACT_APP_WEATHER_API_KEY) {
    return res.json({
      placeholder: true,
      city: city || "Unknown",
      temp: 72,
      condition: "Clear",
      humidity: 50,
      message: "No REACT_APP_WEATHER_API_KEY set. Returning placeholder weather."
    });
  }

  try {
    const apiKey = process.env.REACT_APP_WEATHER_API_KEY;
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

    // If weather is disabled, returned cached weather data
    if (!settings?.weatherEnabled) {
      return res.json({
        message: "Weather is disabled by user",
        weather: weatherMeta
      });
    }
      const now = Date.now();
      const nextAllowed = weatherMeta?.nextAllowedCheckAt?.toMillis?.() || 0;

      // check TTL policy
      if (settings.weatherRefreshPolicy === "ttl" && now < nextAllowed) {
        return res.json({
          message: "Using cached weather data",
          weather: weatherMeta
        });
      }

      // check if api key
      if(!process.env.REACT_APP_WEATHER_API_KEY) {
        return res.json({
          error: "No REACT_APP_WEATHER_API_KEY"
        });
      }

      const zip = userData.zipCode || "Norfolk";
      const apiKey = process.env.REACT_APP_WEATHER_API_KEY;

      // Using forecast endpoint so we can calculate rain
      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(zip)}&appid=${apiKey}&units=imperial`;

      const response = await axios.get(url);
      const forecast = response.data;

      // Calculate rain in next 24 hours (8 x 3-hour blocks)
      const rainNext24hMm = forecast.list
      .slice(0, 8)
      .reduce((sum, entry) => {
        return sum + (entry.rain?.["3h"] || 0);
      }, 0);

      const temp = forecast.list[0].main.temp;

      const ttlMinutes = settings.weatherTTLMinutes || 180;
      const ttlMs = ttlMinutes * 60 * 1000;

      const updatedWeather = {
      lastCheckedAt: admin.firestore.Timestamp.now(),
      nextAllowedCheckAt:
        admin.firestore.Timestamp.fromMillis(now + ttlMs),
      lastResultSummary: {
        rainNext24hMm,
        temp
      },
      source: "openweather"
    };

    await userRef.update({ weather: updatedWeather });

    return res.json({
      message: "Weather refreshed",
      weather: updatedWeather
    });

  } catch (err) {
    console.error("Weather check error:", err);
    return res.status(500).json({ error: err.message });
  }
});


module.exports = router;
