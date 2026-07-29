import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const ORIENTATIONS = ["Gay", "Lesbian", "Bisexual", "Pansexual", "Asexual", "Queer", "Other"];

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [orientation, setOrientation] = useState(ORIENTATIONS[0]);
  const [genderIdentity, setGenderIdentity] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", {
        email,
        password,
        displayName,
        orientation,
        genderIdentity,
        pronouns,
      });
      login(res.data.token, res.data.userId);
      navigate("/browse");
    } catch (err: any) {
      setError(err.response?.data?.error?.formErrors?.[0] || err.response?.data?.error || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div style={{ textAlign: "center", margin: "32px 0" }}>
        <div className="brand">Jobber Match</div>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Find your people</p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label>Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>

        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="field">
          <label>Password (min 8 characters)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <div className="field">
          <label>Sexual orientation</label>
          <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
            {ORIENTATIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Gender identity</label>
          <input
            value={genderIdentity}
            onChange={(e) => setGenderIdentity(e.target.value)}
            placeholder="e.g. Man, Woman, Non-binary"
            required
          />
        </div>

        <div className="field">
          <label>Pronouns (optional)</label>
          <input value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="e.g. they/them" />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, color: "var(--text-muted)", fontSize: 14 }}>
        Already have an account? <Link to="/login" style={{ color: "var(--accent)" }}>Log in</Link>
      </p>
    </div>
  );
}
