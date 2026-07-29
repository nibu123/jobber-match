import { Router } from "express";
import { pool } from "../db/pool";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// Get message history for a match (only if current user is part of it)
router.get("/:matchId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const matchCheck = await pool.query(
      `SELECT id FROM matches WHERE id = $1 AND (user_a = $2 OR user_b = $2) AND status = 'accepted'`,
      [req.params.matchId, req.userId]
    );
    if (matchCheck.rows.length === 0) {
      return res.status(403).json({ error: "Not authorized to view this chat" });
    }

    const result = await pool.query(
      `SELECT * FROM messages WHERE match_id = $1 ORDER BY created_at ASC LIMIT 200`,
      [req.params.matchId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
