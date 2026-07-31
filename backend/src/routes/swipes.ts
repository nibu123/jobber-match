import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const swipeSchema = z.object({
  targetUserId: z.string().uuid(),
  action: z.enum(["like", "pass", "superlike"]),
});

// Record a swipe; auto-creates an accepted match on mutual like/superlike
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = swipeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { targetUserId, action } = parsed.data;

  if (targetUserId === req.userId) {
    return res.status(400).json({ error: "You can't swipe on yourself" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO swipes (swiper_id, target_id, action) VALUES ($1, $2, $3)
       ON CONFLICT (swiper_id, target_id) DO UPDATE SET action = EXCLUDED.action`,
      [req.userId, targetUserId, action]
    );

    let match = null;

    if (action === "like" || action === "superlike") {
      const reciprocal = await client.query(
        `SELECT 1 FROM swipes WHERE swiper_id = $1 AND target_id = $2 AND action IN ('like', 'superlike')`,
        [targetUserId, req.userId]
      );

      if ((reciprocal.rowCount ?? 0) > 0) {
        const userA = req.userId! < targetUserId ? req.userId : targetUserId;
        const userB = req.userId! < targetUserId ? targetUserId : req.userId;

        const matchResult = await client.query(
          `INSERT INTO matches (user_a, user_b, status) VALUES ($1, $2, 'accepted')
           ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'accepted'
           RETURNING *`,
          [userA, userB]
        );
        match = matchResult.rows[0];
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ action, matched: !!match, match });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Swipe error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

export default router;
