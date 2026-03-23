import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { deleteUser, signOut } from "firebase/auth";
import DashboardLayout from "../components/DashboardLayout";
import "./ToolLayout.css";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogout = async () => {
    setMessage("");
    setLogoutLoading(true);

    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      setMessage(err.message || "Failed to log out.");
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
      return;
    }

    setLoading(true);

    try {
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
      navigate("/");
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        setMessage(
          "For security, please log out and log back in, then try deleting again."
        );
      } else {
        setMessage(err.code || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your account, profile access, and account actions."
      badge="Account settings"
    >
      <div className="container">
        <div className="settingsGrid">
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Profile</h2>
            </div>

            <p className="muted">
              Open your profile to edit your name, garden zone, phone number, and password.
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

          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Session</h2>
            </div>

            <p className="muted">
              Log out of your account and return to the home page.
            </p>

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

          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Delete Account</h2>
            </div>

            <p className="muted">
              Permanently remove your profile and account. This action cannot be undone.
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

        {message && (
          <section className="panel" style={{ marginTop: 20 }}>
            <p style={{ margin: 0 }}>{message}</p>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}