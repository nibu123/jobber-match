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

  // ---- Email verification (OTP) state ----
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifyToken, setEmailVerifyToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  function startResendCooldown() {
    setResendCooldown(30);
    const timer = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleSendOtp() {
    setOtpError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOtpError("Enter a valid email address");
      return;
    }
    setOtpLoading(true);
    try {
      await api.post("/auth/send-otp", { email });
      setOtpSent(true);
      startResendCooldown();
    } catch (err: any) {
      setOtpError(err.response?.data?.error || "Could not send code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpError("");
    if (otpCode.length !== 6) {
      setOtpError("Enter the 6-digit code");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", { email, code: otpCode });
      setEmailVerifyToken(res.data.emailVerifyToken);
      setEmailVerified(true);
    } catch (err: any) {
      setOtpError(err.response?.data?.error || "Verification failed");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!emailVerified) {
      setError("Please verify your email first");
      return;
    }

    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 18) {
      setError("You must be 18 or older to sign up");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/signup", {
        email,
        emailVerifyToken,
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

      <div className="card" style={{ marginBottom: emailVerified ? 16 : 0 }}>
        <div className="field">
          <label>Email</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={emailVerified}
              required
              style={{ flex: 1 }}
            />
            {!emailVerified && (
              <button
                type="button"
                className="btn"
                onClick={handleSendOtp}
                disabled={otpLoading || resendCooldown > 0}
              >
                {otpSent
                  ? resendCooldown > 0
                    ? `Resend (${resendCooldown}s)`
                    : "Resend code"
                  : otpLoading
                  ? "Sending..."
                  : "Send code"}
              </button>
            )}
            {emailVerified && <span style={{ color: "var(--gold, #eab564)", alignSelf: "center" }}>✓ Verified</span>}
          </div>
        </div>

        {otpSent && !emailVerified && (
          <div className="field">
            <label>Enter 6-digit code</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                style={{ flex: 1, letterSpacing: "4px" }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleVerifyOtp}
                disabled={otpLoading || otpCode.length !== 6}
              >
                {otpLoading ? "Verifying..." : "Verify"}
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
              Sent to {email}. Code expires in 10 minutes.
            </p>
          </div>
        )}

        {otpError && <p className="error-text">{otpError}</p>}
      </div>

      {emailVerified && (
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
      )}

      <p style={{ textAlign: "center", marginTop: 16, color: "var(--text-muted)", fontSize: 14 }}>
        Already have an account? <Link to="/login" style={{ color: "var(--gold)" }}>Log in</Link>
      </p>
    </div>
  );
}