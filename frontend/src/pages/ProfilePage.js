import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, updatePassword } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase"; // adjust path if needed

// --- Helpers (US phone formatting + E.164) ---
function formatUSPhone(input) {
  const digits = (input || "").replace(/\D/g, "").slice(0, 10);
  const len = digits.length;

  if (len === 0) return "";
  if (len < 4) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function toE164US(input) {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return ""; // invalid or empty
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // edit state
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [gardenZone, setGardenZone] = useState("Unknown");

  // phone + SMS toggle
  const [phoneDisplay, setPhoneDisplay] = useState(""); // formatted for UI
  const [smsEnabled, setSmsEnabled] = useState(false);

  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // derived phone value 
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const phoneE164 = useMemo(() => toE164US(phoneDisplay), [phoneDisplay]);

  const loadProfile = async (uid) => {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      setProfile(data);

      setFullName(data.fullName || "");
      setZipCode(data.zipCode || "");
      setGardenZone(data.gardenZone || "Unknown");

      const storedPhone =
        data.phoneDisplay || data.phoneNumber || data.phoneE164 || "";
      setPhoneDisplay(formatUSPhone(storedPhone));

      setSmsEnabled(Boolean(data.smsEnabled));
    } else {
      setProfile(null);
      setMsg("No profile document found.");
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setMsg("");

      if (!currentUser) {
        setProfile(null);
        return;
      }

      try {
        await loadProfile(currentUser.uid);
      } catch (err) {
        setMsg(err.message);
      }
    });

    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMsg("");

    try {
      // If they enable SMS, require a valid phone number
      if (smsEnabled && !phoneE164) {
        setMsg("❌ Please enter a valid US phone number (10 digits) to enable SMS reminders.");
        setSaving(false);
        return;
      }

      const ref = doc(db, "users", user.uid);

      await updateDoc(ref, {
        fullName: fullName.trim(),
        zipCode: zipCode.trim(),
        gardenZone: gardenZone.trim(),

        phoneDisplay: phoneDisplay.trim(),
        phoneE164: phoneE164 || "",
        phoneNumber: phoneDisplay.trim(),

        smsEnabled: Boolean(smsEnabled),
      });

      await loadProfile(user.uid);

      setEditMode(false);
      setMsg("✅ Profile updated!");
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(profile?.fullName || "");
    setZipCode(profile?.zipCode || "");
    setGardenZone(profile?.gardenZone || "Unknown");

    const storedPhone =
      profile?.phoneDisplay || profile?.phoneNumber || profile?.phoneE164 || "";
    setPhoneDisplay(formatUSPhone(storedPhone));

    setSmsEnabled(Boolean(profile?.smsEnabled));

    setEditMode(false);
    setMsg("");
  };
  const handlePasswordUpdate = async () => {
    if (!user) return;

    try {
      await updatePassword(user, newPassword);
      setPasswordMsg("Password updated!");
      setNewPassword("");
    } catch (err) {
      setPasswordMsg(`${err.message}`);
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 700, margin: "40px auto" }}>
        <h2>Profile</h2>
        <p>You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ textAlign: "center", marginBottom: 24 }}>My Profile</h1>

      {msg && <p style={{ textAlign: "center", marginBottom: 12 }}>{msg}</p>}

      <div style={{ background: "white", padding: 22, borderRadius: 16 }}>
        {!editMode ? (
          <>
            <p><strong>Full Name:</strong> {profile?.fullName || "-"}</p>
            <p><strong>Email:</strong> {profile?.email || user.email}</p>
            <p><strong>Zip Code:</strong> {profile?.zipCode || "-"}</p>
            <p><strong>Garden Zone:</strong> {profile?.gardenZone || "Unknown"}</p>

            <p><strong>Phone:</strong> {profile?.phoneDisplay || profile?.phoneNumber || "-"}</p>
            <p><strong>SMS Reminders:</strong> {profile?.smsEnabled ? "Enabled" : "Off"}</p>

            <button
              style={{ marginTop: 14, padding: "10px 14px" }}
              onClick={() => setEditMode(true)}
              type="button"
            >
              Edit Profile
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10, maxWidth: 460 }}>
              <label>
                Full Name
                <input
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>

              <label>
                Zip Code
                <input
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </label>

              <label>
                Garden Zone
                <select
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                  value={gardenZone}
                  onChange={(e) => setGardenZone(e.target.value)}
                >
                  <option value="">Garden zone (optional)</option>
                  {["Unknown", "1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b", "5a", "5b", "6a", "6b", "7a", "7b",
                    "8a", "8b", "9a", "9b", "10a", "10b", "11a","11b","12a","12b","13a","13b"].map((zone) => (
                    <option key={zone} value={zone}>
                      Zone {zone}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Phone Number (US)
                <input
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                  value={phoneDisplay}
                  onChange={(e) => setPhoneDisplay(formatUSPhone(e.target.value))}
                  placeholder="(757) 555-1234"
                  inputMode="tel"
                />
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  Saved for SMS as: <strong>{phoneE164 || "Invalid / missing"}</strong>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                />
                Enable SMS reminders (watering/fertilizing)
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: "10px 14px" }}
                type="button"
              >
                {saving ? "Saving..." : "Save"}
              </button>

              <button
                onClick={handleCancel}
                disabled={saving}
                style={{ padding: "10px 14px" }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ background: "white", padding: 22, borderRadius: 16, marginTop: 24 }}>
        <h3>Update Password</h3>

        <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
          <input
            type="password"
            placeholder="New Password"
            style={{ width: "100%", padding: 10 }}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={handlePasswordUpdate} type="button">
            Update Password
          </button>
        </div>

        {passwordMsg && <p style={{ marginTop: 12 }}>{passwordMsg}</p>}
      </div>
    </div>
  );
}