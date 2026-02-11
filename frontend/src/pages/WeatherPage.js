import React, { useState } from "react";

export default function WeatherPage() {
  const [city, setCity] = useState("Norfolk");
  const [stateCode, setStateCode] = useState("VA");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  // IMPORTANT: put your weather API key in a .env file (step 2)
  const API_KEY = process.env.REACT_APP_WEATHER_API_KEY;

  async function handleSearch(e) {
    e.preventDefault();
    setErr("");
    setData(null);

    if (!API_KEY) {
      setErr("Missing API key. Add REACT_APP_WEATHER_API_KEY to your .env file and restart npm start.");
      return;
    }

    try {
      setLoading(true);

      // Example using OpenWeather (current weather)
      const q = `${city},${stateCode},US`;
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        q
      )}&appid=${API_KEY}&units=imperial`;

      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || "Weather request failed");
      }

      setData(json);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Weather</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Check current weather for a city.
      </p>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (e.g., Norfolk)"
          style={{ flex: 1, padding: 10 }}
        />
        <input
          value={stateCode}
          onChange={(e) => setStateCode(e.target.value)}
          placeholder="State (e.g., VA)"
          style={{ width: 110, padding: 10 }}
        />
        <button type="submit" style={{ padding: "10px 16px" }}>
          {loading ? "Loading..." : "Search"}
        </button>
      </form>

      {err && (
        <p style={{ marginTop: 16, color: "crimson" }}>
          ❌ {err}
        </p>
      )}

      {data && (
        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "white",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {data.name} — {Math.round(data.main.temp)}°F
          </h2>
          <p style={{ margin: 0 }}>
            <strong>Conditions:</strong> {data.weather?.[0]?.description}
          </p>
          <p style={{ margin: "6px 0 0 0" }}>
            <strong>Feels like:</strong> {Math.round(data.main.feels_like)}°F •{" "}
            <strong>Humidity:</strong> {data.main.humidity}% •{" "}
            <strong>Wind:</strong> {Math.round(data.wind.speed)} mph
          </p>
        </div>
      )}
    </div>
  );
}
