import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { deleteUser } from "firebase/auth";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

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
      // 1) Delete Firestore profile document
      await deleteDoc(doc(db, "users", user.uid));

      await deleteUser(user);

      // Send them home 
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
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>Settings</h1>
      <p className="muted">This is your settings page. Add options here.</p>

      {message && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "white" }}>
          {message}
        </div>
      )}

      <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: "white" }}>
        <h3 style={{ marginTop: 0 }}>Account</h3>

        <button
          className="primaryBtn"
          type="button"
          onClick={handleDeleteAccount}
          disabled={loading}
          style={{
            background: "#b91c1c",
            border: "none",
            color: "white",
            padding: "10px 14px",
            borderRadius: 10,
            cursor: "pointer"
          }}
        >
          {loading ? "Deleting..." : "Delete account"}
        </button>
      </div>
    </div>
  );
}