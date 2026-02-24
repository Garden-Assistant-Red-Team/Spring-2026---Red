import React, { useMemo, useState } from "react";

export default function PlantIdentifyUpload({ onAddToGarden }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");
    setPreview(URL.createObjectURL(f));
  };

  const normalizeIdentifyResponse = (data) => {

    const best = data?.suggestions?.[0];

    if (best) {
      const scientificName = best?.name || "";
      const commonName = best?.details?.common_names?.[0] || "";
      const plantName = commonName || scientificName || "Unknown plant";

      const probability =
        typeof best?.probability === "number" ? best.probability : null;

      const confidence =
        probability === null ? null : Math.round(probability * 1000) / 10; // 1 decimal %

      return {
        plantName,
        commonName,
        scientificName,
        confidence, // number or null
        raw: data,
      };
    }

    return {
      plantName: data?.plantName || data?.name || "Unknown plant",
      commonName: "",
      scientificName: data?.scientificName || "",
      confidence: typeof data?.confidence === "number" ? data.confidence : null,
      raw: data,
    };
  };

  const displayTitle = useMemo(() => {
    if (!result) return "";
    return result.plantName || "Plant Identified";
  }, [result]);

  const handleIdentify = async () => {
    if (!file) return setError("Please choose an image first");

    try {
      setLoading(true);
      setError("");

      const form = new FormData();
      form.append("image", file);

      const res = await fetch("/api/identifyPlant", {
        method: "POST",
        body: form,
      });

      const contentType = res.headers.get("content-type") || "";
      let data;

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error("Server returned non-JSON:\n" + text.slice(0, 200));
      }

      if (!res.ok) throw new Error(data?.error || "Identify request failed");

      setResult(normalizeIdentifyResponse(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
  if (!result || !onAddToGarden) return;

  const plant = {
 
    commonName: result?.commonName || null,
    scientificName: result?.scientificName || result?.plantName || result?.name || null,

    source: "identify",
    confidence: typeof result?.confidence === "number" ? result.confidence / 100 : null,
  };

  onAddToGarden(plant);
};

  return (
    <div style={{ marginTop: 20 }}>
      <h3>Identify a Plant (Upload Photo)</h3>

      <input type="file" accept="image/*" onChange={handleFile} />

      {preview && (
        <div style={{ marginTop: 10 }}>
          <img
            src={preview}
            alt="preview"
            style={{ width: 280, borderRadius: 12 }}
          />
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <button onClick={handleIdentify} disabled={loading}>
          {loading ? "Identifying..." : "Identify Plant"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 15 }}>
          <h4>{displayTitle}</h4>

          {result.commonName && (
            <p>
              <b>Common name:</b> {result.commonName}
            </p>
          )}

          {result.scientificName && (
            <p>
              <b>Scientific:</b> {result.scientificName}
            </p>
          )}

          {typeof result.confidence === "number" && (
            <p>
              <b>Confidence:</b> {result.confidence}%
            </p>
          )}

          <button onClick={handleAdd} style={{ marginTop: 10 }}>
            Add to My Garden
          </button>
        </div>
      )}
    </div>
  );
}