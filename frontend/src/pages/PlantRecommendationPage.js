import React, { useState } from "react";
import "./ToolLayout.css";

export default function PlantRecommendationPage() {
  const [zip, setZip] = useState("");
  const [soil, setSoil] = useState("");
  const [selected, setSelected] = useState("Plant Name #1");

  const suggestions = ["Plant Name #1", "Plant Name #2", "Plant Name #3"];

  return (
    <div className="toolPage">
      {/* Hero band */}
      <h1 className="toolTitle">Plant Recommendation</h1>

      <div className="container">
        <div className="toolGrid">
          {/* LEFT */}
          <section className="panel">
            <h2 className="panelTitle">Input Location and Soil Data</h2>

            <label className="field">
              <span>Zip Code</span>
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="Enter zip code..."
              />
            </label>

            <label className="field">
              <span>Soil Type</span>
              <input
                value={soil}
                onChange={(e) => setSoil(e.target.value)}
                placeholder="Enter soil type..."
              />
            </label>

            <div style={{ height: 1, background: "rgba(0,0,0,0.10)", margin: "14px 0" }} />

            <h3 className="panelTitle">Climate Information</h3>
            <p className="muted">Temperature Range: ??°F to ??°F</p>
            <p className="muted">Location:</p>
          </section>

          {/* CENTER */}
          <section className="panel">
            <h2 className="panelTitle">Plant Suggestions</h2>

            <div className="listBox">
              {suggestions.map((name) => (
                <button
                  key={name}
                  className={"listItem " + (selected === name ? "active" : "")}
                  onClick={() => setSelected(name)}
                  type="button"
                >
                  {name}
                </button>
              ))}
            </div>
          </section>

          {/* RIGHT */}
          <section className="panel">
            <h2 className="panelTitle">Selected Plant</h2>
            <p className="muted">Genus, Epithet</p>

            <div className="imageBox">Image of Plant</div>

            <p className="muted">Temperature Range: ??°F to ??°F</p>
            <p className="muted">Information about plant suggestion.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
