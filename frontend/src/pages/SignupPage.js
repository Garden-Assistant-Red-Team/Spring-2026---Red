import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { Link } from "react-router-dom";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setMsg("✅ Account created!");
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>Sign Up</h2>
      <form onSubmit={handleSignup}>
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
      <p>Already have an account? <Link to="/login">Log in</Link></p>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
