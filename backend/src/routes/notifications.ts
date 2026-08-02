import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, AuthRequest } from "../middleware/auth";
import webpush, { pushEnabled } from "../config/webpush";

const router = Router();

router.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null, enabled: pushEnabled });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

router.post("/subscribe", requireAuth, async (req: AuthRequest, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { endpoint, keys } = parsed.data;

  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
      [req.userId, endpoint, keys.p256dh, keys.auth]
    );
    res.status(201).json({ message: "Subscribed" });
  } catch (err) {
    console.error("Push subscribe error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/unsubscribe", requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [req.userId, parsed.data.endpoint]
    );
    res.json({ message: "Unsubscribed" });
  } catch (err) {
    console.error("Push unsubscribe error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export async function notifyUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!pushEnabled) return;

  try {
    const subs = await pool.query(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
      [userId]
    );

    await Promise.all(
      subs.rows.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload)
          );
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await pool.query(
              `DELETE FROM push_subscriptions WHERE endpoint = $1`,
              [sub.endpoint]
            );
          } else {
            console.error("Push send error:", err?.message || err);
          }
        }
      })
    );
  } catch (err) {
    console.error("notifyUser error:", err);
  }
}

export default router;
