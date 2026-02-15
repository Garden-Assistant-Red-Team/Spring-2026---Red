import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./Header.css";

export default function Header() {
  const location = useLocation();

  // Scroll smoothly to a section on the home page
  const scrollToSection = (id) => {
    // If user is not on home page, redirect with hash
    if (location.pathname !== "/") {
      window.location.href = `/#${id}`;
      return;
    }

    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="public-header">
      <div className="public-header-inner">
        
        {/* App Name */}
        <Link to="/" className="public-brand">
          Garden Assistant
        </Link>

        {/* Navigation Tabs */}
        <nav className="public-tabs">
          <button onClick={() => scrollToSection("about")} className="tab">
            About
          </button>

          <button onClick={() => scrollToSection("team")} className="tab">
            Meet the Team
          </button>

          <button onClick={() => scrollToSection("contact")} className="tab">
            Contact Us
          </button>
        </nav>

        {/* Authentication Links */}
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