import React, { useState } from "react";
import "./ToolLayout.css";
import DashboardLayout from "../components/DashboardLayout";

export default function WeatherPage() {
  const [city, setCity] = useState("Norfolk");
  const [stateCode, setStateCode] = useState("VA");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const API_KEY = process.env.REACT_APP_WEATHER_API_KEY;

  async function handleSearch(e) {
    e.preventDefault();
    setErr("");
    setData(null);

    if (!API_KEY) {
      setErr(
        "Missing API key. Add REACT_APP_WEATHER_API_KEY to your .env file and restart npm start."
      );
      return;
    }

    try {
      setLoading(true);

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
    <DashboardLayout
      title="Weather"
      subtitle="Check current weather conditions for your city."
      badge={`${city}, ${stateCode}`}
    >
      <div className="container">
        <div className="weatherGrid">
          <section className="panel">
            <h2 className="panelTitle">Search</h2>

            <form onSubmit={handleSearch} className="toolContentStack">
              <label className="field">
                <span>City</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City (e.g., Norfolk)"
                />
              </label>

              <label className="field">
                <span>State</span>
                <input
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  placeholder="State (e.g., VA)"
                />
              </label>

              <button type="submit" className="primaryBtn">
                {loading ? "Loading..." : "Search"}
              </button>
            </form>
          </section>

          <section className="panel">
            <h2 className="panelTitle">Current Conditions</h2>

            {err && (
              <p style={{ color: "crimson" }}>
                ❌ {err}
              </p>
            )}

            {!err && !data && (
              <p className="muted">Search for a city to see the current weather.</p>
            )}

            {data && (
              <div className="resultCard">
                <h2 style={{ marginTop: 0 }}>
                  {data.name} — {Math.round(data.main.temp)}°F
                </h2>
                <p>
                  <strong>Conditions:</strong> {data.weather?.[0]?.description}
                </p>
                <p>
                  <strong>Feels like:</strong> {Math.round(data.main.feels_like)}°F
                </p>
                <p>
                  <strong>Humidity:</strong> {data.main.humidity}%
                </p>
                <p>
                  <strong>Wind:</strong> {Math.round(data.wind.speed)} mph
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}