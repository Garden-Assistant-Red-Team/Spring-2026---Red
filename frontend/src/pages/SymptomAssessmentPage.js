import React, { useState } from "react";
import "./ToolLayout.css";

export default function SymptomAssessmentPage() {
  const [symptomText, setSymptomText] = useState("");
  const [symptoms, setSymptoms] = useState(["Plant Symptom #1", "Plant Symptom #2"]);

  const addSymptom = () => {
    if (!symptomText.trim()) return;
    setSymptoms((prev) => [...prev, symptomText.trim()]);
    setSymptomText("");
  };

  const removeSymptom = (idx) => {
    setSymptoms((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="toolPage">
      <h1 className="toolTitle">Plant Symptom Assessment</h1>

      <div className="toolGrid">
        {/* LEFT */}
        <section className="panel">
          <h2 className="panelTitle">Enter symptoms</h2>

          <label className="field">
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

          <button className="primaryBtn" onClick={addSymptom}>
            Add symptom
          </button>

          <div className="listBox">
            {symptoms.map((s, idx) => (
              <div key={idx} className="pillRow">
                <span className="pill">{s}</span>
                <button className="xBtn" onClick={() => removeSymptom(idx)}>
                  x
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
  );
}
