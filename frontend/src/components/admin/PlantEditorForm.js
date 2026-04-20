import React from "react";
import { ALLOWED_SUNLIGHT } from "../../utils/plantAdminHelpers";

const BOOLEAN_FIELDS = [
  { key: "flower", label: "Flower" },
  { key: "shrub", label: "Shrub" },
  { key: "tree", label: "Tree" },
  { key: "herb", label: "Herb" },
  { key: "edible", label: "Edible" },
  { key: "pollinatorFriendly", label: "Pollinator Friendly" },
];

export default function PlantEditorForm({
  plant,
  saving,
  error,
  saveMessage,
  validationErrors = {},
  hasUnsavedChanges = false,
  onChange,
  onArrayChange,
  onBooleanChange,
  onSunlightToggle,
  onSave,
  onReset,
  actionButtons = null,
  title = "Edit Plant",
}) {
  if (!plant) {
    return (
      <section className="panel detailsPanel">
        <div className="emptyState">
          <div>
            <div className="emptyStateIcon">🪴</div>
            <p className="muted">Select a plant to edit.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel detailsPanel adminEditorPanel">
      <div className="sectionHeader">
        <h2 className="panelTitle">{title}</h2>
        {hasUnsavedChanges ? (
          <span className="sectionPill" style={{ background: "#fff4d6", color: "#7a5a00" }}>
            Unsaved Changes
          </span>
        ) : (
          <span className="sectionPill">Saved</span>
        )}
      </div>

      <div className="selectedPlantHero" style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
        {plant.imageUrl ? (
          <img
            src={plant.imageUrl}
            alt={plant.commonName || plant.scientificName || "Plant"}
            style={{
              width: "140px",
              height: "140px",
              objectFit: "cover",
              borderRadius: "16px",
              border: "1px solid #ddd",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: "140px",
              height: "140px",
              borderRadius: "16px",
              border: "1px solid #ddd",
              background: "#f5f5f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              color: "#777",
              flexShrink: 0,
            }}
          >
            🌿
          </div>
        )}

        <div>
          <h3 style={{ margin: 0 }}>
            {plant.commonName || "Unnamed plant"}
          </h3>

          <p style={{ margin: "4px 0 10px", color: "#666" }}>
            {plant.scientificName || "No scientific name"}
          </p>

          <div className="tagRow">
            {plant.slug ? <span className="tag">slug: {plant.slug}</span> : null}
            {plant.canonicalKey ? <span className="tag">key: {plant.canonicalKey}</span> : null}
            {plant.trefleId ? <span className="tag">Trefle #{plant.trefleId}</span> : null}
          </div>
        </div>
      </div>

      <div className="adminEditorGrid">
        <div className="dictionaryField">
          <span>Common Name</span>
          <input
            value={plant.commonName || ""}
            onChange={(e) => onChange("commonName", e.target.value)}
          />
        </div>

        <div className="dictionaryField">
          <span>Scientific Name</span>
          <input
            value={plant.scientificName || ""}
            onChange={(e) => onChange("scientificName", e.target.value)}
          />
        </div>

        <div className="dictionaryField">
          <span>Canonical Key</span>
          <input
            value={plant.canonicalKey || ""}
            onChange={(e) => onChange("canonicalKey", e.target.value)}
          />
        </div>

        <div className="dictionaryField">
          <span>Slug</span>
          <input value={plant.slug || ""} onChange={(e) => onChange("slug", e.target.value)} />
        </div>

        <div className="dictionaryField">
          <span>Min Zone</span>
          <input
            type="number"
            value={plant.minZone ?? ""}
            onChange={(e) => onChange("minZone", e.target.value)}
          />
        </div>

        <div className="dictionaryField">
          <span>Max Zone</span>
          <input
            type="number"
            value={plant.maxZone ?? ""}
            onChange={(e) => onChange("maxZone", e.target.value)}
          />
        </div>

        <div className="dictionaryField">
          <span>Watering Every Days</span>
          <input
            type="number"
            value={plant.wateringEveryDays ?? ""}
            onChange={(e) => onChange("wateringEveryDays", e.target.value)}
          />
          {validationErrors.wateringEveryDays ? (
            <small className="errorText">{validationErrors.wateringEveryDays}</small>
          ) : null}
        </div>

        <div className="dictionaryField">
          <span>Watering Profile</span>
          <input
            value={plant.wateringProfile || ""}
            onChange={(e) => onChange("wateringProfile", e.target.value)}
          />
        </div>

        <div className="dictionaryField adminFullWidth">
          <span>Sunlight</span>
          <div className="adminBooleanGrid">
            {ALLOWED_SUNLIGHT.map((value) => (
              <label key={value} className="adminCheckboxCard">
                <input
                  type="checkbox"
                  checked={(Array.isArray(plant.sunlight) ? plant.sunlight : []).includes(value)}
                  onChange={() => onSunlightToggle(value)}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
          {validationErrors.sunlight ? <small className="errorText">{validationErrors.sunlight}</small> : null}
        </div>

        <div className="dictionaryField adminFullWidth">
          <span>Native States (comma separated)</span>
          <input
          value={plant.nativeStatesText || ""}
          onChange={(e) => onChange("nativeStatesText", e.target.value)}
          placeholder="VA, NC, SC"
          />
        </div>

        <div className="dictionaryField adminFullWidth">
          <span>Sources (comma separated)</span>
          <input
            value={plant.sourcesText || ""}
            onChange={(e) => onChange("sourcesText", e.target.value)}
            placeholder="trefle, usda, manual_review"
          />
        </div>

        <div className="dictionaryField adminFullWidth">
          <span>Image URL</span>
          <input
            value={plant.imageUrl || ""}
            onChange={(e) => onChange("imageUrl", e.target.value)}
          />
        </div>

        <div className="dictionaryField">
          <span>Trefle ID</span>
          <input
            type="number"
            value={plant.trefleId ?? ""}
            onChange={(e) => onChange("trefleId", e.target.value)}
          />
        </div>
      </div>

      <div className="adminBooleanGrid" style={{ marginTop: "18px" }}>
        {BOOLEAN_FIELDS.map((field) => (
          <label key={field.key} className="adminCheckboxCard">
            <input
              type="checkbox"
              checked={!!plant[field.key]}
              onChange={(e) => onBooleanChange(field.key, e.target.checked)}
            />
            <span>{field.label}</span>
          </label>
        ))}
      </div>

      {validationErrors.identity ? <p className="errorText">{validationErrors.identity}</p> : null}
      {validationErrors.zone ? <p className="errorText">{validationErrors.zone}</p> : null}
      {error ? <p className="errorText">{error}</p> : null}
      {saveMessage ? <p className="muted">{saveMessage}</p> : null}

      <div className="actionRow">
        <button type="button" className="secondaryBtn" onClick={onReset} disabled={saving}>
          Reset
        </button>
        <button
          type="button"
          className="primaryBtn"
          onClick={onSave}
          disabled={saving || Object.keys(validationErrors).length > 0 || !hasUnsavedChanges}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {actionButtons ? <div className="actionRow">{actionButtons}</div> : null}
    </section>
  );
}