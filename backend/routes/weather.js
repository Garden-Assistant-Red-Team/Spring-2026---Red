const express = require("express");
const router = express.Router();
const axios = require("axios");

// GET /api/weather?city=Norfolk
router.get("/", async (req, res) => {
  const { city } = req.query;

  // If no API key, return placeholder
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

module.exports = router;
