import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool";

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    req.userId = decoded.userId;

    // Fire-and-forget "Recently Active" heartbeat. Throttled in SQL itself
    // (only writes if the stored timestamp is missing or >5 min old) so this
    // doesn't turn into a DB write on every single authenticated request.
    pool
      .query(
        `UPDATE users
         SET last_active_at = NOW()
         WHERE id = $1
           AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '5 minutes')`,
        [decoded.userId]
      )
      .catch((err) => console.error("last_active_at heartbeat failed:", err));

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
