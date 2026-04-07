import React from "react";

export default function PlantCatalogList({
  plants,
  selectedId,
  search,
  onSearchChange,
  onSelectPlant,
  loading,
  title = "Plants",
}) {
  return (
    <section className="panel plantsPanel adminListPanel">
      <div className="sectionHeader">
        <h2 className="panelTitle">{title}</h2>
        <span className="sectionPill">{plants.length}</span>
      </div>

      <div className="dictionaryField" style={{ marginBottom: "14px" }}>
        <span>Search</span>
        <input
          type="text"
          placeholder="Search common name, scientific name, key, slug..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="muted">Loading plants...</p>
      ) : plants.length === 0 ? (
        <div className="emptyState">
          <div>
            <div className="emptyStateIcon">🌱</div>
            <p className="muted">No plants found.</p>
          </div>
        </div>
      ) : (
        <div className="plantList">
          {plants.map((plant) => (
            <button
              key={plant.id}
              type="button"
              className={`plantCard ${selectedId === plant.id ? "active" : ""}`}
              onClick={() => onSelectPlant(plant)}
            >
              <div className="plantCardTop">
                {plant.imageUrl ? (
                  <img
                    src={plant.imageUrl}
                    alt={plant.commonName || plant.scientificName || "Plant"}
                    style={{
                      width: "56px",
                      height: "56px",
                      objectFit: "cover",
                      borderRadius: "10px",
                      border: "1px solid #ddd",
                      flexShrink: 0,
                      marginRight: "10px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "10px",
                      border: "1px solid #ddd",
                      background: "#f5f5f5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      color: "#777",
                      flexShrink: 0,
                      marginRight: "10px",
                    }}
                  >
                    No img
                  </div>
                )}

                <div className="plantTextWrap">
                  <div className="plantCardName">{plant.commonName || "Unnamed plant"}</div>
                  <div className="plantCardMeta">
                    <em>{plant.scientificName || "No scientific name"}</em>
                  </div>
                </div>
              </div>

              <div className="tagRow" style={{ marginTop: "8px" }}>
                {plant.flower ? <span className="tag">flower</span> : null}
                {plant.edible ? <span className="tag">edible</span> : null}
                {plant.pollinatorFriendly ? <span className="tag">pollinator</span> : null}
              </div>

              <div className="plantCardBottom">
                Zone {plant.minZone ?? "?"} - {plant.maxZone ?? "?"}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}