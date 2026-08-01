import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const requestSchema = z.object({
  targetUserId: z.string().uuid(),
});

// Send a match request
router.post("/request", requireAuth, async (req: AuthRequest, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { targetUserId } = parsed.data;
  if (targetUserId === req.userId) {
    return res.status(400).json({ error: "Cannot match with yourself" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO matches (user_a, user_b, status) VALUES ($1, $2, 'pending')
       ON CONFLICT (user_a, user_b) DO NOTHING RETURNING *`,
      [req.userId, targetUserId]
    );
    res.status(201).json(result.rows[0] || { message: "Request already exists" });
  } catch (err) {
    console.error("Match request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Accept a match request
router.post("/:matchId/accept", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `UPDATE matches SET status = 'accepted'
       WHERE id = $1 AND user_b = $2 AND status = 'pending' RETURNING *`,
      [req.params.matchId, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Match request not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Accept match error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List all accepted matches for current user
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.status, m.created_at,
              CASE WHEN m.user_a = $1 THEN m.user_b ELSE m.user_a END AS other_user_id,
              p.display_name, p.photos,
              CASE WHEN m.user_a = $1 THEN m.photo_revealed_a ELSE m.photo_revealed_b END AS my_photo_revealed,
              CASE WHEN m.user_a = $1 THEN m.photo_revealed_b ELSE m.photo_revealed_a END AS their_photo_revealed
       FROM matches m
       JOIN profiles p ON p.user_id = CASE WHEN m.user_a = $1 THEN m.user_b ELSE m.user_a END
       WHERE (m.user_a = $1 OR m.user_b = $1) AND m.status = 'accepted'
       ORDER BY m.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List matches error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reveal own photo for a specific match
router.post("/:matchId/reveal-photo", requireAuth, async (req: AuthRequest, res) => {
  try {
    const matchResult = await pool.query(
      `SELECT user_a, user_b FROM matches WHERE id = $1 AND status = 'accepted'`,
      [req.params.matchId]
    );
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: "Match not found" });
    }
    const match = matchResult.rows[0];
    if (match.user_a !== req.userId && match.user_b !== req.userId) {
      return res.status(403).json({ error: "Not part of this match" });
    }
    const column = match.user_a === req.userId ? "photo_revealed_a" : "photo_revealed_b";
    const result = await pool.query(
      `UPDATE matches SET ${column} = true WHERE id = $1 RETURNING *`,
      [req.params.matchId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Reveal photo error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

