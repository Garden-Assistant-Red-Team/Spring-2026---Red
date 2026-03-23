import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "./ToolLayout.css";

// Team Photos
import kenyta from "../images/kenyta.jpg";
import michael from "../images/michael.jpg";
import augustine from "../images/augustine.jpg";
import mariem from "../images/mariem.jpg";
import ryan from "../images/ryan.jpg";
import fred from "../images/fred.jpg";
import ibrahima from "../images/ibrahima.jpeg";

export default function LandingPage() {
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
    <div className="landingPage">
      <header className="landingHeader">
        <div className="landingBrand">
          <div className="landingBrandIcon">🌿</div>
          <div>
            <div className="landingBrandTitle">Garden Assistant</div>
            <div className="landingBrandSub">Plant care made easier</div>
          </div>
        </div>

        <nav className="landingNav">
          <a href="#about">About</a>
          <a href="#team">Team</a>
          <a href="#contact">Contact</a>
          <Link to="/login" className="landingLoginLink">
            Log In
          </Link>
          <Link to="/signup" className="landingSignupBtn">
            Sign Up
          </Link>
        </nav>
      </header>

      <main className="landingMain">
        <section className="landingHero">
          <div className="landingHeroContent">
            <span className="landingEyebrow">All-in-one plant care platform</span>
            <h1 className="landingHeroTitle">A smarter way to care for your garden</h1>
            <p className="landingHeroText">
              Save your plants, manage reminders, track notes, check weather, and
              use helpful plant tools all in one place.
            </p>

            <div className="landingHeroActions">
              <Link to="/signup" className="primaryBtn heroBtnLink">
                Get Started
              </Link>
              <Link to="/login" className="secondaryBtn heroBtnLink">
                Log In
              </Link>
            </div>
          </div>

          <div className="landingHeroCard">
            <div className="landingPreviewStat">
              <span>My Garden</span>
              <strong>Plants, notes, reminders</strong>
            </div>
            <div className="landingPreviewStat">
              <span>Tools</span>
              <strong>Recommendations, symptoms, weather</strong>
            </div>
            <div className="landingPreviewStat">
              <span>Resources</span>
              <strong>Plant info in one place</strong>
            </div>
          </div>
        </section>

        <section id="about" className="landingSection">
          <div className="landingSectionHeader">
            <h2>About Garden Assistant</h2>
            <p>
              Garden Assistant helps users organize plant care and quickly access
              useful plant-related tools from one website.
            </p>
          </div>

          <div className="featureList">
            <div className="featureCard">
              <div className="featureTitle">Manage your plants</div>
              <p className="muted">
                Keep your saved plants organized and switch between them easily.
              </p>
            </div>

            <div className="featureCard">
              <div className="featureTitle">Stay on schedule</div>
              <p className="muted">
                Add reminders, notes, and tasks so nothing gets missed.
              </p>
            </div>

            <div className="featureCard">
              <div className="featureTitle">Use built-in tools</div>
              <p className="muted">
                Access weather, recommendations, and symptom assessment tools.
              </p>
            </div>
          </div>
        </section>

        <section id="team" className="landingSection">
          <div className="landingSectionHeader">
            <h2>Meet the Team</h2>
            <p>We’re a team of 7 developers building Garden Assistant.</p>
          </div>

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

        <section id="contact" className="landingSection">
          <div className="landingSectionHeader">
            <h2>Contact Us</h2>
            <p>Have questions or feedback? Reach out below.</p>
          </div>

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
      </main>
    </div>
  );
}