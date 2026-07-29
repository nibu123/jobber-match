import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const blockSchema = z.object({ targetUserId: z.string().uuid() });

router.post("/block", requireAuth, async (req: AuthRequest, res) => {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    await pool.query(
      `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [req.userId, parsed.data.targetUserId]
    );
    res.status(201).json({ message: "User blocked" });
  } catch (err) {
    console.error("Block error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const reportSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().min(1).max(100),
  details: z.string().max(1000).optional(),
});

router.post("/report", requireAuth, async (req: AuthRequest, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { targetUserId, reason, details } = parsed.data;

  try {
    await pool.query(
      `INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES ($1, $2, $3, $4)`,
      [req.userId, targetUserId, reason, details || null]
    );
    res.status(201).json({ message: "Report submitted" });
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
