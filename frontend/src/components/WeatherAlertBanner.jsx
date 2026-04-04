import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function WeatherAlertBanner() {
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) loadWeatherAlerts();
      else setWeatherAlerts([]);
    });
    return () => unsubscribe();
  }, []);

  async function loadWeatherAlerts() {
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const data = userSnap.data();
      const summary = data?.weather?.lastResultSummary;
      if (!summary) return;

      const alerts = [];

      if (summary.isFrost || summary.temp <= 32) {
        alerts.push({
          type: "frost",
          icon: "🧊",
          title: "Frost Warning",
          message: `Temperature is ${Math.round(summary.temp)}°F. Your outdoor plants may be at risk. Consider bringing them inside.`,
          color: "#d0e8f2",
          borderColor: "#5aa8d0",
          textColor: "#1a4f6e"
        });
      }

      if (summary.isHeat || summary.temp >= 95) {
        alerts.push({
          type: "heat",
          icon: "🌡️",
          title: "Heat Warning",
          message: `Temperature is ${Math.round(summary.temp)}°F. Water your plants more frequently and provide shade if possible.`,
          color: "#fdecd0",
          borderColor: "#e8a838",
          textColor: "#7a4a00"
        });
      }

      if (summary.isHeavyRain || summary.rainNext12hMm >= 10) {
        alerts.push({
          type: "rain",
          icon: "🌧️",
          title: "Heavy Rain Expected",
          message: `${Math.round(summary.rainNext12hMm)}mm of rain expected in the next 12 hours. Watering reminders have been skipped automatically.`,
          color: "#ddeedd",
          borderColor: "#4a8c5c",
          textColor: "#1a4a2a"
        });
      }

      setWeatherAlerts(alerts);
      setDismissed(false);
    } catch (err) {
      console.error("Failed to load weather alerts:", err.message);
    }
  }

  if (dismissed || weatherAlerts.length === 0) return null;

  return (
    <div style={{
      margin: "16px 24px 0 24px",
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      gap: 2,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
    }}>
      {weatherAlerts.map((alert, index) => (
        <div
          key={alert.type}
          style={{
            background: alert.color,
            border: `1.5px solid ${alert.borderColor}`,
            borderRadius: index === 0 && weatherAlerts.length === 1 ? 14 :
                          index === 0 ? "14px 14px 4px 4px" :
                          index === weatherAlerts.length - 1 ? "4px 4px 14px 14px" : 4,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: alert.textColor,
          }}
        >
          <span style={{ fontSize: 22 }}>{alert.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{alert.title}</div>
            <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>{alert.message}</div>
          </div>
          {index === 0 && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: alert.textColor,
                opacity: 0.6,
                padding: "0 4px",
                lineHeight: 1,
                alignSelf: "flex-start"
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}