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

function jitterCoordinate(lat: number, lng: number, radiusKm: number = 1): { latitude: number; longitude: number } {
  const radiusInDegrees = radiusKm / 111;
  const u = Math.random();
  const v = Math.random();
  const w = radiusInDegrees * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const deltaLat = w * Math.cos(t);
  const deltaLng = (w * Math.sin(t)) / Math.cos((lat * Math.PI) / 180);
  return { latitude: lat + deltaLat, longitude: lng + deltaLng };
}

// Converts a precise km value into a coarse display bucket so the
// +/-1-2km noise introduced by jitterCoordinate() isn't presented
// to users as a falsely precise number.
function bucketDistanceKm(km: number | null | undefined): string | null {
  if (km == null) return null;
  if (km < 1) return "Nearby";
  if (km < 5) return "5 km away";
  const rounded = Math.round(km / 5) * 5;
  return `${rounded} km away`;
}


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
  age: z.number().int().min(18).optional(),
  datingIntentions: z.string().optional(),

  // Identity
  preferredName: z.string().max(50).optional(),
  beyondBinary: z.boolean().optional(),
  identityTags: z.array(z.string()).optional(),

  // Relationship
  relationshipStructure: z.string().optional(),
  interestedIn: z.array(z.string()).optional(),
  agePrefMin: z.number().int().min(18).max(120).optional(),
  agePrefMax: z.number().int().min(18).max(120).optional(),
  distancePrefKm: z.number().int().min(1).max(500).optional(),

  // Interests
  interests: z.array(z.string()).max(15).optional(),

  // Lifestyle
  heightCm: z.number().int().min(100).max(250).optional(),
  smoking: z.string().optional(),
  drinking: z.string().optional(),
  drugFriendly: z.string().optional(),
  kids: z.string().optional(),
  religion: z.string().optional(),
  starSign: z.string().optional(),
  education: z.string().optional(),
  occupation: z.string().optional(),

  // About & Safety
  languages: z.array(z.string()).optional(),
  hometown: z.string().optional(),
  prompts: z.array(z.object({ question: z.string(), answer: z.string().max(300) })).max(3).optional(),
  locationBlur: z.boolean().optional(),
  communityTags: z.array(z.string()).optional(),
});

// Update own profile
router.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const fields = parsed.data;
  if (fields.prompts !== undefined) {
    (fields as any).prompts = JSON.stringify(fields.prompts);
  }
  if (fields.latitude != null && fields.longitude != null) {
    const jittered = jitterCoordinate(fields.latitude, fields.longitude, 1);
    fields.latitude = jittered.latitude;
    fields.longitude = jittered.longitude;
  }
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
    age: "age",
    datingIntentions: "dating_intentions",

    preferredName: "preferred_name",
    beyondBinary: "beyond_binary",
    identityTags: "identity_tags",
    relationshipStructure: "relationship_structure",
    interestedIn: "interested_in",
    agePrefMin: "age_pref_min",
    agePrefMax: "age_pref_max",
    distancePrefKm: "distance_pref_km",
    interests: "interests",
    heightCm: "height_cm",
    smoking: "smoking",
    drinking: "drinking",
    drugFriendly: "drug_friendly",
    kids: "kids",
    religion: "religion",
    starSign: "star_sign",
    education: "education",
    occupation: "occupation",
    languages: "languages",
    hometown: "hometown",
    prompts: "prompts",
    locationBlur: "location_blur",
    communityTags: "community_tags",
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

const browseQuerySchema = z.object({
  orientation: z.string().optional(),
  minAge: z.coerce.number().int().min(18).optional(),
  maxAge: z.coerce.number().int().max(120).optional(),
  maxDistanceKm: z.coerce.number().positive().optional(),
  relationshipStructure: z.string().optional(),
  minHeightCm: z.coerce.number().int().min(100).optional(),
  maxHeightCm: z.coerce.number().int().max(250).optional(),
  minSharedInterests: z.coerce.number().int().min(0).optional(),
});

