import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { auth } from "../firebase";
import PlantCatalogList from "../components/admin/PlantCatalogList";
import PlantEditorForm from "../components/admin/PlantEditorForm";
import "./ToolLayout.css";
import {
  hasPlantChanges,
  normalizePlantDraftForSave,
  plantMatchesSearch,
  validatePlantDraft,
} from "../utils/plantAdminHelpers";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function AdminCatalogPage() {
  const [plants, setPlants] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draftPlant, setDraftPlant] = useState(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) loadPlants();
    });
    return () => unsubscribe();
  }, []);

  async function loadPlants() {
    setLoading(true);
    setError("");

    try {
      const token = await auth.currentUser?.getIdToken?.();

      const res = await fetch(`${API_BASE}/api/admin/plants`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error(`Failed to load plants (${res.status})`);

      const data = await res.json();
      const list = (Array.isArray(data) ? data : data.items || data.plants || []).sort((a, b) =>
        String(a.commonName || a.scientificName || "").localeCompare(
          String(b.commonName || b.scientificName || "")
        )
      );

      setPlants(list);

      if (list.length > 0) {
        setSelectedId(list[0].id);
        setDraftPlant(list[0]);
      }
    } catch (err) {
      setError(err.message || "Failed to load catalog plants.");
    } finally {
      setLoading(false);
    }
  }

  const filteredPlants = useMemo(
    () => plants.filter((plant) => plantMatchesSearch(plant, search)),
    [plants, search]
  );

  const selectedOriginalPlant = useMemo(
    () => plants.find((plant) => plant.id === selectedId) || null,
    [plants, selectedId]
  );

  const validationErrors = useMemo(
    () => (draftPlant ? validatePlantDraft(draftPlant) : {}),
    [draftPlant]
  );

  const unsavedChanges = useMemo(
    () => hasPlantChanges(selectedOriginalPlant, draftPlant),
    [selectedOriginalPlant, draftPlant]
  );

  function handleSelectPlant(plant) {
    setSelectedId(plant.id);
    setDraftPlant(plant);
    setSaveMessage("");
    setError("");
  }

  function handleDraftChange(field, value) {
    setDraftPlant((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaveMessage("");
  }

  function handleArrayFieldChange(field, value) {
    const parsed = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    setDraftPlant((prev) => ({
      ...prev,
      [field]: parsed,
    }));
    setSaveMessage("");
  }

  function handleBooleanChange(field, value) {
    setDraftPlant((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaveMessage("");
  }

  function handleSunlightToggle(value) {
    setDraftPlant((prev) => {
      const current = Array.isArray(prev.sunlight) ? prev.sunlight : [];
      const exists = current.includes(value);

      return {
        ...prev,
        sunlight: exists ? current.filter((item) => item !== value) : [...current, value],
      };
    });
    setSaveMessage("");
  }

  function resetDraft() {
    if (selectedOriginalPlant) {
      setDraftPlant(selectedOriginalPlant);
      setSaveMessage("");
      setError("");
    }
  }

  async function handleSave() {
    if (!draftPlant?.id) return;
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      const token = await auth.currentUser?.getIdToken?.();
      const payload = normalizePlantDraftForSave(draftPlant);

      const res = await fetch(`${API_BASE}/api/admin/plants/${draftPlant.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to save plant (${res.status})`);
      }

      const updated = await res.json();
      const savedPlant = updated.plant || updated;

      setPlants((prev) => prev.map((plant) => (plant.id === savedPlant.id ? savedPlant : plant)));
      setDraftPlant(savedPlant);
      setSaveMessage("Plant saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save plant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout
      title="Catalog Admin"
      subtitle="Review and edit plants in the main catalog."
      badge="Admin"
    >
      <div className="adminCatalogPage">
        <section className="summaryGrid">
          <div className="summaryCard">
            <span className="summaryLabel">Catalog Plants</span>
            <span className="summaryValue">{plants.length}</span>
          </div>

          <div className="summaryCard">
            <span className="summaryLabel">Filtered Results</span>
            <span className="summaryValue">{filteredPlants.length}</span>
          </div>

          <div className="summaryCard">
            <span className="summaryLabel">Selected Plant</span>
            <span className="summaryValue">{draftPlant?.commonName || "None"}</span>
          </div>
        </section>

        <div className="adminCatalogGrid">
          <PlantCatalogList
            plants={filteredPlants}
            selectedId={selectedId}
            search={search}
            onSearchChange={setSearch}
            onSelectPlant={handleSelectPlant}
            loading={loading}
            title="Catalog Plants"
          />

          <PlantEditorForm
            plant={draftPlant}
            saving={saving}
            error={error}
            saveMessage={saveMessage}
            validationErrors={validationErrors}
            hasUnsavedChanges={unsavedChanges}
            onChange={handleDraftChange}
            onArrayChange={handleArrayFieldChange}
            onBooleanChange={handleBooleanChange}
            onSunlightToggle={handleSunlightToggle}
            onSave={handleSave}
            onReset={resetDraft}
            title="Edit Catalog Plant"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}