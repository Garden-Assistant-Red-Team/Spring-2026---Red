import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import PlantRecommendationPage from "./pages/PlantRecommendationPage";
import SymptomAssessmentPage from "./pages/SymptomAssessmentPage";
import MyGardenPage from "./pages/MyGardenPage";
import RemindersPage from "./pages/RemindersPage";

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/tools/recommendations" />} />
        <Route path="/tools/recommendations" element={<PlantRecommendationPage />} />
        <Route path="/tools/symptoms" element={<SymptomAssessmentPage />} />
        <Route path="/about" element={<h1 style={{ padding: 18 }}>About</h1>} />
        <Route path="/resources" element={<h1 style={{ padding: 18 }}>Resources</h1>} />
        <Route path="/garden" element={<MyGardenPage />} />
        <Route path="/tools/reminders" element={<RemindersPage />} />
      </Routes>
    </BrowserRouter>
  );
}
