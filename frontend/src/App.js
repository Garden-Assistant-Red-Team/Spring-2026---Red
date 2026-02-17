import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import NavBar from "./components/NavBar";

import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";

import PlantRecommendationPage from "./pages/PlantRecommendationPage";
import SymptomAssessmentPage from "./pages/SymptomAssessmentPage";
import MyGardenPage from "./pages/MyGardenPage";
import RemindersPage from "./pages/RemindersPage";
import WeatherPage from "./pages/WeatherPage";
import PlantDictionaryPage from "./pages/PlantDictionaryPage";

function WithNav({ children }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC PAGES (no NavBar) */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* LOGGED-IN / APP PAGES (NavBar visible) */}

        <Route
          path="/garden"
          element={
            <WithNav>
              <MyGardenPage />
            </WithNav>
          }
        />

        <Route
          path="/tools/recommendations"
          element={
            <WithNav>
              <PlantRecommendationPage />
            </WithNav>
          }
        />

        <Route
          path="/tools/symptoms"
          element={
            <WithNav>
              <SymptomAssessmentPage />
            </WithNav>
          }
        />

        <Route
          path="/tools/reminders"
          element={
            <WithNav>
              <RemindersPage />
            </WithNav>
          }
        />

        <Route
          path="/weather"
          element={
            <WithNav>
              <WeatherPage />
            </WithNav>
          }
        />

        <Route
          path="/tools/weather"
          element={
            <WithNav>
              <WeatherPage />
            </WithNav>
          }
        />

        {/* ⭐ RESOURCES → PLANT DICTIONARY */}
        <Route
          path="/resources"
          element={
            <WithNav>
              <PlantDictionaryPage />
            </WithNav>
          }
        />

        {/* PROFILE */}
        <Route
          path="/profile"
          element={
            <WithNav>
              <ProfilePage />
            </WithNav>
          }
        />

        <Route
          path="/profile/settings"
          element={
            <WithNav>
              <SettingsPage />
            </WithNav>
          }
        />

        {/* OTHER */}
        <Route
          path="/about"
          element={
            <WithNav>
              <Home />
            </WithNav>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}
