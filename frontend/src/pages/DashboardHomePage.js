import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import DashboardLayout from "../components/DashboardLayout";
import "./ToolLayout.css";
import WeatherAlertBanner from "../components/WeatherAlertBanner";

export default function DashboardHomePage() {
  const [displayName, setDisplayName] = useState("there");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setDisplayName("there");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));

        if (snap.exists()) {
          const data = snap.data();
          const name =
            data.fullName ||
            user.displayName ||
            user.email?.split("@")[0] ||
            "there";
          setDisplayName(name);
        } else {
          setDisplayName(user.displayName || user.email?.split("@")[0] || "there");
        }
      } catch (err) {
        setDisplayName(user.displayName || user.email?.split("@")[0] || "there");
      }
    });

    return () => unsub();
  }, []);

  return (
    <DashboardLayout
      title={`Hello, ${displayName}`}
      subtitle="Welcome back. Use your dashboard to manage plants, tools, resources, and account settings."
      badge="Dashboard"
    >
      <div className="container">
        <WeatherAlertBanner />
        <div className="homeDashboardGrid">
          <section className="panel heroPanel">
            <div className="heroDashboardCard">
              <div className="heroDashboardContent">
                <span className="heroEyebrow">Welcome back</span>
                <h2 className="heroDashboardTitle">Your plant care dashboard</h2>
                <p className="heroDashboardText">
                  Jump back into My Garden, manage reminders, view recommendations,
                  explore resources, or update your settings.
                </p>

                <div className="heroDashboardActions">
                  <Link to="/garden" className="primaryBtn heroBtnLink">
                    Open My Garden
                  </Link>
                  <Link to="/tools/reminders" className="secondaryBtn heroBtnLink">
                    View Reminders
                  </Link>
                  <Link to="/profile/settings" className="secondaryBtn heroBtnLink">
                    Open Settings
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="summaryGrid">
            <div className="summaryCard">
              <span className="summaryLabel">My Garden</span>
              <span className="summaryValue">Plants</span>
            </div>

            <div className="summaryCard">
              <span className="summaryLabel">Tools</span>
              <span className="summaryValue">Care</span>
            </div>

            <div className="summaryCard">
              <span className="summaryLabel">Resources</span>
              <span className="summaryValue">Learn</span>
            </div>

            <div className="summaryCard">
              <span className="summaryLabel">Settings</span>
              <span className="summaryValue">Account</span>
            </div>
          </section>

          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Quick Actions</h2>
            </div>

            <div className="featureList">
              <Link to="/garden" className="dashboardLinkCard">
                <div className="featureTitle">Go to My Garden</div>
                <p className="muted">
                  Open your plants, notes, checklist items, and calendar.
                </p>
              </Link>

              <Link to="/tools/recommendations" className="dashboardLinkCard">
                <div className="featureTitle">Plant Recommendations</div>
                <p className="muted">
                  See plant suggestions based on your garden zone.
                </p>
              </Link>

              <Link to="/tools/symptoms" className="dashboardLinkCard">
                <div className="featureTitle">Symptom Assessment</div>
                <p className="muted">
                  Check likely plant issues based on symptoms and observations.
                </p>
              </Link>

              <Link to="/tools/weather" className="dashboardLinkCard">
                <div className="featureTitle">Weather</div>
                <p className="muted">
                  Look up current weather conditions for plant care planning.
                </p>
              </Link>

              <Link to="/resources" className="dashboardLinkCard">
                <div className="featureTitle">Resources</div>
                <p className="muted">
                  Browse plant information and reference material.
                </p>
              </Link>

              <Link to="/profile/settings" className="dashboardLinkCard">
                <div className="featureTitle">Settings</div>
                <p className="muted">
                  Edit your profile, log out, or delete your account.
                </p>
              </Link>
            </div>
          </section>

          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">About the Website</h2>
            </div>

            <p className="muted">
              Garden Assistant is built to give users one place to manage plant care.
              From reminders to recommendations to weather and resources, the site is
              designed to keep everything organized and easy to use.
            </p>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}