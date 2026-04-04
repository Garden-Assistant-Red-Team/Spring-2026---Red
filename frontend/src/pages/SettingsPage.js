import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, deleteDoc, getDoc } from "firebase/firestore";
import { deleteUser, signOut } from "firebase/auth";
import DashboardLayout from "../components/DashboardLayout";
import "./ToolLayout.css";

const API_BASE = "http://localhost:5000";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" or "error"
  const navigate = useNavigate();

  // Settings state
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [careAutoAdjustEnabled, setCareAutoAdjustEnabled] = useState(true);
  const [units, setUnits] = useState("imperial");
  const [sunlightPreference, setSunlightPreference] = useState([]);

  // Load current settings on mount
  useEffect(() => {
    async function loadSettings() {
      if (!auth.currentUser) return;

      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setWeatherEnabled(data.settings?.weatherEnabled ?? true);
          setCareAutoAdjustEnabled(data.settings?.careAutoAdjustEnabled ?? true);
          setUnits(data.settings?.units || "imperial");
          setSunlightPreference(Array.isArray(data.sunlightPreference) ? data.sunlightPreference : []);
        }
      } catch (err) {
        console.error("Failed to load settings:", err.message);
      }
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) loadSettings();
    });
    return () => unsubscribe();
  }, []);

  function toggleSunlight(value) {
    setSunlightPreference((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function handleSaveSettings() {
    if (!auth.currentUser) return;
    setSaveLoading(true);
    setMessage("");

    try {
      const token = await auth.currentUser.getIdToken();
      const uid = auth.currentUser.uid;

      const res = await fetch(`${API_BASE}/api/users/${uid}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          weatherEnabled,
          careAutoAdjustEnabled,
          units,
          sunlightPreference
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save settings");

      setMessage("Settings saved successfully!");
      setMessageType("success");
    } catch (err) {
      setMessage(err.message || "Failed to save settings.");
      setMessageType("error");
    } finally {
      setSaveLoading(false);
    }
  }

  const handleLogout = async () => {
    setMessage("");
    setLogoutLoading(true);
    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      setMessage(err.message || "Failed to log out.");
      setMessageType("error");
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setMessage("");
    const ok = window.confirm(
      "Delete your account? This will permanently remove your profile and you will be signed out."
    );
    if (!ok) return;

    const user = auth.currentUser;
    if (!user) {
      setMessage("You are not logged in.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
      navigate("/");
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        setMessage("For security, please log out and log back in, then try deleting again.");
      } else {
        setMessage(err.code || err.message);
      }
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your account, preferences, and garden settings."
      badge="Account settings"
    >
      <div className="container">
        <div className="settingsGrid">

          {/* Profile */}
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Profile</h2>
            </div>
            <p className="muted">
              Edit your name, garden zone, phone number, and password.
            </p>
            <button
              className="primaryBtn"
              type="button"
              onClick={() => navigate("/profile")}
              style={{ marginTop: 14 }}
            >
              Edit Profile
            </button>
          </section>

          {/* Weather Settings */}
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Weather & Care</h2>
            </div>

            <p className="muted" style={{ marginBottom: 14 }}>
              Control how the app uses weather data to manage your plant care.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Weather Enabled Toggle */}
              <div
                className="softCard"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                onClick={() => setWeatherEnabled(!weatherEnabled)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Enable weather alerts</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    Get weather-based reminders and alerts
                  </div>
                </div>
                <div style={{
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  background: weatherEnabled ? "#2F6B4F" : "#ccc",
                  position: "relative",
                  transition: "background 0.2s",
                  flexShrink: 0
                }}>
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "white",
                    position: "absolute",
                    top: 3,
                    left: weatherEnabled ? 23 : 3,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                  }} />
                </div>
              </div>

              {/* Care Auto Adjust Toggle */}
              <div
                className="softCard"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                onClick={() => setCareAutoAdjustEnabled(!careAutoAdjustEnabled)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Auto-adjust care reminders</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    Automatically skip watering when rain is expected
                  </div>
                </div>
                <div style={{
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  background: careAutoAdjustEnabled ? "#2F6B4F" : "#ccc",
                  position: "relative",
                  transition: "background 0.2s",
                  flexShrink: 0
                }}>
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "white",
                    position: "absolute",
                    top: 3,
                    left: careAutoAdjustEnabled ? 23 : 3,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                  }} />
                </div>
              </div>

              {/* Units */}
              <div className="softCard">
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Units</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {["imperial", "metric"].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnits(u)}
                      style={{
                        padding: "8px 20px",
                        borderRadius: 999,
                        border: units === u ? "2px solid #2F6B4F" : "2px solid #ddd",
                        background: units === u ? "#2F6B4F" : "white",
                        color: units === u ? "white" : "#333",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                    >
                      {u === "imperial" ? "Imperial (°F)" : "Metric (°C)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Sunlight Preference */}
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Garden Sunlight</h2>
            </div>

            <p className="muted" style={{ marginBottom: 14 }}>
              Select the sunlight conditions in your garden. This helps us recommend the right plants.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { value: "full_sun", label: "Full Sun", desc: "6+ hours of direct sunlight", icon: "☀️" },
                { value: "part_sun", label: "Partial Sun", desc: "3-6 hours of direct sunlight", icon: "⛅" },
                { value: "shade", label: "Shade", desc: "Less than 3 hours of direct sunlight", icon: "🌥️" }
              ].map(({ value, label, desc, icon }) => {
                const isSelected = sunlightPreference.includes(value);
                return (
                  <div
                    key={value}
                    className="softCard"
                    onClick={() => toggleSunlight(value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      border: isSelected ? "2px solid #2F6B4F" : "2px solid transparent",
                      background: isSelected ? "#f0f7f3" : undefined,
                      transition: "all 0.15s"
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{desc}</div>
                    </div>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: isSelected ? "none" : "2px solid #ccc",
                      background: isSelected ? "#2F6B4F" : "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      {isSelected && <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Session */}
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Session</h2>
            </div>
            <p className="muted">Log out of your account.</p>
            <button
              className="secondaryBtn"
              type="button"
              onClick={handleLogout}
              disabled={logoutLoading}
              style={{ marginTop: 14 }}
            >
              {logoutLoading ? "Logging out..." : "Log Out"}
            </button>
          </section>

          {/* Delete Account */}
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Delete Account</h2>
            </div>
            <p className="muted">
              Permanently remove your profile and account. This cannot be undone.
            </p>
            <button
              className="dangerBtn"
              type="button"
              onClick={handleDeleteAccount}
              disabled={loading}
              style={{ marginTop: 14 }}
            >
              {loading ? "Deleting..." : "Delete Account"}
            </button>
          </section>

        </div>

        {/* Save Button */}
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button
            className="primaryBtn"
            type="button"
            onClick={handleSaveSettings}
            disabled={saveLoading}
          >
            {saveLoading ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {message && (
          <section className="panel" style={{ marginTop: 20 }}>
            <p style={{ margin: 0, color: messageType === "success" ? "green" : "crimson" }}>
              {message}
            </p>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}