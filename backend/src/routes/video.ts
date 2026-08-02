import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createVideoToken, videoEnabled } from "../config/livekit";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({ enabled: videoEnabled });
});

const tokenSchema = z.object({
  matchId: z.string().uuid(),
});

/**
 * Verifies the requesting user is one of the two people on this match,
 * the match is accepted (not pending/rejected), and neither side has
 * blocked the other — then issues a scoped LiveKit token.
 */
router.post("/token", requireAuth, async (req: AuthRequest, res) => {
  if (!videoEnabled) {
    return res.status(503).json({ error: "Video calling isn't configured on this server yet" });
  }

  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { matchId } = parsed.data;

  try {
    const matchResult = await pool.query(
      `SELECT id, user_a, user_b, status FROM matches WHERE id = $1`,
      [matchId]
    );
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: "Match not found" });
    }
    const match = matchResult.rows[0];

    if (match.user_a !== req.userId && match.user_b !== req.userId) {
      return res.status(403).json({ error: "You're not part of this match" });
    }
    if (match.status !== "accepted") {
      return res.status(400).json({ error: "Video calls are only available for accepted matches" });
    }

    const otherUserId = match.user_a === req.userId ? match.user_b : match.user_a;
    const blockResult = await pool.query(
      `SELECT 1 FROM blocks
       WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [req.userId, otherUserId]
    );
    if (blockResult.rows.length > 0) {
      return res.status(403).json({ error: "Can't start a call on this match" });
    }

    const profileResult = await pool.query(
      `SELECT display_name FROM profiles WHERE user_id = $1`,
      [req.userId]
    );
    const displayName = profileResult.rows[0]?.display_name || "BuddiesPride user";

    const { token, url, roomName } = await createVideoToken({
      userId: req.userId as string,
      displayName,
      matchId,
    });

    res.json({ token, url, roomName });
  } catch (err) {
    console.error("Video token error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
