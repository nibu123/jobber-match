import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const ORIENTATIONS = [
  "Gay", "Lesbian", "Bisexual", "Pansexual", "Asexual", "Demisexual",
  "Queer", "Heterosexual/Straight", "Questioning", "Polysexual",
  "Omnisexual", "Graysexual", "Prefer not to say", "Other",
];
const GENDER_IDENTITIES = [
  "Man", "Woman", "Transgender Man", "Transgender Woman", "Non-binary",
  "Genderqueer", "Genderfluid", "Agender", "Bigender", "Pangender",
  "Demiboy", "Demigirl", "Androgynous", "Two-Spirit", "Intersex",
  "Neutrois", "Trans Masculine", "Trans Feminine", "Gender Nonconforming",
  "Cisgender Man", "Cisgender Woman", "Questioning", "Third Gender",
  "Prefer not to say", "Other",
];
const DATING_INTENTIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "long_term", label: "Long-term relationship" },
  { value: "casual", label: "Something casual" },
  { value: "friendship", label: "Friendship" },
  { value: "figuring_out", label: "Still figuring it out" },
];

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [orientation, setOrientation] = useState(ORIENTATIONS[0]);
  const [customOrientation, setCustomOrientation] = useState("");
  const [genderIdentity, setGenderIdentity] = useState(GENDER_IDENTITIES[0]);
  const [customGenderIdentity, setCustomGenderIdentity] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [datingIntentions, setDatingIntentions] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 18) {
      setError("You must be 18 or older to sign up");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/signup", {
        email,
        password,
        displayName,
        age: ageNum,
        orientation: orientation === "Other" ? customOrientation : orientation,
        genderIdentity: genderIdentity === "Other" ? customGenderIdentity : genderIdentity,
        pronouns,
        datingIntentions: datingIntentions || undefined,
      });
      login(res.data.token, res.data.userId);
      navigate("/onboarding");
    } catch (err: any) {
      setError(err.response?.data?.error?.formErrors?.[0] || err.response?.data?.error || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div style={{ textAlign: "center", margin: "32px 0" }}>
        <div className="brand">Buddies Pride</div>
        <p className="tagline">Find your people</p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label>Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>

        <div className="field">
          <label>Age</label>
          <input
            type="number"
            min={18}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Must be 18 or older"
            required
          />
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
          {orientation === "Other" && (
            <input
              value={customOrientation}
              onChange={(e) => setCustomOrientation(e.target.value)}
              placeholder="Type your orientation"
              required
              style={{ marginTop: "6px" }}
            />
          )}
        </div>

        <div className="field">
          <label>Gender identity</label>
          <select value={genderIdentity} onChange={(e) => setGenderIdentity(e.target.value)}>
            {GENDER_IDENTITIES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          {genderIdentity === "Other" && (
            <input
              value={customGenderIdentity}
              onChange={(e) => setCustomGenderIdentity(e.target.value)}
              placeholder="Type your gender identity"
              required
              style={{ marginTop: "6px" }}
            />
          )}
        </div>

        <div className="field">
          <label>Pronouns (optional)</label>
          <input value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="e.g. they/them" />
        </div>

        <div className="field">
          <label>Dating intentions</label>
          <select value={datingIntentions} onChange={(e) => setDatingIntentions(e.target.value)}>
            {DATING_INTENTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, color: "var(--text-muted)", fontSize: 14 }}>
        Already have an account? <Link to="/login" style={{ color: "var(--gold)" }}>Log in</Link>
      </p>
    </div>
  );
}

