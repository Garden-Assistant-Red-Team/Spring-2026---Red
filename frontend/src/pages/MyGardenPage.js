import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import "./ToolLayout.css";

import PlantIdentifyUpload from "../components/PlantIdentifyUpload";

import { requestNotificationPermission } from "../firebase-messaging";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

import WeatherAlertBanner from "../components/WeatherAlertBanner";

const API_BASE = "http://localhost:5000";
const WEATHER_API_KEY = process.env.REACT_APP_WEATHER_API_KEY;

async function authFetch(url, options = {}) {
  const token = await auth.currentUser.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatMonthDay(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function getReminderTypeClass(type) {
  if (type === "water") return "water";
  if (type === "fertilize") return "fertilize";
  if (type === "prune") return "prune";
  return "custom";
}

function formatSunlightValue(sunlight) {
  if (!sunlight) return "Unknown light";

  if (Array.isArray(sunlight)) {
    return sunlight
      .map((s) =>
        String(s)
          .replaceAll("_", " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      )
      .join(", ");
  }

  if (typeof sunlight === "object") {
    if (sunlight.light) return sunlight.light;
    return "Unknown light";
  }

  return String(sunlight);
}

function formatEveryDays(days, fallback = "Not set") {
  const value = Number(days);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return `Every ${value} day${value === 1 ? "" : "s"}`;
}

function formatTemperatureRange(min, max) {
  const hasMin = Number.isFinite(Number(min));
  const hasMax = Number.isFinite(Number(max));

  if (hasMin && hasMax) return `${min}°F to ${max}°F`;
  if (hasMin) return `Min ${min}°F`;
  if (hasMax) return `Max ${max}°F`;
  return "Not set";
}

function buildPlantDescription(plant, mode = "indoor") {
  if (!plant) return "";

  const commonName = plant.commonName || plant.name || "This plant";
  const scientificName = plant.scientificName || "";
  const sunlight = formatSunlightValue(plant.sunlight);
  const watering =
    plant.wateringFrequency && Number.isFinite(Number(plant.wateringFrequency))
      ? `Water about every ${plant.wateringFrequency} day${Number(plant.wateringFrequency) === 1 ? "" : "s"}.`
      : "Keep a consistent watering routine based on soil moisture.";

  const zoneText =
    plant.minZone != null && plant.maxZone != null
      ? `It is commonly suited for hardiness zones ${plant.minZone}-${plant.maxZone}.`
      : "Check local conditions before planting outdoors.";

  if (mode === "indoor") {
    return `${commonName}${scientificName ? ` (${scientificName})` : ""} can do well indoors when placed in ${sunlight.toLowerCase()} conditions. ${watering} Keep it in a stable room environment, avoid sudden temperature swings, and rotate it sometimes so growth stays balanced.`;
  }

  return `${commonName}${scientificName ? ` (${scientificName})` : ""} can be grown outdoors when the climate matches its needs. ${zoneText} It usually prefers ${sunlight.toLowerCase()} conditions outside. ${watering} Watch for weather changes, especially heat, heavy rain, and colder nights.`;
}

export default function MyGardenPage() {
  const [savedPlants, setSavedPlants] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");

  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);

  const [plantEditForm, setPlantEditForm] = useState({
    nickname: "",
    locationType: "outdoor",
    status: "active",
  });

  const [detailTab, setDetailTab] = useState("description");
  const [descriptionLocationTab, setDescriptionLocationTab] = useState("indoor");

  const [recZone, setRecZone] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");

  const [reminders, setReminders] = useState([]);
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

  const indoorPlants = useMemo(
    () => savedPlants.filter((p) => (p.locationType || "outdoor") === "indoor"),
    [savedPlants]
  );

  const outdoorPlants = useMemo(
    () => savedPlants.filter((p) => (p.locationType || "outdoor") === "outdoor"),
    [savedPlants]
  );

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

      const remindersForDay = reminders.filter((r) => {
        if (r.status !== "pending") return false;
        const date = r.dueAt?._seconds
          ? new Date(r.dueAt._seconds * 1000)
          : new Date(r.dueAt);
        return date.toISOString().split("T")[0] === iso;
      });

      return {
        iso,
        date: d,
        tasks: itemsForDay.length,
        pendingTasks: itemsForDay.filter((item) => !item.done).length,
        pendingReminders: remindersForDay.length,
        reminderItems: remindersForDay,
      };
    });
  }, [checklistItems, reminders]);

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

  async function loadReminders() {
    if (!auth.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const uid = auth.currentUser.uid;
      const res = await fetch(`${API_BASE}/api/reminders/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setReminders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load reminders:", e.message);
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

      let zipCode = "23508";

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

      const res = await fetch(url);
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

  useEffect(() => {
    loadSavedPlants();
    loadChecklist();
    loadReminders();
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
    if (selectedPlant) {
      setPlantEditForm({
        nickname: selectedPlant.nickname || "",
        locationType: selectedPlant.locationType || "outdoor",
        status: selectedPlant.status || "active",
      });
      setDescriptionLocationTab(selectedPlant.locationType || "indoor");
    }
  }, [selectedPlantId, selectedPlant]);

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

        setRecZone(data.userContext?.gardenZone || "");
        setRecommendations(data.sections?.bestSuited || []);
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

      const locationType = window.prompt(
        "Is this plant indoor or outdoor? Type: indoor or outdoor"
      );

      if (!locationType || !["indoor", "outdoor"].includes(locationType.toLowerCase())) {
        alert("Please enter 'indoor' or 'outdoor'");
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
        wateringProfile: p.wateringProfile || null,
        wateringEveryDays: p.wateringEveryDays ?? null,
        wateringFrequency: p.wateringFrequency || p.wateringEveryDays || null,
        duration: p.duration || null,
        imageUrl: p.imageUrl || null,

        difficulty: p.difficulty || null,
        fertilizeEveryDays: p.fertilizeEveryDays ?? null,
        pruneEveryDays: p.pruneEveryDays ?? null,
        repotEveryDays: p.repotEveryDays ?? null,

        potType: p.potType || null,
        soilType: p.soilType || null,
        lighting: p.lighting || null,
        humidity: p.humidity || null,
        hibernation: p.hibernation || null,
        temperatureMin: p.temperatureMin ?? null,
        temperatureMax: p.temperatureMax ?? null,

        reason: p.reason || null,
        source: p.source || "recommendations",
        confidence: typeof p.confidence === "number" ? p.confidence : null,
        photoUrl: p.photoUrl || null,
        locationType: locationType.toLowerCase(),
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

  async function savePlantEdits() {
    if (!auth.currentUser || !selectedPlant) {
      alert("Select a plant first.");
      return;
    }

    try {
      const uid = auth.currentUser.uid;

      const res = await authFetch(`${API_BASE}/api/garden/${uid}/plants/${selectedPlant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: plantEditForm.nickname,
          locationType: plantEditForm.locationType,
          status: plantEditForm.status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Failed to update plant");
        return;
      }

      await loadSavedPlants();
      alert("Plant updated");
    } catch (err) {
      console.error(err);
      alert("Server error while updating plant.");
    }
  }

  //This function creates a toggle/switch for plant relocation between indoor and outdoor, 
  // allowing users to update the plant's location type in their garden (indoor or outdoor)

  async function updatePlantLocation(plantDocId, newLocationType) {
    if (!auth.currentUser) {
      alert("You must be logged in.");
      return;
    }

    try {
      const uid = auth.currentUser.uid;
      const res = await authFetch(`${API_BASE}/api/garden/${uid}/plants/${plantDocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationType: newLocationType }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to update plant location");
        return;
      }

      await loadSavedPlants();
      if (selectedPlantId === plantDocId) {
        setPlantEditForm ((prev) => ({ ...prev, locationType: newLocationType }));
        setDescriptionLocationTab(newLocationType);
      }
    } catch (err) {
      console.error(err);
      alert("Server error while updating plant location.");
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

  function renderPlantCard(p) {
    const isSelected = p.id === selectedPlantId;
    const currentLocation  = p.locationType === "indoor" ? "indoor" : "outdoor";
    return (
      <button
        key={p.id}
        className={`plantCard mgPlantCard ${isSelected ? "active" : ""}`}
        type="button"
        onClick={() => {
          setSelectedPlantId(p.id);
          setDetailTab("description");
        }}
      >
        <div className="mgPlantCardHeader">
          <div>
            <div className="plantCardName">
              {p.nickname || p.commonName || p.name || "Unnamed plant"}
            </div>
            {p.scientificName && <div className="plantCardMeta">{p.scientificName}</div>}
          </div>

          <span className={`mgLocationBadge ${p.locationType === "indoor" ? "indoor" : "outdoor"}`}>
            {p.locationType === "indoor" ? "Indoor" : "Outdoor"}
          </span>
        </div>

        <div className="mgPlantMetaRow">
          <span className="mgMiniChip">
            Zones {p.minZone ?? "?"}-{p.maxZone ?? "?"}
          </span>

          {p.status && <span className="mgMiniChip">Status: {p.status}</span>}

          {p.wateringFrequency && (
            <span className="mgMiniChip">Water: every {p.wateringFrequency} days</span>
          )}
        </div>

        <div 
          className="mgLocationQuickToggleRow"
          onClick={(e) => {e.stopPropagation() }}
        >
          <span className="mgLocationQuickToggleLabel">Location:</span>

          <div className="mgLocationToggle">
            <button
              type="button"
              className={`mgLocationToggleBtn ${currentLocation === "indoor" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                updatePlantLocation(p.id, "indoor");
              }}
            >
              Indoor
            </button>
            <button
              type="button"
              className={`mgLocationToggleBtn ${currentLocation === "outdoor" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                updatePlantLocation(p.id, "outdoor");
              }}
            >
              Outdoor
            </button>
          </div>
        </div>

        <div className="mgPlantActions">
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
        <WeatherAlertBanner />

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
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="sectionPill">{upcomingWeek.length} days</span>
              <button className="secondaryBtn compactBtn" type="button" onClick={loadReminders}>
                Refresh
              </button>
            </div>
          </div>

          <div className="weekStripScroller">
            {upcomingWeek.map((day) => {
              const isToday = day.iso === todayIso;
              return (
                <div key={day.iso} className={`weekDayCard ${isToday ? "today" : ""}`}>
                  <div className="weekDayTop">
                    <span className="weekDayName">{formatDayLabel(day.date)}</span>
                    <span className="weekDayDate">{formatMonthDay(day.date)}</span>
                  </div>

                  <div className="weekDayStats">
                    <div className="weekDayStat">
                      <span className="weekDayStatLabel">Tasks</span>
                      <strong>{day.pendingTasks}</strong>
                    </div>
                    <div className="weekDayStat">
                      <span className="weekDayStatLabel">Reminders</span>
                      <strong>{day.pendingReminders}</strong>
                    </div>
                  </div>

                  {day.reminderItems?.length > 0 && (
                    <div className="calendarReminderList">
                      {day.reminderItems.slice(0, 4).map((reminder) => (
                        <div
                          key={reminder.id}
                          className={`calendarReminder ${getReminderTypeClass(reminder.type)}`}
                          title={reminder.title}
                        >
                          {reminder.title}
                        </div>
                      ))}

                      {day.reminderItems.length > 4 && (
                        <div className="calendarReminderMore">
                          +{day.reminderItems.length - 4} more
                        </div>
                      )}
                    </div>
                  )}
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

        <div className="mgPageGrid">
          <section className="panel mgPlantsPanel">
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
              <div className="mgPlantColumns">
                <div className="mgPlantColumn">
                  <div className="sectionHeader">
                    <h3 className="subsectionTitle">Indoor Plants</h3>
                    <span className="sectionPill">{indoorPlants.length}</span>
                  </div>

                  <div className="plantList">
                    {indoorPlants.length === 0 ? (
                      <div className="softCard">
                        <p className="muted">No indoor plants yet.</p>
                      </div>
                    ) : (
                      indoorPlants.map((p) => renderPlantCard(p))
                    )}
                  </div>
                </div>

                <div className="mgPlantColumn">
                  <div className="sectionHeader">
                    <h3 className="subsectionTitle">Outdoor Plants</h3>
                    <span className="sectionPill">{outdoorPlants.length}</span>
                  </div>

                  <div className="plantList">
                    {outdoorPlants.length === 0 ? (
                      <div className="softCard">
                        <p className="muted">No outdoor plants yet.</p>
                      </div>
                    ) : (
                      outdoorPlants.map((p) => renderPlantCard(p))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="panel mgDetailsPanel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Plant Details</h2>
              {selectedPlant && (
                <span className="sectionPill">
                  {selectedPlant.nickname ||
                    selectedPlant.commonName ||
                    selectedPlant.name ||
                    "Plant"}
                </span>
              )}
            </div>

            {!auth.currentUser ? (
              <p className="muted">Log in to view your garden details.</p>
            ) : !selectedPlant ? (
              <div className="emptyState">
                <div className="emptyStateIcon">🌿</div>
                <p className="muted">Click a plant card to view and edit details here.</p>
              </div>
            ) : (
              <>
                <div className="selectedPlantHero">
                  <div className="selectedPlantIcon">🪴</div>

                  <div className="selectedPlantInfo">
                    <h3 className="selectedPlantName">
                      {selectedPlant.nickname ||
                        selectedPlant.commonName ||
                        selectedPlant.name ||
                        "Unnamed plant"}
                    </h3>

                    {selectedPlant.scientificName && (
                      <p className="selectedPlantScientific">
                        {selectedPlant.scientificName}
                      </p>
                    )}

                    <div className="tagRow">
                      <span className="tag">
                        Zones {selectedPlant.minZone ?? "?"}-{selectedPlant.maxZone ?? "?"}
                      </span>
                      <span className="tag">
                        {selectedPlant.locationType === "indoor" ? "Indoor" : "Outdoor"}
                      </span>
                      {selectedPlant.status && <span className="tag">{selectedPlant.status}</span>}
                      {selectedPlant.sunlight && (
                        <span className="tag">{formatSunlightValue(selectedPlant.sunlight)}</span>
                      )}
                      {selectedPlant.wateringFrequency && (
                        <span className="tag">
                          Every {selectedPlant.wateringFrequency} day
                          {selectedPlant.wateringFrequency === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mgDetailTabs">
                  <button
                    type="button"
                    className={`mgDetailTabBtn ${detailTab === "description" ? "active" : ""}`}
                    onClick={() => setDetailTab("description")}
                  >
                    Description
                  </button>
                  <button
                    type="button"
                    className={`mgDetailTabBtn ${detailTab === "care" ? "active" : ""}`}
                    onClick={() => setDetailTab("care")}
                  >
                    Care
                  </button>
                  <button
                    type="button"
                    className={`mgDetailTabBtn ${detailTab === "history" ? "active" : ""}`}
                    onClick={() => setDetailTab("history")}
                  >
                    History
                  </button>
                  <button
                    type="button"
                    className={`mgDetailTabBtn ${detailTab === "edit" ? "active" : ""}`}
                    onClick={() => setDetailTab("edit")}
                  >
                    Edit
                  </button>
                </div>

                {detailTab === "description" && (
  <div className="mgDetailPanel">
    <div className="mgLocationToggle">
      <button
        type="button"
        className={`mgLocationToggleBtn ${
          descriptionLocationTab === "indoor" ? "active" : ""
        }`}
        onClick={() => setDescriptionLocationTab("indoor")}
      >
        Indoor
      </button>
      <button
        type="button"
        className={`mgLocationToggleBtn ${
          descriptionLocationTab === "outdoor" ? "active" : ""
        }`}
        onClick={() => setDescriptionLocationTab("outdoor")}
      >
        Outdoor
      </button>
    </div>

    <div className="mgDescriptionCard">
      <h3 className="subsectionTitle">
        {descriptionLocationTab === "indoor"
          ? "Indoor Description"
          : "Outdoor Description"}
      </h3>
      <p className="mgDescriptionText">
        {buildPlantDescription(selectedPlant, descriptionLocationTab)}
      </p>

      {descriptionLocationTab === "indoor" ? (
        <div className="mgCareGrid" style={{ marginTop: 16 }}>
          <div className="mgCareCard">
            <span className="mgCareLabel">Difficulty</span>
            <strong>{selectedPlant.difficulty || "Not set"}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Water</span>
            <strong>
              {formatEveryDays(
                selectedPlant.wateringEveryDays ?? selectedPlant.wateringFrequency
              )}
            </strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Fertilize</span>
            <strong>{formatEveryDays(selectedPlant.fertilizeEveryDays)}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Prune</span>
            <strong>{formatEveryDays(selectedPlant.pruneEveryDays)}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Repot</span>
            <strong>{formatEveryDays(selectedPlant.repotEveryDays)}</strong>
          </div>
        </div>
      ) : (
        <div className="mgCareGrid" style={{ marginTop: 16 }}>
          <div className="mgCareCard">
            <span className="mgCareLabel">Difficulty</span>
            <strong>{selectedPlant.difficulty || "Not set"}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Water</span>
            <strong>
              {formatEveryDays(
                selectedPlant.wateringEveryDays ?? selectedPlant.wateringFrequency
              )}
            </strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Fertilize</span>
            <strong>{formatEveryDays(selectedPlant.fertilizeEveryDays)}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Prune</span>
            <strong>{formatEveryDays(selectedPlant.pruneEveryDays)}</strong>
          </div>
        </div>
      )}
    </div>

    <div className="mgDescriptionCard" style={{ marginTop: 16 }}>
      <h3 className="subsectionTitle">Plant Requirements</h3>

      {descriptionLocationTab === "indoor" ? (
        <div className="mgCareGrid">
          <div className="mgCareCard">
            <span className="mgCareLabel">Pot Type</span>
            <strong>{selectedPlant.potType || "Not set"}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Soil Type</span>
            <strong>{selectedPlant.soilType || "Not set"}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Lighting</span>
            <strong>
              {selectedPlant.lighting || formatSunlightValue(selectedPlant.sunlight)}
            </strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Humidity</span>
            <strong>{selectedPlant.humidity || "Not set"}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Hibernation</span>
            <strong>{selectedPlant.hibernation || "Not set"}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Hardiness Zone</span>
            <strong>
              {selectedPlant.minZone != null && selectedPlant.maxZone != null
                ? `${selectedPlant.minZone}-${selectedPlant.maxZone}`
                : "Unknown"}
            </strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Temperature</span>
            <strong>
              {formatTemperatureRange(
                selectedPlant.temperatureMin,
                selectedPlant.temperatureMax
              )}
            </strong>
          </div>
        </div>
      ) : (
        <div className="mgCareGrid">
          <div className="mgCareCard">
            <span className="mgCareLabel">Mulching</span>
            <strong>Apply 2 inches (5 cm) organic mulch</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Soil Type</span>
            <strong>{selectedPlant.soilType || "Not set"}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Lighting</span>
            <strong>
              {selectedPlant.lighting || formatSunlightValue(selectedPlant.sunlight)}
            </strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Humidity</span>
            <strong>{selectedPlant.humidity || "Not set"}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Hibernation</span>
            <strong>{selectedPlant.hibernation || "Not set"}</strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Hardiness Zone</span>
            <strong>
              {selectedPlant.minZone != null && selectedPlant.maxZone != null
                ? `${selectedPlant.minZone}-${selectedPlant.maxZone}`
                : "Unknown"}
            </strong>
          </div>

          <div className="mgCareCard">
            <span className="mgCareLabel">Temperature</span>
            <strong>
              {formatTemperatureRange(
                selectedPlant.temperatureMin,
                selectedPlant.temperatureMax
              )}
            </strong>
          </div>
        </div>
      )}
    </div>
  </div>
)}

                {detailTab === "history" && (
                  <div className="mgDetailPanel">
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
                  </div>
                )}

                {detailTab === "edit" && (
                  <div className="mgDetailPanel">
                    <div className="editorCard">
                      <h3 className="subsectionTitle">Edit Plant</h3>

                      <div className="mgEditGrid">
                        <div className="mgEditField">
                          <label>Nickname</label>
                          <input
                            type="text"
                            value={plantEditForm.nickname}
                            onChange={(e) =>
                              setPlantEditForm((prev) => ({
                                ...prev,
                                nickname: e.target.value,
                              }))
                            }
                            className="dashboardInput"
                            placeholder="Nickname"
                          />
                        </div>

                        <div className="mgEditField">
                          <label>Location</label>
                          <select
                            value={plantEditForm.locationType}
                            onChange={(e) =>
                              setPlantEditForm((prev) => ({
                                ...prev,
                                locationType: e.target.value,
                              }))
                            }
                            className="dashboardInput"
                          >
                            <option value="indoor">Indoor</option>
                            <option value="outdoor">Outdoor</option>
                          </select>
                        </div>

                        <div className="mgEditField">
                          <label>Status</label>
                          <select
                            value={plantEditForm.status}
                            onChange={(e) =>
                              setPlantEditForm((prev) => ({
                                ...prev,
                                status: e.target.value,
                              }))
                            }
                            className="dashboardInput"
                          >
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                          </select>
                        </div>
                      </div>

                      <div className="actionRow">
                        <button className="primaryBtn" type="button" onClick={savePlantEdits}>
                          Save Plant Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

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

<section className="panel recommendationsPanel">
  <div className="sectionHeader">
    <h2 className="panelTitle">Recommended for Zone {recZone || "--"}</h2>
  </div>

  {recLoading && <p className="muted">Loading recommendations…</p>}
  {recError && <p className="errorText">{recError}</p>}

  {!recLoading && !recError && recommendations.length === 0 && (
    <p className="muted">No recommendations available.</p>
  )}

  <div className="plantList">
    {recommendations.map((p) => (
      <div key={p.id} className="plantCard">
        <div className="plantCardName">
          {p.commonName || p.name || "Unknown plant"}
        </div>

        {p.scientificName && (
          <div className="plantCardMeta">{p.scientificName}</div>
        )}

        <div className="plantCardMeta">
          Zones {p.minZone ?? "?"}-{p.maxZone ?? "?"}
        </div>

        <button
          className="primaryBtn compactBtn"
          onClick={() => addToGarden(p)}
        >
          Add to My Garden
        </button>
      </div>
    ))}
  </div>
</section>

</main>
    </div>
  );
}