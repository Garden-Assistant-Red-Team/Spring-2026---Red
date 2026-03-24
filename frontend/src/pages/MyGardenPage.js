import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import "./ToolLayout.css";

import PlantIdentifyUpload from "../components/PlantIdentifyUpload";

import { requestNotificationPermission } from "../firebase-messaging";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const API_BASE = "http://localhost:5000";
const WEATHER_API_KEY = process.env.REACT_APP_WEATHER_API_KEY;

async function authFetch(url, options = {}) {
  const token = await auth.currentUser.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      "Authorization": `Bearer ${token}`
    }
  });
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatMonthDay(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MyGardenPage() {
  const [savedPlants, setSavedPlants] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");

  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);

  const [recZone, setRecZone] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");

  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState("");
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newChecklistDue, setNewChecklistDue] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  const [toolsOpen, setToolsOpen] = useState(false);

  const [sidebarWeather, setSidebarWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  const selectedPlant = savedPlants.find((p) => p.id === selectedPlantId) || null;
  const selectedPlantNotes = Array.isArray(selectedPlant?.notes) ? selectedPlant.notes : [];

  const completedChecklistCount = useMemo(
    () => checklistItems.filter((item) => item.done).length,
    [checklistItems]
  );

  const pendingChecklistCount = useMemo(
    () => checklistItems.filter((item) => !item.done).length,
    [checklistItems]
  );

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayPretty = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const todayTasksCount = useMemo(() => {
    return checklistItems.filter((item) => !item.done && item.dueDate === todayIso).length;
  }, [checklistItems, todayIso]);

  const upcomingWeek = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().split("T")[0];

      const itemsForDay = checklistItems.filter((item) => item.dueDate === iso);

      return {
        iso,
        date: d,
        tasks: itemsForDay.length,
        pending: itemsForDay.filter((item) => !item.done).length,
      };
    });
  }, [checklistItems]);

  useEffect(() => {
    async function setupNotifications() {
      if (!auth.currentUser) return;

      const token = await requestNotificationPermission();
      if (!token) return;

      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        fcmToken: token,
      });
    }

    setupNotifications();
  }, []);

  async function loadSavedPlants() {
    try {
      if (!auth.currentUser) {
        setSavedPlants([]);
        setSavedError("");
        return;
      }

      setSavedLoading(true);
      setSavedError("");

      const uid = auth.currentUser.uid;
      const res = await authFetch(`${API_BASE}/api/garden/${uid}/plants`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `Failed to load saved plants (${res.status})`);
      }

      setSavedPlants(Array.isArray(data) ? data : []);
    } catch (e) {
      setSavedError(String(e.message || e));
      setSavedPlants([]);
    } finally {
      setSavedLoading(false);
    }
  }

  async function loadChecklist() {
    try {
      if (!auth.currentUser) {
        setChecklistItems([]);
        setChecklistError("");
        return;
      }

      setChecklistLoading(true);
      setChecklistError("");

      const uid = auth.currentUser.uid;
      const res = await authFetch(`${API_BASE}/api/checklist/${uid}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load checklist");

      setChecklistItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setChecklistError(String(e.message || e));
      setChecklistItems([]);
    } finally {
      setChecklistLoading(false);
    }
  }

  async function loadSidebarWeather() {
  if (!WEATHER_API_KEY) {
    setWeatherError("Missing weather key");
    return;
  }

  try {
    setWeatherLoading(true);
    setWeatherError("");

    let zipCode = "23508"; // fallback only if no user zip exists

    if (auth.currentUser) {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.zipCode && String(userData.zipCode).trim()) {
          zipCode = String(userData.zipCode).trim();
        }
      }
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?zip=${encodeURIComponent(
      `${zipCode},US`
    )}&appid=${WEATHER_API_KEY}&units=imperial`;

    const res = await authFetch(url);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.message || "Weather request failed");
    }

    setSidebarWeather(json);
  } catch (err) {
    setWeatherError(err.message || "Failed to load weather");
    setSidebarWeather(null);
  } finally {
    setWeatherLoading(false);
  }
}
  async function addChecklistItem() {
    const text = newChecklistText.trim();
    if (!text) return;

    if (!auth.currentUser) {
      alert("You must be logged in.");
      return;
    }

    const uid = auth.currentUser.uid;

    const body = {
      text,
      dueDate: newChecklistDue || null,
      done: false,
      plantInstanceId: selectedPlantId || null,
    };

    const res = await authFetch(`${API_BASE}/api/checklist/${uid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Failed to add checklist item");
      return;
    }

    setNewChecklistText("");
    await loadChecklist();
  }

  async function toggleChecklistDone(itemId, done) {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const res = await authFetch(`${API_BASE}/api/checklist/${uid}/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error || "Failed to update checklist item");
      return;
    }

    await loadChecklist();
  }

  async function deleteChecklistItem(itemId) {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const res = await authFetch(`${API_BASE}/api/checklist/${uid}/${itemId}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error || "Failed to delete checklist item");
      return;
    }

    await loadChecklist();
  }

  useEffect(() => {
    loadSavedPlants();
    loadChecklist();
    loadSidebarWeather();

    const interval = setInterval(() => {
      loadSidebarWeather();
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedPlantId && savedPlants.length > 0) {
      setSelectedPlantId(savedPlants[0].id);
    }
  }, [savedPlants, selectedPlantId]);

  useEffect(() => {
    setNoteDraft("");
    setEditingIndex(null);
  }, [selectedPlantId]);

  useEffect(() => {
    async function loadRecommendations() {
      if (!auth.currentUser) return;

      setRecLoading(true);
      setRecError("");

      try {
        const uid = auth.currentUser.uid;
        const res = await authFetch(`${API_BASE}/api/recommendations?uid=${uid}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to load recommendations");

        setRecZone(data.zone || "");
        setRecommendations(data.recommendations || []);
      } catch (e) {
        setRecError(String(e.message || e));
      } finally {
        setRecLoading(false);
      }
    }

    loadRecommendations();
  }, []);

  async function addToGarden(p) {
    try {
      if (!auth.currentUser) {
        alert("You must be logged in.");
        return;
      }

      const uid = auth.currentUser.uid;

      const body = {
        name: p.scientificName || p.commonName || p.name || p.id,
        commonName: p.commonName || null,
        scientificName: p.scientificName || null,
        plantId: p.id || p.plantId || null,
        trefle_id:
          typeof p.trefle_id === "number"
            ? p.trefle_id
            : typeof p.trefleId === "number"
              ? p.trefleId
              : null,
        minZone: typeof p.minZone === "number" ? p.minZone : null,
        maxZone: typeof p.maxZone === "number" ? p.maxZone : null,
        sunlight: p.sunlight || null,
        wateringFrequency: p.wateringFrequency || null,
        reason: p.reason || null,
        source: p.source || "recommendations",
        confidence: typeof p.confidence === "number" ? p.confidence : null,
        photoUrl: p.photoUrl || null,
      };

      const res = await authFetch(`${API_BASE}/api/garden/${uid}/plants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to add plant");
        return;
      }

      alert("Added to My Garden 🌿");
      await loadSavedPlants();
    } catch (e) {
      console.error(e);
      alert("Server error while adding plant.");
    }
  }

  async function deletePlant(plantDocId) {
    if (!auth.currentUser) {
      alert("You must be logged in.");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to remove this plant from your garden?"
    );
    if (!confirmDelete) return;

    try {
      const uid = auth.currentUser.uid;

      const res = await authFetch(`${API_BASE}/api/garden/${uid}/plants/${plantDocId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "Failed to delete plant.");
        return;
      }

      if (plantDocId === selectedPlantId) {
        setSelectedPlantId(null);
      }

      await loadSavedPlants();
    } catch (err) {
      console.error(err);
      alert("Server error while deleting plant.");
    }
  }

  async function addNote(plantDocId) {
    const text = noteDraft.trim();
    if (!text) return;

    if (!auth.currentUser) {
      alert("You must be logged in.");
      return;
    }

    const uid = auth.currentUser.uid;

    const res = await authFetch(`${API_BASE}/api/garden/${uid}/plants/${plantDocId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Failed to add note");
      return;
    }

    setNoteDraft("");
    await loadSavedPlants();
  }

  async function saveEdit(plantDocId, index) {
    const text = noteDraft.trim();
    if (!text) return;

    if (!auth.currentUser) {
      alert("You must be logged in.");
      return;
    }

    const uid = auth.currentUser.uid;

    const res = await authFetch(`${API_BASE}/api/garden/${uid}/plants/${plantDocId}/notes/${index}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Failed to edit note");
      return;
    }

    setEditingIndex(null);
    setNoteDraft("");
    await loadSavedPlants();
  }

  async function deleteNote(plantDocId, index) {
    if (!auth.currentUser) {
      alert("You must be logged in.");
      return;
    }

    const uid = auth.currentUser.uid;

    const res = await authFetch(`${API_BASE}/api/garden/${uid}/plants/${plantDocId}/notes/${index}`, {
      method: "DELETE",
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Failed to delete note");
      return;
    }

    await loadSavedPlants();
  }

  return (
    <div className="toolPage gardenShell">
      <aside className="gardenSidebar">
        <div className="sidebarBrand">
          <div className="sidebarBrandIcon">🌿</div>
          <div>
            <div className="sidebarBrandTitle">Garden Assistant</div>
            <div className="sidebarBrandSub">Plant care dashboard</div>
          </div>
        </div>

        <nav className="sidebarNav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebarLink ${isActive ? "active" : ""}`}
          >
            <span className="sidebarLinkIcon">🏠</span>
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/garden"
            className={({ isActive }) => `sidebarLink ${isActive ? "active" : ""}`}
          >
            <span className="sidebarLinkIcon">🪴</span>
            <span>My Garden</span>
          </NavLink>

          <div className="sidebarDropdown sidebarDropdownClick">
            <button
              type="button"
              className="sidebarLink sidebarStaticLink sidebarToggleBtn"
              onClick={() => setToolsOpen((prev) => !prev)}
            >
              <span className="sidebarLinkIcon">🧰</span>
              <span>Tools</span>
              <span className="sidebarCaret">{toolsOpen ? "▾" : "▸"}</span>
            </button>

            {toolsOpen && (
              <div className="sidebarDropdownMenu">
                <NavLink to="/tools/reminders" className="dropdownItem">
                  Reminders
                </NavLink>

                <NavLink to="/tools/recommendations" className="dropdownItem">
                  Plant Recommendation
                </NavLink>

                <NavLink to="/tools/symptoms" className="dropdownItem">
                  Symptom Assessment
                </NavLink>

                <NavLink to="/tools/weather" className="dropdownItem">
                  Weather
                </NavLink>
              </div>
            )}
          </div>

          <NavLink
            to="/resources"
            className={({ isActive }) => `sidebarLink ${isActive ? "active" : ""}`}
          >
            <span className="sidebarLinkIcon">📚</span>
            <span>Resources</span>
          </NavLink>

          <NavLink
            to="/profile/settings"
            className={({ isActive }) => `sidebarLink ${isActive ? "active" : ""}`}
          >
            <span className="sidebarLinkIcon">⚙️</span>
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="sidebarDivider" />

        <div className="sidebarMiniCard">
          <div className="sidebarMiniLabel">Today</div>
          <div className="sidebarMiniValue sidebarMiniValueSmall">{todayPretty}</div>
        </div>

        <div className="sidebarMiniCard">
          <div className="sidebarMiniLabel">Weather</div>

          {weatherLoading ? (
            <div className="sidebarMiniValue sidebarMiniValueSmall">Loading...</div>
          ) : weatherError ? (
            <div className="sidebarMiniValue sidebarMiniValueSmall">Unavailable</div>
          ) : sidebarWeather ? (
            <>
              <div className="sidebarMiniValue sidebarMiniValueSmall">
                {sidebarWeather.name}
              </div>
              <div className="sidebarWeatherDetails">
                <div>{Math.round(sidebarWeather.main.temp)}°F</div>
                <div>{sidebarWeather.weather?.[0]?.description}</div>
              </div>
            </>
          ) : (
            <div className="sidebarMiniValue sidebarMiniValueSmall">No weather data</div>
          )}

          <NavLink to="/tools/weather" className="sidebarMiniLink">
            View full weather
          </NavLink>
        </div>

        <div className="sidebarMiniCard">
          <div className="sidebarMiniLabel">Saved Plants</div>
          <div className="sidebarMiniValue">{savedPlants.length}</div>
        </div>

        <div className="sidebarMiniCard">
          <div className="sidebarMiniLabel">Zone</div>
          <div className="sidebarMiniValue">{recZone || "--"}</div>
        </div>

        <div className="sidebarMiniCard">
          <div className="sidebarMiniLabel">Pending Tasks</div>
          <div className="sidebarMiniValue">{pendingChecklistCount}</div>
        </div>

        <div className="sidebarFooter">
          <div className="sidebarFooterTitle">My Profile</div>
          <div className="sidebarFooterText">
            {auth.currentUser?.email || "Logged out"}
          </div>
        </div>
      </aside>

      <main className="gardenMain">
        <div className="dashboardTopbar">
          <div>
            <h1 className="toolTitle">My Garden</h1>
            <p className="dashboardSubtitle">
              Track your plants, notes, checklist items, and garden schedule in one place.
            </p>
          </div>

          <div className="topbarBadge">
            {selectedPlant ? selectedPlant.commonName || selectedPlant.name : "Plant dashboard"}
          </div>
        </div>

        <section className="panel weekStripPanel">
          <div className="sectionHeader">
            <h2 className="panelTitle">This Week</h2>
            <span className="sectionPill">{upcomingWeek.length} days</span>
          </div>

          <div className="weekStripScroller">
            {upcomingWeek.map((day) => {
              const isToday = day.iso === todayIso;
              return (
                <div
                  key={day.iso}
                  className={`weekDayCard ${isToday ? "today" : ""}`}
                >
                  <div className="weekDayTop">
                    <span className="weekDayName">{formatDayLabel(day.date)}</span>
                    <span className="weekDayDate">{formatMonthDay(day.date)}</span>
                  </div>

                  <div className="weekDayStats">
                    <div className="weekDayStat">
                      <span className="weekDayStatLabel">Tasks</span>
                      <strong>{day.tasks}</strong>
                    </div>
                    <div className="weekDayStat">
                      <span className="weekDayStatLabel">Pending</span>
                      <strong>{day.pending}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="summaryGrid">
          <div className="summaryCard">
            <span className="summaryLabel">Saved Plants</span>
            <span className="summaryValue">{savedPlants.length}</span>
          </div>

          <div className="summaryCard">
            <span className="summaryLabel">Tasks Today</span>
            <span className="summaryValue">{todayTasksCount}</span>
          </div>

          <div className="summaryCard">
            <span className="summaryLabel">Pending Tasks</span>
            <span className="summaryValue">{pendingChecklistCount}</span>
          </div>

          <div className="summaryCard">
            <span className="summaryLabel">Zone</span>
            <span className="summaryValue">{recZone || "--"}</span>
          </div>
        </section>

        <div className="dashboardMainGrid">
          <section className="panel plantsPanel">
            <div className="sectionHeader">
              <h2 className="panelTitle">My Plants</h2>
              <span className="sectionPill">{savedPlants.length}</span>
            </div>

            {!auth.currentUser && <p className="muted">Log in to load your saved plants.</p>}
            {auth.currentUser && savedLoading && <p className="muted">Loading saved plants…</p>}
            {auth.currentUser && savedError && <p className="errorText">{savedError}</p>}

            {auth.currentUser && !savedLoading && !savedError && savedPlants.length === 0 && (
              <p className="muted">No saved plants yet. Add one from recommendations below.</p>
            )}

            {auth.currentUser && !savedLoading && !savedError && savedPlants.length > 0 && (
              <div className="plantList">
                {savedPlants.map((p) => {
                  const isSelected = p.id === selectedPlantId;
                  return (
                    <button
                      key={p.id}
                      className={`plantCard ${isSelected ? "active" : ""}`}
                      type="button"
                      onClick={() => setSelectedPlantId(p.id)}
                    >
                      <div className="plantCardTop">
                        <div className="plantTextWrap">
                          <div className="plantCardName">
                            {p.commonName || p.name || "Unnamed plant"}
                          </div>
                          {p.scientificName && (
                            <div className="plantCardMeta">{p.scientificName}</div>
                          )}
                          <div className="plantCardBottom">
                            Zones {p.minZone ?? "?"}–{p.maxZone ?? "?"}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="dangerBtn compactBtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePlant(p.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="sidebarBlock">
              <div className="sectionHeader">
                <h3 className="subsectionTitle">
                  Recommended {recZone ? `for Zone ${recZone}` : ""}
                </h3>
              </div>

              {!auth.currentUser && <p className="muted">Log in to load recommendations.</p>}
              {auth.currentUser && recLoading && <p className="muted">Loading recommendations…</p>}
              {auth.currentUser && recError && <p className="errorText">{recError}</p>}
              {auth.currentUser && !recLoading && !recError && recommendations.length === 0 && (
                <p className="muted">No recommendations yet.</p>
              )}

              <div className="recommendationList">
                {recommendations.slice(0, 4).map((p) => (
                  <div key={p.id} className="recommendationCard">
                    <div className="recommendationName">
                      {p.commonName || p.scientificName || p.id}
                    </div>

                    {p.scientificName && (
                      <div className="recommendationMeta">{p.scientificName}</div>
                    )}

                    <div className="recommendationMeta">
                      Zones {p.minZone}–{p.maxZone}
                    </div>

                    <button
                      className="primaryBtn compactBtn recommendationBtn"
                      type="button"
                      onClick={() => addToGarden(p)}
                    >
                      Add to My Garden
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="centerColumn">
            <section className="panel detailsPanel">
              <div className="sectionHeader">
                <h2 className="panelTitle">Plant Details</h2>
                {selectedPlant && (
                  <span className="sectionPill">
                    {selectedPlant.commonName || selectedPlant.name || "Plant"}
                  </span>
                )}
              </div>

              {!auth.currentUser ? (
                <p className="muted">Log in to view your garden details.</p>
              ) : !selectedPlant ? (
                <div className="emptyState">
                  <div className="emptyStateIcon">🌿</div>
                  <p className="muted">Click a saved plant to view notes and details.</p>
                </div>
              ) : (
                <>
                  <div className="selectedPlantHero">
                    <div className="selectedPlantIcon">🪴</div>

                    <div className="selectedPlantInfo">
                      <h3 className="selectedPlantName">
                        {selectedPlant.commonName || selectedPlant.name || "Unnamed plant"}
                      </h3>

                      {selectedPlant.scientificName && (
                        <p className="selectedPlantScientific">
                          {selectedPlant.scientificName}
                        </p>
                      )}

                      <div className="tagRow">
                        <span className="tag">
                          Zones {selectedPlant.minZone ?? "?"}–{selectedPlant.maxZone ?? "?"}
                        </span>
                        {selectedPlant.sunlight && <span className="tag">
                          {typeof selectedPlant.sunlight === "object"
                            ? selectedPlant.sunlight.light
                            : selectedPlant.sunlight}
                        </span>}
                        {selectedPlant.wateringFrequency && (
                          <span className="tag">{selectedPlant.wateringFrequency}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="notesSection">
                    <div className="sectionHeader">
                      <h3 className="subsectionTitle">Saved Notes</h3>
                      <span className="sectionPill">{selectedPlantNotes.length}</span>
                    </div>

                    {selectedPlantNotes.length > 0 ? (
                      <div className="noteList">
                        {selectedPlantNotes.map((n, idx) => {
                          const text = typeof n === "string" ? n : n?.text || "";
                          return (
                            <div key={idx} className="noteCard">
                              <div className="noteText">{text}</div>

                              <div className="noteActions">
                                <button
                                  type="button"
                                  className="secondaryBtn compactBtn"
                                  onClick={() => {
                                    setEditingIndex(idx);
                                    setNoteDraft(text);
                                  }}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className="dangerBtn compactBtn"
                                  onClick={() => deleteNote(selectedPlant.id, idx)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="softCard">
                        <p className="muted">No notes yet for this plant.</p>
                      </div>
                    )}
                  </div>

                  <div className="editorCard">
                    <h3 className="subsectionTitle">
                      {editingIndex === null ? "Add a Note" : "Edit Note"}
                    </h3>

                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Type a note for this plant..."
                      className="dashboardTextarea"
                    />

                    <div className="actionRow">
                      {editingIndex !== null && (
                        <button
                          className="secondaryBtn"
                          type="button"
                          onClick={() => {
                            setEditingIndex(null);
                            setNoteDraft("");
                          }}
                        >
                          Cancel
                        </button>
                      )}

                      <button
                        className="primaryBtn"
                        type="button"
                        onClick={() => {
                          if (editingIndex === null) addNote(selectedPlant.id);
                          else saveEdit(selectedPlant.id, editingIndex);
                        }}
                      >
                        {editingIndex === null ? "Add Note" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </section>

          <section className="panel tasksPanel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Care Tasks</h2>
              <span className="sectionPill">{pendingChecklistCount}</span>
            </div>

            {!auth.currentUser ? (
              <p className="muted">Log in to view and edit your checklist.</p>
            ) : (
              <>
                {checklistLoading && <p className="muted">Loading checklist…</p>}
                {checklistError && <p className="errorText">{checklistError}</p>}

                <div className="taskComposer">
                  <h3 className="subsectionTitle">Add Task</h3>

                  <input
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    placeholder="Add a checklist item..."
                    className="dashboardInput"
                  />

                  <div className="taskDateRow">
                    <label className="taskDateLabel">Due date</label>
                    <input
                      type="date"
                      value={newChecklistDue}
                      onChange={(e) => setNewChecklistDue(e.target.value)}
                      className="dashboardDateInput"
                    />
                  </div>

                  <p className="muted taskPlantHint">
                    {selectedPlantId
                      ? "This task will be linked to the selected plant."
                      : "No plant selected. This task will be general."}
                  </p>

                  <button className="primaryBtn fullWidthBtn" type="button" onClick={addChecklistItem}>
                    Add Checklist Item
                  </button>
                </div>

                <div className="taskStatsRow">
                  <div className="miniStatCard">
                    <span className="miniStatLabel">Completed</span>
                    <span className="miniStatValue">{completedChecklistCount}</span>
                  </div>
                  <div className="miniStatCard">
                    <span className="miniStatLabel">Pending</span>
                    <span className="miniStatValue">{pendingChecklistCount}</span>
                  </div>
                </div>

                <div className="sectionHeader">
                  <h3 className="subsectionTitle">Upcoming Tasks</h3>
                </div>

                <div className="taskList">
                  {!checklistLoading && !checklistError && checklistItems.length === 0 && (
                    <div className="softCard">
                      <p className="muted">No checklist items yet.</p>
                    </div>
                  )}

                  {checklistItems.map((item) => (
                    <div key={item.id} className={`taskCard ${item.done ? "done" : ""}`}>
                      <div className="taskMain">
                        <input
                          type="checkbox"
                          checked={!!item.done}
                          onChange={(e) => toggleChecklistDone(item.id, e.target.checked)}
                          className="taskCheckbox"
                        />

                        <div className="taskContent">
                          <div className="taskText">{item.text}</div>
                          <div className="taskMeta">
                            {item.dueDate ? `Due: ${item.dueDate}` : "No due date"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="dangerBtn compactBtn"
                        onClick={() => deleteChecklistItem(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>

                <div className="sidebarBlock">
                  <div className="sectionHeader">
                    <h3 className="subsectionTitle">Plant Identification</h3>
                  </div>
                  <div className="softCard">
                    <PlantIdentifyUpload onAddToGarden={addToGarden} />
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}