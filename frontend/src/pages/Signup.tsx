import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import PumpingHeart from "../components/PumpingHeart";

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

  // ---- Multi-step form state (after email verified) ----
  // step 1 = basic info, step 2 = preferences
  const [formStep, setFormStep] = useState(1);
  const [stepError, setStepError] = useState("");

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

  function handleNextStep() {
    setStepError("");

    if (!displayName.trim()) {
      setStepError("Display name is required");
      return;
    }

    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 18) {
      setStepError("You must be 18 or older to sign up");
      return;
    }

    if (!password || password.length < 8) {
      setStepError("Password must be at least 8 characters");
      return;
    }

    setFormStep(2);
  }

  function handleBackStep() {
    setStepError("");
    setFormStep(1);
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
    <div className="login-page">
      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        <div className="login-brand-wrap">
          <PumpingHeart />
          <div className="brand">Buddies Pride</div>
          <p className="login-tagline">Find your people</p>
        </div>

        {!emailVerified && (
          <div className="login-glass-card">
            <div className="login-field">
              <label>Email</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="login-btn"
                  style={{ width: "auto", padding: "0 16px", whiteSpace: "nowrap" }}
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
              </div>
            </div>

            {otpSent && (
              <div className="login-field">
                <label>Enter 6-digit code</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="login-input"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    style={{ flex: 1, letterSpacing: "4px" }}
                  />
                  <button
                    type="button"
                    className="login-btn"
                    style={{ width: "auto", padding: "0 16px", whiteSpace: "nowrap" }}
                    onClick={handleVerifyOtp}
                    disabled={otpLoading || otpCode.length !== 6}
                  >
                    {otpLoading ? "Verifying..." : "Verify"}
                  </button>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
                  Sent to {email}. Code expires in 10 minutes.
                </p>
              </div>
            )}

            {otpError && <p className="login-error-text">{otpError}</p>}
          </div>
        )}

        {emailVerified && (
          <>
            {/* Step progress indicator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "0 0 16px" }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: formStep >= 1 ? "#ffd76a" : "rgba(255,255,255,0.3)",
                }}
              />
              <div style={{ width: 32, height: 2, background: formStep >= 2 ? "#ffd76a" : "rgba(255,255,255,0.3)" }} />
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: formStep >= 2 ? "#ffd76a" : "rgba(255,255,255,0.3)",
                }}
              />
            </div>

            {formStep === 1 && (
              <div className="login-glass-card">
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 0, marginBottom: 16, textAlign: "center" }}>
                  Step 1 of 2 — Basic info
                </p>

                <div className="login-field">
                  <label>Display name</label>
                  <input
                    className="login-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>

                <div className="login-field">
                  <label>Age</label>
                  <input
                    type="number"
                    className="login-input"
                    min={18}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Must be 18 or older"
                    required
                  />
                </div>

                <div className="login-field">
                  <label>Password (min 8 characters)</label>
                  <input
                    type="password"
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>

                {stepError && <p className="login-error-text">{stepError}</p>}

                <button type="button" className="login-btn" onClick={handleNextStep}>
                  Next
                </button>
              </div>
            )}

            {formStep === 2 && (
              <form onSubmit={handleSubmit} className="login-glass-card">
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 0, marginBottom: 16, textAlign: "center" }}>
                  Step 2 of 2 — Preferences
                </p>

                <div className="login-field">
                  <label>Sexual orientation</label>
                  <select className="login-input" value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                    {ORIENTATIONS.map((o) => (
                      <option key={o} value={o} style={{ color: "#000" }}>
                        {o}
                      </option>
                    ))}
                  </select>
                  {orientation === "Other" && (
                    <input
                      className="login-input"
                      value={customOrientation}
                      onChange={(e) => setCustomOrientation(e.target.value)}
                      placeholder="Type your orientation"
                      required
                      style={{ marginTop: "6px" }}
                    />
                  )}
                </div>

                <div className="login-field">
                  <label>Gender identity</label>
                  <select className="login-input" value={genderIdentity} onChange={(e) => setGenderIdentity(e.target.value)}>
                    {GENDER_IDENTITIES.map((g) => (
                      <option key={g} value={g} style={{ color: "#000" }}>
                        {g}
                      </option>
                    ))}
                  </select>
                  {genderIdentity === "Other" && (
                    <input
                      className="login-input"
                      value={customGenderIdentity}
                      onChange={(e) => setCustomGenderIdentity(e.target.value)}
                      placeholder="Type your gender identity"
                      required
                      style={{ marginTop: "6px" }}
                    />
                  )}
                </div>

                <div className="login-field">
                  <label>Pronouns (optional)</label>
                  <input
                    className="login-input"
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    placeholder="e.g. they/them"
                  />
                </div>

                <div className="login-field">
                  <label>Dating intentions</label>
                  <select
                    className="login-input"
                    value={datingIntentions}
                    onChange={(e) => setDatingIntentions(e.target.value)}
                  >
                    {DATING_INTENTIONS.map((d) => (
                      <option key={d.value} value={d.value} style={{ color: "#000" }}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {error && <p className="login-error-text">{error}</p>}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="login-btn"
                    style={{ background: "rgba(255,255,255,0.12)", color: "#fff", flex: "0 0 90px" }}
                    onClick={handleBackStep}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button className="login-btn" disabled={loading} type="submit" style={{ flex: 1 }}>
                    {loading ? "Creating account..." : "Sign up"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        <p className="login-footer-text">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}