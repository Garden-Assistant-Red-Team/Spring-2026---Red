import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { Link, useNavigate } from "react-router-dom";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      const res = await fetch("http://localhost:5000/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          zipCode,
          phoneNumber,
          gardenZone: "Unknown"
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Registration failed");

      // auto login after signup
      await signInWithEmailAndPassword(auth, email, password);

      setMsg("Account created!");

      // ✅ NEW redirect
      navigate("/dashboard");

    } catch (err) {
      if (err.message.includes("email-already-exists")) {
        setMsg("That email is already in use.");
      } else if (err.message.includes("weak-password")) {
        setMsg("Password must be at least 6 characters.");
      } else {
        setMsg(err.message);
      }
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>Sign Up</h2>

      <form onSubmit={handleSignup}>
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
          placeholder="ZIP code"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          required
        />

        <input
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
          type="tel"
          placeholder="Phone number (optional)"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />

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