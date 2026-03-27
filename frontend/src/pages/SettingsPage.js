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

          {/* Weather Settings */}
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Weather & Care</h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={weatherEnabled}
                  onChange={(e) => setWeatherEnabled(e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Enable weather alerts</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Get weather-based reminders and alerts
                  </div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={careAutoAdjustEnabled}
                  onChange={(e) => setCareAutoAdjustEnabled(e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Auto-adjust care reminders</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Automatically skip watering when rain is expected
                  </div>
                </div>
              </label>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Units</div>
                <select
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="dashboardInput"
                >
                  <option value="imperial">Imperial (°F)</option>
                  <option value="metric">Metric (°C)</option>
                </select>
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
                { value: "full_sun", label: "Full Sun", desc: "6+ hours of direct sunlight" },
                { value: "part_sun", label: "Partial Sun", desc: "3-6 hours of direct sunlight" },
                { value: "shade", label: "Shade", desc: "Less than 3 hours of direct sunlight" }
              ].map(({ value, label, desc }) => (
                <label key={value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={sunlightPreference.includes(value)}
                    onChange={() => toggleSunlight(value)}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>

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