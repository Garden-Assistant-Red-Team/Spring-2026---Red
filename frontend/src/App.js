import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { ensureUserDoc } from "./utils/ensureUserDoc";

import LandingPage from "./pages/LandingPage";
import DashboardHomePage from "./pages/DashboardHomePage";
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

export default function App() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) await ensureUserDoc(user);
    });
    return () => unsub();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardHomePage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route path="/garden" element={<MyGardenPage />} />
        <Route path="/tools/recommendations" element={<PlantRecommendationPage />} />
        <Route path="/tools/symptoms" element={<SymptomAssessmentPage />} />
        <Route path="/tools/reminders" element={<RemindersPage />} />
        <Route path="/tools/weather" element={<WeatherPage />} />
        <Route path="/weather" element={<WeatherPage />} />

        <Route path="/resources" element={<PlantDictionaryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/settings" element={<SettingsPage />} />

        <Route path="/about" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}