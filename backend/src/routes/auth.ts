import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { UAParser } from "ua-parser-js";
import { pool } from "../db/pool";
import { sendOtpEmail, sendPasswordResetOtpEmail } from "../utils/email";

const router = Router();

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// ---- Login history helpers ----

function getClientIp(req: any): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "";
}

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("::ffff:127.")
  );
}

async function getGeoLocation(ip: string): Promise<{ city: string | null; region: string | null; country: string | null }> {
  if (isPrivateIp(ip)) {
    return { city: null, region: null, country: null };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await response.json();
    if (data.status === "success") {
      return { city: data.city || null, region: data.regionName || null, country: data.country || null };
    }
  } catch (err) {
    console.error("Geolocation lookup failed:", err);
  }
  return { city: null, region: null, country: null };
}

async function recordLogin(userId: string, req: any) {
  try {
    const ip = getClientIp(req);
    const userAgentString = req.headers["user-agent"] || "";
    const parser = new UAParser(userAgentString);
    const device = parser.getDevice();
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const geo = await getGeoLocation(ip);

    await pool.query(
      `INSERT INTO login_history (user_id, ip_address, city, region, country, device_type, browser, os, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        ip || null,
        geo.city,
        geo.region,
        geo.country,
        device.type || "desktop",
        browser.name || "Unknown",
        os.name || "Unknown",
        userAgentString || null,
      ]
    );
  } catch (err) {
    // Never let login-tracking break the actual login
    console.error("Failed to record login history:", err);
  }
}

// ---- Existing routes ----

const sendOtpSchema = z.object({
  email: z.string().email(),
});

router.post("/send-otp", async (req, res) => {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  const { email } = parsed.data;

  try {
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      "UPDATE otp_codes SET consumed = TRUE WHERE email = $1 AND purpose = 'signup' AND consumed = FALSE",
      [email]
    );

    await pool.query(
      "INSERT INTO otp_codes (email, code, expires_at, purpose) VALUES ($1, $2, $3, 'signup')",
      [email, code, expiresAt]
    );

    await sendOtpEmail(email, code);

    res.json({ success: true });
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ error: "Could not send code. Please try again." });
  }
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

router.post("/verify-otp", async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter the 6-digit code" });
  }
  const { email, code } = parsed.data;

  try {
    const result = await pool.query(
      `SELECT id, code, expires_at, attempts FROM otp_codes
       WHERE email = $1 AND purpose = 'signup' AND consumed = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "No code found. Please request a new one." });
    }

    const otp = result.rows[0];

    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: "Code expired. Please request a new one." });
    }

    if (otp.attempts >= 5) {
      return res.status(429).json({ error: "Too many attempts. Please request a new code." });
    }

    if (otp.code !== code) {
      await pool.query("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1", [otp.id]);
      return res.status(400).json({ error: "Incorrect code" });
    }

    await pool.query("UPDATE otp_codes SET consumed = TRUE WHERE id = $1", [otp.id]);

    const emailVerifyToken = jwt.sign(
      { email, purpose: "email_verify" },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    res.json({ emailVerifyToken });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

const signupSchema = z.object({
  email: z.string().email(),
  emailVerifyToken: z.string(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(50),
  orientation: z.string().min(1),
  genderIdentity: z.string().min(1),
  pronouns: z.string().optional(),
  age: z.number().int().min(18, "You must be 18 or older to use this app"),
  datingIntentions: z.string().optional(),
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, emailVerifyToken, password, displayName, orientation, genderIdentity, pronouns, age, datingIntentions } =
    parsed.data;

  try {
    let verifiedPayload: { email: string; purpose: string };
    try {
      verifiedPayload = jwt.verify(emailVerifyToken, process.env.JWT_SECRET as string) as {
        email: string;
        purpose: string;
      };
    } catch {
      return res.status(400).json({ error: "Email verification expired. Please verify your email again." });
    }

    if (verifiedPayload.purpose !== "email_verify" || verifiedPayload.email !== email) {
      return res.status(400).json({ error: "Please verify your email first" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      "INSERT INTO users (email, password_hash, is_verified) VALUES ($1, $2, TRUE) RETURNING id",
      [email, passwordHash]
    );
    const userId = userResult.rows[0].id;

    await pool.query(
      `INSERT INTO profiles (user_id, display_name, orientation, gender_identity, pronouns, age, dating_intentions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, displayName, orientation, genderIdentity, pronouns || null, age, datingIntentions || null]
    );

    const token = jwt.sign({ userId }, process.env.JWT_SECRET as string, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    } as jwt.SignOptions);

    // Record this as the first login (fire-and-forget, doesn't block response)
    recordLogin(userId, req);

    res.status(201).json({ token, userId });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  try {
    const result = await pool.query(
      "SELECT id, password_hash, is_banned FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];

    if (user.is_banned) {
      return res.status(403).json({ error: "This account has been suspended" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    } as jwt.SignOptions);

    // Record this login (fire-and-forget, doesn't block response)
    recordLogin(user.id, req);

    res.json({ token, userId: user.id });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- Forgot password ----

const forgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

router.post("/forgot-password/request", async (req, res) => {
  const parsed = forgotPasswordRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  const { email } = parsed.data;

  // Always respond the same way whether the email exists or not,
  // so this endpoint can't be used to check which emails are registered.
  const GENERIC_RESPONSE = {
    success: true,
    message: "If an account with that email exists, a reset code has been sent.",
  };

  try {
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length === 0) {
      return res.json(GENERIC_RESPONSE);
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      "UPDATE otp_codes SET consumed = TRUE WHERE email = $1 AND purpose = 'password_reset' AND consumed = FALSE",
      [email]
    );

    await pool.query(
      "INSERT INTO otp_codes (email, code, expires_at, purpose) VALUES ($1, $2, $3, 'password_reset')",
      [email, code, expiresAt]
    );

    await sendPasswordResetOtpEmail(email, code);

    res.json(GENERIC_RESPONSE);
  } catch (err) {
    console.error("Forgot password request error:", err);
    res.status(500).json({ error: "Could not process request. Please try again." });
  }
});

const forgotPasswordVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

router.post("/forgot-password/verify", async (req, res) => {
  const parsed = forgotPasswordVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter the 6-digit code" });
  }
  const { email, code } = parsed.data;

  try {
    const result = await pool.query(
      `SELECT id, code, expires_at, attempts FROM otp_codes
       WHERE email = $1 AND purpose = 'password_reset' AND consumed = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "No code found. Please request a new one." });
    }

    const otp = result.rows[0];

    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: "Code expired. Please request a new one." });
    }

    if (otp.attempts >= 5) {
      return res.status(429).json({ error: "Too many attempts. Please request a new code." });
    }

    if (otp.code !== code) {
      await pool.query("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1", [otp.id]);
      return res.status(400).json({ error: "Incorrect code" });
    }

    await pool.query("UPDATE otp_codes SET consumed = TRUE WHERE id = $1", [otp.id]);

    // Short-lived token proving this email just verified a password-reset OTP.
    // Same pattern as the email_verify token used during signup.
    const resetToken = jwt.sign(
      { email, purpose: "password_reset" },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    res.json({ resetToken });
  } catch (err) {
    console.error("Forgot password verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

const resetPasswordSchema = z.object({
  resetToken: z.string(),
  newPassword: z.string().min(8),
});

router.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { resetToken, newPassword } = parsed.data;

  try {
    let verifiedPayload: { email: string; purpose: string };
    try {
      verifiedPayload = jwt.verify(resetToken, process.env.JWT_SECRET as string) as {
        email: string;
        purpose: string;
      };
    } catch {
      return res.status(400).json({ error: "Reset link expired. Please request a new code." });
    }

    if (verifiedPayload.purpose !== "password_reset") {
      return res.status(400).json({ error: "Invalid reset token" });
    }

    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [verifiedPayload.email]);
    if (existingUser.rows.length === 0) {
      return res.status(400).json({ error: "Invalid reset token" });
    }
    const userId = existingUser.rows[0].id;

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);

    res.json({ success: true, message: "Password reset successful. Please log in with your new password." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Could not reset password. Please try again." });
  }
});

export default router;