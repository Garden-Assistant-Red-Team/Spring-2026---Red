import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./Header.css";

export default function Header() {
  const location = useLocation();

  const scrollToId = (id) => {
    // If not on home, go to home with hash so Home scrolls on load
    if (location.pathname !== "/") {
      window.location.href = `/#${id}`;
      return;
    }

    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link to="/" className="public-brand">
          Garden Assistant
        </Link>

        <nav className="public-tabs">
          <button type="button" className="tab" onClick={() => scrollToId("about")}>
            About
          </button>
          <button type="button" className="tab" onClick={() => scrollToId("team")}>
            Meet the Team
          </button>
          <button
            type="button"
            className="tab"
            onClick={() => scrollToId("contact")}
          >
            Contact Us
          </button>
        </nav>

        <div className="public-actions">
          <Link to="/login" className="public-login">
            Log In
          </Link>
          <Link to="/signup" className="public-signup">
            Sign Up
          </Link>
        </div>
      </div>
    </header>
  );
}