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
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Trigger weather check and reminder adjustment in background
    fetch(`http://localhost:5000/api/weather/users/${uid}/login-check`, {
      method: "POST",
    }).catch(err => console.warn("Weather check failed:", err.message));

    // Redirect user
    navigate("/garden");

  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      setMsg("Incorrect email or password. Please try again.");
    } else if (err.code === 'auth/user-not-found') {
      setMsg("No account found with that email.");
    } else if (err.code === 'auth/invalid-email') {
      setMsg("Please enter a valid email address.");
    } else {
      setMsg("Something went wrong. Please try again.");
    }
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
