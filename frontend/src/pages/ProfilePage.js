import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase"; // adjust path if needed

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // form state
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [gardenZone, setGardenZone] = useState("");

  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProfile = async (uid) => {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      setProfile(data);

      // sync form with stored values
      setFullName(data.fullName || "");
      setZipCode(data.zipCode || "");
      setGardenZone(data.gardenZone || "");
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
      const ref = doc(db, "users", user.uid);

      await updateDoc(ref, {
        fullName: fullName.trim(),
        zipCode: zipCode.trim(),
        gardenZone: gardenZone.trim(),
      });

      // reload so UI updates immediately
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
    // reset form back to saved values
    setFullName(profile?.fullName || "");
    setZipCode(profile?.zipCode || "");
    setGardenZone(profile?.gardenZone || "");
    setEditMode(false);
    setMsg("");
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
            <p><strong>Garden Zone:</strong> {profile?.gardenZone || "-"}</p>

            <button
              style={{ marginTop: 14, padding: "10px 14px" }}
              onClick={() => setEditMode(true)}
            >
              Edit Profile
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
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
                <input
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                  value={gardenZone}
                  onChange={(e) => setGardenZone(e.target.value)}
                  placeholder="ex: 8a"
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: "10px 14px" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>

              <button
                onClick={handleCancel}
                disabled={saving}
                style={{ padding: "10px 14px" }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}