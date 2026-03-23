import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import "./ToolLayout.css";

// Team Photos
import kenyta from "../images/kenyta.jpg";
import michael from "../images/michael.jpg";
import augustine from "../images/augustine.jpg";
import mariem from "../images/mariem.jpg";
import ryan from "../images/ryan.jpg";
import fred from "../images/fred.jpg";
import ibrahima from "../images/ibrahima.jpeg";

export default function Home() {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (!hash) return;

    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
    <DashboardLayout
      title="Home"
      subtitle="Welcome to Garden Assistant. Track plants, manage care, and use helpful plant tools in one place."
      badge="Garden dashboard"
    >
      <div className="container">
        <div className="homeDashboardGrid">
          <section className="panel heroPanel">
            <div className="heroDashboardCard">
              <div className="heroDashboardContent">
                <span className="heroEyebrow">All-in-one plant care</span>
                <h2 className="heroDashboardTitle">Welcome to Garden Assistant</h2>
                <p className="heroDashboardText">
                  Keep your plant collection organized, save notes, manage reminders,
                  and use tools like recommendations, weather, and symptom assessment.
                </p>

                <div className="heroDashboardActions">
                  <Link to="/login" className="primaryBtn heroBtnLink">
                    Log In
                  </Link>
                  <Link to="/signup" className="secondaryBtn heroBtnLink">
                    Sign Up
                  </Link>
                  <Link to="/garden" className="secondaryBtn heroBtnLink">
                    Go to My Garden
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section id="about" className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">About Garden Assistant</h2>
            </div>

            <p className="muted">
              Garden Assistant is a simple hub for managing your plants. Organize
              your collection, store notes, and use helpful tools to support
              better plant care.
            </p>

            <div className="featureList">
              <div className="featureCard">
                <div className="featureTitle">Organize your plants</div>
                <p className="muted">
                  Keep your saved plants in one place and quickly switch between them.
                </p>
              </div>

              <div className="featureCard">
                <div className="featureTitle">Stay on top of care</div>
                <p className="muted">
                  Add reminders, checklist items, and notes for each plant.
                </p>
              </div>

              <div className="featureCard">
                <div className="featureTitle">Use helpful tools</div>
                <p className="muted">
                  Get recommendations, weather updates, and symptom assessments.
                </p>
              </div>
            </div>
          </section>

          <section id="team" className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Meet the Team</h2>
            </div>

            <p className="muted" style={{ marginBottom: 16 }}>
              We’re a team of 7 developers building Garden Assistant.
            </p>

            <div className="teamDashboardGrid">
              {team.map((member) => (
                <div key={member.name} className="teamDashboardCard">
                  <img src={member.img} alt={member.name} className="teamDashboardPhoto" />
                  <h3>{member.name}</h3>
                  <p className="muted">Developer</p>
                </div>
              ))}
            </div>
          </section>

          <section id="contact" className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Contact Us</h2>
            </div>

            <p className="muted" style={{ marginBottom: 16 }}>
              Have feedback or questions? Send us a message or email us directly.
            </p>

            <div className="contactDashboardGrid">
              <form
                className="contactDashboardForm"
                onSubmit={(e) => {
                  e.preventDefault();
                  alert("Message submitted! (Connect this to your backend later.)");
                }}
              >
                <label className="field">
                  <span>Your name</span>
                  <input type="text" placeholder="Jane Doe" required />
                </label>

                <label className="field">
                  <span>Your email</span>
                  <input type="email" placeholder="jane@email.com" required />
                </label>

                <label className="field">
                  <span>Message</span>
                  <textarea placeholder="Write your message..." required />
                </label>

                <button type="submit" className="primaryBtn">
                  Send Message
                </button>
              </form>

              <div className="softCard">
                <h3 style={{ marginTop: 0 }}>Email</h3>
                <p className="muted">Prefer email? Reach us here:</p>

                <a className="emailDashboardLink" href="mailto:gardenassistant@odu.edu">
                  gardenassistant@odu.edu
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}