// Browse profiles (excluding self, blocked users, already-swiped users, and incognito users)
// Ordered by: same dating-intentions first, then most shared interests, then nearest distance
router.get("/browse", requireAuth, async (req: AuthRequest, res) => {
  const parsedQuery = browseQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: parsedQuery.error.flatten() });
  }
  const {
    orientation, minAge, maxAge, maxDistanceKm,
    relationshipStructure, minHeightCm, maxHeightCm, minSharedInterests,
  } = parsedQuery.data;

  try {
    // Fetch own profile for distance + dating-intentions ranking + reciprocal age-pref
    const selfResult = await pool.query(
      `SELECT latitude, longitude, dating_intentions, age,
              age_pref_min, age_pref_max, interests
       FROM profiles WHERE user_id = $1`,
      [req.userId]
    );
    if (selfResult.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }
    const self = selfResult.rows[0];
    const hasSelfLocation = self.latitude != null && self.longitude != null;
    const selfInterests: string[] = self.interests || [];

    const values: any[] = [req.userId];

    // Build distance expression (parameterized, no string interpolation of data)
    let distanceSql = "NULL::double precision AS distance_km";
    let latIdx = -1;
    let lngIdx = -1;
    if (hasSelfLocation) {
      values.push(self.latitude);
      latIdx = values.length;
      values.push(self.longitude);
      lngIdx = values.length;
      distanceSql = `
        (CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN
           6371 * acos(
             LEAST(1, GREATEST(-1,
               cos(radians($${latIdx})) * cos(radians(p.latitude)) *
               cos(radians(p.longitude) - radians($${lngIdx})) +
               sin(radians($${latIdx})) * sin(radians(p.latitude))
             ))
           )
         ELSE NULL END) AS distance_km`;
    }

    // Shared-interests count via array intersection (parameterized)
    let sharedInterestsSql = "0 AS shared_interests";
    if (selfInterests.length > 0) {
      values.push(selfInterests);
      const interestsIdx = values.length;
      sharedInterestsSql = `
        cardinality(ARRAY(
          SELECT UNNEST(p.interests) INTERSECT SELECT UNNEST($${interestsIdx}::text[])
        )) AS shared_interests`;
    }

    let query = `
      SELECT p.user_id, p.display_name, p.bio, p.orientation, p.gender_identity,
             p.pronouns, p.photos, p.city, p.age, p.dating_intentions,
             p.relationship_structure, p.height_cm, p.interests,
             ${distanceSql},
             ${sharedInterestsSql}
      FROM profiles p
      WHERE p.user_id != $1
        AND p.incognito_mode = FALSE
        AND p.user_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = $1
          UNION
          SELECT blocker_id FROM blocks WHERE blocked_id = $1
        )
        AND p.user_id NOT IN (
          SELECT target_id FROM swipes WHERE swiper_id = $1
        )
    `;

    if (orientation) {
      values.push(orientation);
      query += ` AND p.orientation = $${values.length}`;
    }
    if (minAge !== undefined) {
      values.push(minAge);
      query += ` AND p.age >= $${values.length}`;
    }
    if (maxAge !== undefined) {
      values.push(maxAge);
      query += ` AND p.age <= $${values.length}`;
    }
    if (relationshipStructure) {
      values.push(relationshipStructure);
      query += ` AND p.relationship_structure = $${values.length}`;
    }
    if (minHeightCm !== undefined) {
      values.push(minHeightCm);
      query += ` AND p.height_cm >= $${values.length}`;
    }
    if (maxHeightCm !== undefined) {
      values.push(maxHeightCm);
      query += ` AND p.height_cm <= $${values.length}`;
    }
    // Reciprocal age-preference: self's age must fit their range, and their age must fit self's range
    if (self.age != null) {
      values.push(self.age);
      query += ` AND (p.age_pref_min IS NULL OR p.age_pref_min <= $${values.length})`;
      values.push(self.age);
      query += ` AND (p.age_pref_max IS NULL OR p.age_pref_max >= $${values.length})`;
    }
    if (self.age_pref_min != null) {
      values.push(self.age_pref_min);
      query += ` AND (p.age IS NULL OR p.age >= $${values.length})`;
    }
    if (self.age_pref_max != null) {
      values.push(self.age_pref_max);
      query += ` AND (p.age IS NULL OR p.age <= $${values.length})`;
    }

    // Wrap for optional maxDistanceKm / minSharedInterests filters (need computed aliases)
    let finalQuery = `SELECT * FROM (${query}) sub WHERE 1=1`;
    if (maxDistanceKm !== undefined && hasSelfLocation) {
      values.push(maxDistanceKm);
      finalQuery += ` AND (sub.distance_km IS NULL OR sub.distance_km <= $${values.length})`;
    }
    if (minSharedInterests !== undefined) {
      values.push(minSharedInterests);
      finalQuery += ` AND sub.shared_interests >= $${values.length}`;
    }

    // Rank same dating-intentions higher, then more shared interests, then nearest
    let intentionsRankExpr = "1";
    if (self.dating_intentions) {
      values.push(self.dating_intentions);
      intentionsRankExpr = `(CASE WHEN sub.dating_intentions = $${values.length} THEN 0 ELSE 1 END)`;
    }

    finalQuery += `
      ORDER BY ${intentionsRankExpr} ASC, sub.shared_interests DESC, sub.distance_km ASC NULLS LAST
      LIMIT 50
    `;

    const result = await pool.query(finalQuery, values);
    // Sorting above already used precise distance_km; here we only
    // replace the field we SEND to the client with a coarse bucket.
    const bucketedRows = result.rows.map((row: any) => ({
      ...row,
      distance_km: bucketDistanceKm(row.distance_km),
    }));
    res.json(bucketedRows);
  } catch (err) {
    console.error("Browse profiles error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
