import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase"; // <-- make sure db is exported
import { Link, useNavigate } from "react-router-dom";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // NEW profile fields
  const [fullName, setFullName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [gardenZone, setGardenZone] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      // 1) Create auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 2) Create profile doc in Firestore
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        fullName,
        zipCode,
        gardenZone,
        phoneNumber,
        createdAt: serverTimestamp(),
      });

      setMsg("✅ Account created!");
      navigate("/garden");
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>Sign Up</h2>

      <form onSubmit={handleSignup}>
        {/* NEW fields */}
        <input
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
          type="text"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <input
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
          type="text"
          placeholder="Zip code"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          required
        />

        <input
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
          type="text"
          placeholder="Garden zone (optional)"
          value={gardenZone}
          onChange={(e) => setGardenZone(e.target.value)}
        />
        <input
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
          type="tel"
          placeholder="Phone number (for watering reminders)"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        {/* Existing fields */}
        <input
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
          type="password"
          placeholder="Password (6+ chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button style={{ width: "100%", padding: 10 }} type="submit">
          Create Account
        </button>
      </form>

      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}