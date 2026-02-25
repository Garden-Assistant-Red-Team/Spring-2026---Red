import React, { useEffect, useMemo, useState } from "react";
import "./ToolLayout.css";

export default function SymptomAssessmentPage() {
  const [loading, setLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const [error, setError] = useState("");

  const [allSymptoms, setAllSymptoms] = useState([]);
  const [allObservations, setAllObservations] = useState([]);

  const [query, setQuery] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState(new Set());

  // Keep V1 observations small + helpful
  const [observations, setObservations] = useState({
    soil_moisture: "",
    light_level: "",
    fertilized_recently: false,
    humidity_low: false,
    drafts_temp_fluctuations: false,
    poor_drainage_or_saucer_water: false,
  });

  const [results, setResults] = useState(null);

  // For nicer "why" labels
  const labelMap = useMemo(() => {
    const map = new Map();
    for (const s of allSymptoms) map.set(s.id, s.label || s.id);
    for (const o of allObservations) map.set(o.id, o.label || o.id);
    return map;
  }, [allSymptoms, allObservations]);

  useEffect(() => {
    let mounted = true;

    async function loadOptions() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/symptoms/options");
        if (!res.ok) throw new Error("Failed to load symptom options");

        const data = await res.json();
        if (!mounted) return;

        setAllSymptoms(data.symptoms || []);
        setAllObservations(data.observations || []);
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load options");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  const groupedSymptoms = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? allSymptoms.filter((s) => (s.label || "").toLowerCase().includes(q))
      : allSymptoms;

    const groups = {};
    for (const s of list) {
      const cat = s.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }

    Object.keys(groups).forEach((k) => {
      groups[k].sort((a, b) => (a.uiOrder ?? 999) - (b.uiOrder ?? 999));
    });

    return groups;
  }, [allSymptoms, query]);

  function toggleSymptom(id) {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setObs(id, value) {
    setObservations((prev) => ({ ...prev, [id]: value }));
  }

  function clearAll() {
    setSelectedSymptoms(new Set());
    setObservations({
      soil_moisture: "",
      light_level: "",
      fertilized_recently: false,
      humidity_low: false,
      drafts_temp_fluctuations: false,
      poor_drainage_or_saucer_water: false,
    });
    setResults(null);
    setError("");
  }

  function normalizeObservations(obs) {
    const cleaned = {};
    for (const [k, v] of Object.entries(obs)) {
      if (v === "" || v === null || typeof v === "undefined") continue;
      cleaned[k] = v;
    }
    return cleaned;
  }

  async function runDiagnosis() {
    try {
      setDiagnosing(true);
      setError("");
      setResults(null);

      const body = {
        selectedSymptoms: Array.from(selectedSymptoms),
        observations: normalizeObservations(observations),
      };

      const res = await fetch("/api/symptoms/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Diagnosis failed");
      }

      const data = await res.json();
      setResults(data);
    } catch (e) {
      setError(e.message || "Diagnosis failed");
    } finally {
      setDiagnosing(false);
    }
  }

  const selectedLabels = useMemo(() => {
    return Array.from(selectedSymptoms).map((id) => ({
      id,
      label: labelMap.get(id) || id,
    }));
  }, [selectedSymptoms, labelMap]);

  const canDiagnose = selectedSymptoms.size > 0 && !diagnosing;

  return (
    <div className="toolPage">
      <h1 className="toolTitle">Plant Symptom Assessment</h1>

      <div className="container">
        {error ? (
          <div className="panel" style={{ marginBottom: 16 }}>
            <p style={{ margin: 0 }}>
              <strong>Error:</strong> {error}
            </p>
          </div>
        ) : null}

        <div className="toolGrid twoCol">
          {/* LEFT: Inputs */}
          <section className="panel">
            <h2 className="panelTitle">1) Select symptoms</h2>

            <label className="field">
              <span>Search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to filter (ex: yellow, spots, wilting)"
              />
            </label>

            {loading ? (
              <p className="muted">Loading symptom options…</p>
            ) : (
              <>
                {Object.keys(groupedSymptoms).length === 0 ? (
                  <p className="muted">No symptoms match that search.</p>
                ) : (
                  Object.entries(groupedSymptoms).map(([cat, items]) => (
                    <div key={cat} style={{ marginTop: 12 }}>
                      <h3 style={{ margin: "10px 0 6px", fontWeight: 650 }}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </h3>

                      <div style={{ display: "grid", gap: 8 }}>
                        {items.map((s) => (
                          <label key={s.id} className="checkItem">
                            <input
                              type="checkbox"
                              checked={selectedSymptoms.has(s.id)}
                              onChange={() => toggleSymptom(s.id)}
                            />
                            <span>{s.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {selectedLabels.length > 0 ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <h2 className="panelTitle" style={{ margin: 0 }}>
                    Selected
                  </h2>
                  <button
                    type="button"
                    onClick={clearAll}
                    style={{
                      border: "1px solid rgba(31, 35, 31, 0.14)",
                      borderRadius: 14,
                      padding: "8px 10px",
                      background: "white",
                      cursor: "pointer",
                      fontWeight: 650,
                    }}
                  >
                    Clear
                  </button>
                </div>

                <div className="pills">
                  {selectedLabels.map((s) => (
                    <div key={s.id} className="pill">
                      <span>{s.label}</span>
                      <button type="button" onClick={() => toggleSymptom(s.id)} title="Remove">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <hr style={{ margin: "18px 0" }} />

            <h2 className="panelTitle">2) Quick questions</h2>

            <label className="field">
              <span>Soil moisture</span>
              <select
                value={observations.soil_moisture}
                onChange={(e) => setObs("soil_moisture", e.target.value)}
              >
                <option value="">Select…</option>
                <option value="dry">Dry</option>
                <option value="moist">Moist</option>
                <option value="wet">Wet</option>
              </select>
            </label>

            <label className="field">
              <span>Light level</span>
              <select
                value={observations.light_level}
                onChange={(e) => setObs("light_level", e.target.value)}
              >
                <option value="">Select…</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <Toggle
              label="Fertilized recently?"
              value={observations.fertilized_recently}
              onChange={(v) => setObs("fertilized_recently", v)}
            />
            <Toggle
              label="Low humidity / dry indoor air?"
              value={observations.humidity_low}
              onChange={(v) => setObs("humidity_low", v)}
            />
            <Toggle
              label="Drafts / vents / temp swings nearby?"
              value={observations.drafts_temp_fluctuations}
              onChange={(v) => setObs("drafts_temp_fluctuations", v)}
            />
            <Toggle
              label="Poor drainage or water sits in saucer?"
              value={observations.poor_drainage_or_saucer_water}
              onChange={(v) => setObs("poor_drainage_or_saucer_water", v)}
            />

            <button
              className="primaryBtn"
              type="button"
              onClick={runDiagnosis}
              disabled={!canDiagnose}
              style={{ marginTop: 16, width: "100%" }}
            >
              {diagnosing ? "Diagnosing…" : "Diagnose"}
            </button>

            <p className="muted" style={{ marginTop: 10 }}>
              Tip: start with 2–4 symptoms + soil moisture for the best results.
            </p>
          </section>

          {/* RIGHT: Results */}
          <section className="panel">
            <h2 className="panelTitle">3) Results</h2>

            {!results ? (
              <p className="muted">
                Select symptoms, answer a couple questions, then click <strong>Diagnose</strong>.
              </p>
            ) : Array.isArray(results.results) && results.results.length > 0 ? (
              <>
                {results.results.map((r) => {
                  const pct = Math.round((r.confidence || 0) * 100);

                  return (
                    <div key={r.id} className="issueBox">
                      <div className="confRow">
                        <h3 style={{ margin: 0 }}>{r.name}</h3>
                        <span className="muted" style={{ whiteSpace: "nowrap" }}>
                          {pct}%
                        </span>
                      </div>

                      <div className="confBar">
                        <div className="confFill" style={{ width: `${pct}%` }} />
                      </div>

                      {/* Explain "why" using labels instead of ids */}
                      <div className="pills" style={{ marginTop: 10 }}>
                        {(r.because?.matchedRequired || []).map((id) => (
                          <div key={"req-" + id} className="pill">
                            <span>Required: {labelMap.get(id) || id}</span>
                          </div>
                        ))}
                        {(r.because?.matchedSupporting || []).map((id) => (
                          <div key={"sup-" + id} className="pill">
                            <span>Matched: {labelMap.get(id) || id}</span>
                          </div>
                        ))}
                        {(r.because?.matchedContradictions || []).map((id) => (
                          <div key={"con-" + id} className="pill">
                            <span>Contradiction: {labelMap.get(id) || id}</span>
                          </div>
                        ))}
                      </div>

                      {Array.isArray(r.treatment) && r.treatment.length > 0 ? (
                        <ul style={{ marginTop: 10 }}>
                          {r.treatment.map((t, i) => (
                            <li key={i} className="muted">
                              {t}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted" style={{ marginTop: 10 }}>
                          No treatment steps yet.
                        </p>
                      )}
                    </div>
                  );
                })}

                {results.disclaimer ? (
                  <p className="muted" style={{ marginTop: 12 }}>
                    {results.disclaimer}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="muted">No matches found. Try different symptoms.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label
      className="checkItem"
      style={{ justifyContent: "space-between", cursor: "pointer" }}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}