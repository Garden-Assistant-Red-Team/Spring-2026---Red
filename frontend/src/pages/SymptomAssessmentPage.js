import React, { useState } from "react";
import "./ToolLayout.css";

export default function SymptomAssessmentPage() {
  const [symptomText, setSymptomText] = useState("");
  const [symptoms, setSymptoms] = useState(["Plant Symptom #1", "Plant Symptom #2"]);

  const addSymptom = () => {
    const cleaned = symptomText.trim();
    if (!cleaned) return;

    setSymptoms((prev) => [...prev, cleaned]);
    setSymptomText("");
  };

  const removeSymptom = (idx) => {
    setSymptoms((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="toolPage">
      {/* Hero band */}
      <h1 className="toolTitle">Plant Symptom Assessment</h1>

      <div className="container">
        <div className="toolGrid">
          {/* LEFT */}
          <section className="panel">
            <h2 className="panelTitle">Enter symptoms</h2>

            {/* Input + button on same row */}
            <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
              <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                <span>Symptoms</span>
                <input
                  value={symptomText}
                  onChange={(e) => setSymptomText(e.target.value)}
                  placeholder="Enter symptoms..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addSymptom();
                  }}
                />
              </label>

              <button
                className="primaryBtn"
                onClick={addSymptom}
                type="button"
                style={{ height: 44, whiteSpace: "nowrap" }}
              >
                Add symptom
              </button>
            </div>

            {/* Symptom pills */}
            <div className="pills">
              {symptoms.map((s, idx) => (
                <div key={s + idx} className="pill">
                  <span>{s}</span>
                  <button
                    type="button"
                    onClick={() => removeSymptom(idx)}
                    aria-label="Remove symptom"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* CENTER */}
          <section className="panel">
            <h2 className="panelTitle">Symptom Information</h2>
            <div className="imageBox">Image of Symptom</div>
            <p className="muted">Detailed information about symptoms.</p>
          </section>

          {/* RIGHT */}
          <section className="panel">
            <h2 className="panelTitle">Plantcare Advice</h2>

            <div className="issueBox">
              <h3>Estimated Issue #1</h3>
              <p className="muted">Reasoning of connecting symptoms to issue.</p>
              <p className="muted">Description of treatment for issue.</p>
            </div>

            <div className="issueBox">
              <h3>Estimated Issue #2</h3>
              <p className="muted">Reasoning of connecting symptoms to issue.</p>
              <p className="muted">Description of treatment for issue.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
