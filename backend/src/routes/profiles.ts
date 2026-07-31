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

const MAX_PHOTOS = 6;

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

// Upload a photo (multipart/form-data, field name: "photo")
router.post(
  "/photos/upload",
  requireAuth,
  upload.single("photo"),
  async (req: AuthRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No photo file provided" });
    }

    try {
      const current = await pool.query(
        "SELECT photos FROM profiles WHERE user_id = $1",
        [req.userId]
      );
      if (current.rows.length === 0) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const existingPhotos: string[] = current.rows[0].photos || [];
      if (existingPhotos.length >= MAX_PHOTOS) {
        return res.status(400).json({ error: `Maximum ${MAX_PHOTOS} photos allowed` });
      }

      const base64 = req.file.buffer.toString("base64");
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: "jobber-match/profiles",
        resource_type: "image",
        transformation: [{ width: 1080, height: 1080, crop: "limit" }],
      });

      const updatedPhotos = [...existingPhotos, uploadResult.secure_url];

      const result = await pool.query(
        "UPDATE profiles SET photos = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *",
        [updatedPhotos, req.userId]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Photo upload error:", err);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  }
);

const deletePhotoSchema = z.object({
  url: z.string().url(),
});

// Delete a photo
router.delete("/photos", requireAuth, async (req: AuthRequest, res) => {
  const parsed = deletePhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const current = await pool.query(
      "SELECT photos FROM profiles WHERE user_id = $1",
      [req.userId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const existingPhotos: string[] = current.rows[0].photos || [];
    const updatedPhotos = existingPhotos.filter((p) => p !== parsed.data.url);

    const result = await pool.query(
      "UPDATE profiles SET photos = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *",
      [updatedPhotos, req.userId]
    );

    try {
      const match = parsed.data.url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
      if (match && match[1]) {
        await cloudinary.uploader.destroy(match[1]);
      }
    } catch (cloudErr) {
      console.error("Cloudinary cleanup error (non-fatal):", cloudErr);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Delete photo error:", err);
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
