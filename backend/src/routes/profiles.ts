import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// Get own profile
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query("SELECT * FROM profiles WHERE user_id = $1", [req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  orientation: z.string().optional(),
  genderIdentity: z.string().optional(),
  pronouns: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  city: z.string().optional(),
  incognitoMode: z.boolean().optional(),
});

// Update own profile
router.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const fields = parsed.data;
  const columnMap: Record<string, string> = {
    displayName: "display_name",
    bio: "bio",
    orientation: "orientation",
    genderIdentity: "gender_identity",
    pronouns: "pronouns",
    photos: "photos",
    latitude: "latitude",
    longitude: "longitude",
    city: "city",
    incognitoMode: "incognito_mode",
  };

  const setClauses: string[] = [];
  const values: any[] = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${columnMap[key]} = $${i}`);
    values.push(value);
    i++;
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(req.userId);

  try {
    const result = await pool.query(
      `UPDATE profiles SET ${setClauses.join(", ")} WHERE user_id = $${i} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Browse profiles (excluding self, blocked users, and incognito users)
router.get("/browse", requireAuth, async (req: AuthRequest, res) => {
  const orientation = req.query.orientation as string | undefined;

  try {
    let query = `
      SELECT p.user_id, p.display_name, p.bio, p.orientation, p.gender_identity,
             p.pronouns, p.photos, p.city
      FROM profiles p
      WHERE p.user_id != $1
        AND p.incognito_mode = FALSE
        AND p.user_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = $1
          UNION
          SELECT blocker_id FROM blocks WHERE blocked_id = $1
        )
    `;
    const values: any[] = [req.userId];

    if (orientation) {
      query += ` AND p.orientation = $2`;
      values.push(orientation);
    }

    query += ` LIMIT 50`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error("Browse profiles error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
