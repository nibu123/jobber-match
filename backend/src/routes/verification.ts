import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, AuthRequest } from "../middleware/auth";
import cloudinary from "../config/cloudinary";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Get own verification status (badge state for profile + history)
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userResult = await pool.query(
      "SELECT is_verified FROM users WHERE id = $1",
      [req.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const latestRequest = await pool.query(
      `SELECT id, status, created_at, reviewed_at, reviewer_note
       FROM verification_requests WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );

    res.json({
      isVerified: userResult.rows[0].is_verified,
      latestRequest: latestRequest.rows[0] || null,
    });
  } catch (err) {
    console.error("Verification status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Submit a selfie for verification (multipart/form-data, field name: "selfie")
// This is an MVP flow: submissions queue for manual/admin review.
// A production version should pair this with a liveness-check API
// (e.g. a KYC provider) before auto-approving anything.
router.post(
  "/submit",
  requireAuth,
  upload.single("selfie"),
  async (req: AuthRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No selfie file provided" });
    }

    try {
      const pending = await pool.query(
        `SELECT id FROM verification_requests WHERE user_id = $1 AND status = 'pending'`,
        [req.userId]
      );
      if (pending.rows.length > 0) {
        return res.status(409).json({ error: "You already have a pending verification request" });
      }

      const alreadyVerified = await pool.query(
        "SELECT is_verified FROM users WHERE id = $1",
        [req.userId]
      );
      if (alreadyVerified.rows[0]?.is_verified) {
        return res.status(409).json({ error: "Account is already verified" });
      }

      const base64 = req.file.buffer.toString("base64");
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: "jobber-match/verification", // separate, non-public folder from profile photos
        resource_type: "image",
        transformation: [{ width: 1080, height: 1080, crop: "limit" }],
      });

      const result = await pool.query(
        `INSERT INTO verification_requests (user_id, selfie_url, status)
         VALUES ($1, $2, 'pending') RETURNING id, status, created_at`,
        [req.userId, uploadResult.secure_url]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Verification submit error:", err);
      res.status(500).json({ error: "Failed to submit verification" });
    }
  }
);

// ---- Admin review endpoints ----
// Gated by ADMIN_API_KEY env var (simple shared-secret for MVP; swap for
// a real admin-role check once there's an admin user system).
function requireAdmin(req: AuthRequest, res: any, next: any) {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

router.get("/admin/pending", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT vr.id, vr.user_id, vr.selfie_url, vr.created_at, p.display_name, p.photos
       FROM verification_requests vr
       JOIN profiles p ON p.user_id = vr.user_id
       WHERE vr.status = 'pending'
       ORDER BY vr.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Admin pending verifications error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
  note: z.string().max(500).optional(),
});

router.post("/admin/review", requireAdmin, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { requestId, approve, note } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const reqRow = await client.query(
      `SELECT user_id FROM verification_requests WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [requestId]
    );
    if (reqRow.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pending request not found" });
    }
    const targetUserId = reqRow.rows[0].user_id;

    await client.query(
      `UPDATE verification_requests SET status = $1, reviewer_note = $2, reviewed_at = NOW() WHERE id = $3`,
      [approve ? "approved" : "rejected", note || null, requestId]
    );

    if (approve) {
      await client.query(`UPDATE users SET is_verified = TRUE WHERE id = $1`, [targetUserId]);
    }

    await client.query("COMMIT");
    res.json({ message: approve ? "Approved" : "Rejected" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Admin review error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

export default router;
