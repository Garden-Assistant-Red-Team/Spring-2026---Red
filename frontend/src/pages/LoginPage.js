import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();


  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, password);

// Redirect user
navigate("/garden");

        
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button style={{ width: "100%", padding: 10 }} type="submit">
          Log In
        </button>
      </form>

      <p>Don’t have an account? <Link to="/signup">Sign up</Link></p>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
