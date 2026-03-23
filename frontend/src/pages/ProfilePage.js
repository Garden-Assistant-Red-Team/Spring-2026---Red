import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, updatePassword } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import DashboardLayout from "../components/DashboardLayout";
import "./ToolLayout.css";

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
  return "";
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [gardenZone, setGardenZone] = useState("Unknown");

  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(false);

  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

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
      <DashboardLayout
        title="My Profile"
        subtitle="Manage your account details and notification settings."
        badge="Profile"
      >
        <div className="container">
          <section className="panel">
            <p>You must be logged in to view this page.</p>
          </section>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My Profile"
      subtitle="View and update your profile information, garden zone, and SMS settings."
      badge={profile?.fullName || user.email}
    >
      <div className="container">
        {msg && (
          <section className="panel" style={{ marginBottom: 20 }}>
            <p style={{ margin: 0 }}>{msg}</p>
          </section>
        )}

        <div className="profileGrid">
          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Profile Details</h2>
            </div>

            {!editMode ? (
              <div className="profileDetailsStack">
                <p><strong>Full Name:</strong> {profile?.fullName || "-"}</p>
                <p><strong>Email:</strong> {profile?.email || user.email}</p>
                <p><strong>Zip Code:</strong> {profile?.zipCode || "-"}</p>
                <p><strong>Garden Zone:</strong> {profile?.gardenZone || "Unknown"}</p>
                <p><strong>Phone:</strong> {profile?.phoneDisplay || profile?.phoneNumber || "-"}</p>
                <p><strong>SMS Reminders:</strong> {profile?.smsEnabled ? "Enabled" : "Off"}</p>

                <button
                  className="primaryBtn"
                  style={{ marginTop: 14 }}
                  onClick={() => setEditMode(true)}
                  type="button"
                >
                  Edit Profile
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
                  <label className="field">
                    <span>Full Name</span>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>Zip Code</span>
                    <input
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>Garden Zone</span>
                    <select
                      value={gardenZone}
                      onChange={(e) => setGardenZone(e.target.value)}
                    >
                      <option value="">Garden zone (optional)</option>
                      {[
                        "Unknown", "1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b",
                        "5a", "5b", "6a", "6b", "7a", "7b", "8a", "8b", "9a", "9b",
                        "10a", "10b", "11a", "11b", "12a", "12b", "13a", "13b"
                      ].map((zone) => (
                        <option key={zone} value={zone}>
                          Zone {zone}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Phone Number (US)</span>
                    <input
                      value={phoneDisplay}
                      onChange={(e) => setPhoneDisplay(formatUSPhone(e.target.value))}
                      placeholder="(757) 555-1234"
                      inputMode="tel"
                    />
                  </label>

                  <div className="muted">
                    Saved for SMS as: <strong>{phoneE164 || "Invalid / missing"}</strong>
                  </div>

                  <label className="checkItem" style={{ justifyContent: "space-between" }}>
                    <span>Enable SMS reminders</span>
                    <input
                      type="checkbox"
                      checked={smsEnabled}
                      onChange={(e) => setSmsEnabled(e.target.checked)}
                    />
                  </label>
                </div>

                <div className="actionRow">
                  <button
                    className="primaryBtn"
                    onClick={handleSave}
                    disabled={saving}
                    type="button"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>

                  <button
                    className="secondaryBtn"
                    onClick={handleCancel}
                    disabled={saving}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="panel">
            <div className="sectionHeader">
              <h2 className="panelTitle">Update Password</h2>
            </div>

            <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
              <label className="field">
                <span>New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter a new password"
                />
              </label>

              <button className="primaryBtn" onClick={handlePasswordUpdate} type="button">
                Update Password
              </button>
            </div>

            {passwordMsg && <p style={{ marginTop: 12 }}>{passwordMsg}</p>}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}