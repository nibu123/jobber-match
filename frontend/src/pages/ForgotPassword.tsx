import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import PumpingHeart from "../components/PumpingHeart";

export default function ForgotPassword() {
  const navigate = useNavigate();

  // step 1 = enter email, step 2 = enter OTP, step 3 = set new password, step 4 = done
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  async function handleRequestCode(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password/request", { email });
      // Backend always returns a generic success response (won't reveal
      // whether the account exists) — move to the OTP step either way.
      setStep(2);
      startResendCooldown();
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not send code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password/request", { email });
      startResendCooldown();
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (otpCode.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password/verify", { email, code: otpCode });
      setResetToken(res.data.resetToken);
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.error || "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { resetToken, newPassword });
      setStep(4);
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not reset password. Please request a new code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-glass-card">
        <div className="login-brand-wrap">
          <PumpingHeart />
          <div className="brand">Buddies Pride</div>
          <p className="login-tagline">
            {step === 1 && "Reset your password"}
            {step === 2 && "Enter the code we sent you"}
            {step === 3 && "Choose a new password"}
            {step === 4 && "All set"}
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={handleRequestCode}>
            <div className="login-field">
              <label>Email</label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && <p className="login-error-text">{error}</p>}

            <button className="login-btn" disabled={loading} type="submit">
              {loading ? "Sending code..." : "Send reset code"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyCode}>
            <div className="login-field">
              <label>6-digit code</label>
              <input
                type="text"
                className="login-input"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                style={{ letterSpacing: "4px" }}
                autoFocus
                required
              />
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
                If an account exists for {email}, a code was sent. It expires in 10 minutes.
              </p>
            </div>

            {error && <p className="login-error-text">{error}</p>}

            <button className="login-btn" disabled={loading || otpCode.length !== 6} type="submit">
              {loading ? "Verifying..." : "Verify code"}
            </button>

            <button
              type="button"
              className="login-btn"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", marginTop: 10 }}
              onClick={handleResendCode}
              disabled={loading || resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <div className="login-field">
              <label>New password (min 8 characters)</label>
              <input
                type="password"
                className="login-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                autoFocus
                required
              />
            </div>

            <div className="login-field">
              <label>Confirm new password</label>
              <input
                type="password"
                className="login-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            {error && <p className="login-error-text">{error}</p>}

            <button className="login-btn" disabled={loading} type="submit">
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}

        {step === 4 && (
          <div>
            <p style={{ color: "rgba(255,255,255,0.85)", textAlign: "center", marginBottom: 20 }}>
              Your password has been reset successfully. You can now log in with your new password.
            </p>
            <button className="login-btn" onClick={() => navigate("/login")} type="button">
              Go to login
            </button>
          </div>
        )}

        {step !== 4 && (
          <p className="login-footer-text">
            Remembered your password? <Link to="/login">Log in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
