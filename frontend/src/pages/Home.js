import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./Home.css";

// Team Photos
import kenyta from "../images/kenyta.jpg";
import michael from "../images/michael.jpg";
import augustine from "../images/augustine.jpg";
import mariem from "../images/mariem.jpg";
import ryan from "../images/ryan.jpg";
import fred from "../images/fred.jpg";
import ibrahima from "../images/ibrahima.jpeg";
//import placeholder from "../images/placeholder.jpg";
// Background
import heroBg from "../images/hero.jpg";

export default function Home() {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (!hash) return;

    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  const team = [
    { name: "Kenyta Blount", img: kenyta },
    { name: "Michael Hollingsworth", img: michael },
    { name: "Augustine Kpewa", img: augustine },
    { name: "Mariem Mohamed", img: mariem },
    { name: "Ryan Siebert-Ngo", img: ryan },
    { name: "Fred Terling", img: fred },
    { name: "Ibrahima Wann", img: ibrahima },
  ];

  return (
    <div className="home-wrapper">
      <Header />

      <main className="home-container">
        {/* HERO */}
        <section
          className="hero"
          style={{ backgroundImage: `url(${heroBg})` }}
        >
          <div className="hero-content">
            <h1>Welcome to Garden Assistant</h1>
            <p>
              Track your plants, get reminders, and keep notes and checklists all
              in one place.
            </p>

            <div className="cta-buttons">
              <Link to="/login" className="primary-btn">
                Log In
              </Link>
              <Link to="/signup" className="secondary-btn">
                Sign Up
              </Link>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="section card">
          <h2>About Garden Assistant</h2>
          <p>
            Garden Assistant is a simple hub for managing your plants. Organize your
            collection, store notes, and use helpful tools to support better plant care.
          </p>

          <ul>
            <li>Keep your plant collection organized</li>
            <li>Add notes and daily checklists</li>
            <li>Use tools like recommendations and symptom assessment</li>
          </ul>
        </section>

        {/* TEAM */}
        <section id="team" className="section">
          <h2>Meet the Team</h2>
          <p className="muted">
            We’re a team of 7 developers building Garden Assistant.
          </p>

          <div className="team-grid">
            {team.map((member) => (
              <div key={member.name} className="team-card">
                <img
                  src={member.img}
                  alt={member.name}
                  className="team-photo"
                />
                <h3>{member.name}</h3>
                <p>Developer</p>
              </div>
            ))}
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="section card">
          <h2>Contact Us</h2>
          <p className="muted">
            Have feedback or questions? Send us a message or email us directly.
          </p>

          <div className="contact-grid">
            <form
              className="contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                alert("Message submitted! (Connect this to your backend later.)");
              }}
            >
              <label>
                Your name
                <input type="text" placeholder="Jane Doe" required />
              </label>

              <label>
                Your email
                <input type="email" placeholder="jane@email.com" required />
              </label>

              <label>
                Message
                <textarea placeholder="Write your message..." required />
              </label>

              <button type="submit" className="submit-btn">
                Send Message
              </button>
            </form>

            <div className="contact-side">
              <h3>Email</h3>
              <p className="muted">Prefer email? Reach us here:</p>

              <a className="email-link" href="mailto:gardenassistant@odu.edu">
                gardenassistant@odu.edu
              </a>

              <div className="contact-note">
                <div className="contact-note-title">Additional contact</div>
                <a className="email-link" href="mailto:iwann001@odu.edu">
                  iwann001@odu.edu
                </a>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}