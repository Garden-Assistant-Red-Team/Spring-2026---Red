import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import NavBar from "./components/NavBar";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

import PlantRecommendationPage from "./pages/PlantRecommendationPage";
import SymptomAssessmentPage from "./pages/SymptomAssessmentPage";
import MyGardenPage from "./pages/MyGardenPage";
import RemindersPage from "./pages/RemindersPage";
import Home from "./pages/Home";
import WeatherPage from "./pages/WeatherPage";



export default function App() {
  return (
    <BrowserRouter>
      <NavBar />

      <Routes>
  <Route path="/" element={<Home />} />

  <Route path="/login" element={<LoginPage />} />
  <Route path="/signup" element={<SignupPage />} />

  <Route path="/tools/recommendations" element={<PlantRecommendationPage />} />
  <Route path="/tools/symptoms" element={<SymptomAssessmentPage />} />
  <Route path="/garden" element={<MyGardenPage />} />
  <Route path="/tools/reminders" element={<RemindersPage />} />
  <Route path="/weather" element={<WeatherPage />} />
  <Route path="/tools/weather" element={<WeatherPage />} />


  <Route path="/about" element={<h1 style={{ padding: 18 }}>About</h1>} />
  <Route path="/resources" element={<h1 style={{ padding: 18 }}>Resources</h1>} />
</Routes>

    </BrowserRouter>
  );
}

