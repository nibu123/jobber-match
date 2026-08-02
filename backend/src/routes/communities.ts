import { Router } from "express";
import { pool } from "../db/pool";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// List all communities, with whether the current user has joined + member count
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.slug, c.name, c.description, c.icon,
              COUNT(cm2.user_id) AS member_count,
              EXISTS(
                SELECT 1 FROM community_members cm
                WHERE cm.community_id = c.id AND cm.user_id = $1
              ) AS joined
       FROM communities c
       LEFT JOIN community_members cm2 ON cm2.community_id = c.id
       GROUP BY c.id
       ORDER BY c.name ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List communities error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Communities the current user has joined
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.slug, c.name, c.description, c.icon, cm.joined_at
       FROM communities c
       JOIN community_members cm ON cm.community_id = c.id
       WHERE cm.user_id = $1
       ORDER BY cm.joined_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List my communities error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const communityCheck = await pool.query(`SELECT id FROM communities WHERE id = $1`, [req.params.id]);
    if (communityCheck.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }
    await pool.query(
      `INSERT INTO community_members (community_id, user_id) VALUES ($1, $2)
       ON CONFLICT (community_id, user_id) DO NOTHING`,
      [req.params.id, req.userId]
    );
    res.status(201).json({ message: "Joined" });
  } catch (err) {
    console.error("Join community error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    await pool.query(
      `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    res.json({ message: "Left" });
  } catch (err) {
    console.error("Leave community error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Browse other members of a community you belong to (lightweight discovery,
// reuses the same privacy rules as /profiles/browse: no incognito or blocked users)
router.get("/:id/members", requireAuth, async (req: AuthRequest, res) => {
  try {
    const membership = await pool.query(
      `SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "Join this community to see its members" });
    }

    const result = await pool.query(
      `SELECT p.user_id, p.display_name, p.bio, p.photos, p.city
       FROM community_members cm
       JOIN profiles p ON p.user_id = cm.user_id
       WHERE cm.community_id = $1
         AND cm.user_id != $2
         AND p.incognito_mode = FALSE
         AND cm.user_id NOT IN (
           SELECT blocked_id FROM blocks WHERE blocker_id = $2
           UNION
           SELECT blocker_id FROM blocks WHERE blocked_id = $2
         )
       ORDER BY cm.joined_at DESC
       LIMIT 50`,
      [req.params.id, req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Community members error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
