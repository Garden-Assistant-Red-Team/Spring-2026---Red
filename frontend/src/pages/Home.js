import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Welcome to Garden Assistant</h1>
      <p style={{ marginTop: 0 }}>
        Track your plants, get reminders, and keep notes/checklists in one place.
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        <Link to="/login">
          <button style={{ padding: "10px 16px" }}>Log In</button>
        </Link>

        <Link to="/signup">
          <button style={{ padding: "10px 16px" }}>Sign Up</button>
        </Link>
      </div>

      <div style={{ marginTop: 28 }}>
        <h3>What you can do</h3>
        <ul>
          <li>See all your plants in one view</li>
          <li>Add notes + daily checklists</li>
          <li>Use tools like recommendations and symptom assessment</li>
        </ul>
      </div>
    </div>
  );
}
