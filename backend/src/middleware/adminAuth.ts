import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// IMPORTANT: use a SEPARATE secret from your regular user JWT_SECRET.
// Add ADMIN_JWT_SECRET to Railway env vars (Variables UI, not committed .env).
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET as string;

export interface AdminJwtPayload {
  adminId: string;
  email: string;
  role: string;
}

// Extend Express Request to carry the authenticated admin
export interface AdminRequest extends Request {
  admin?: AdminJwtPayload;
}

export function adminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No admin token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as AdminJwtPayload;
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}

// Optional: restrict certain routes to super_admin only (e.g. creating other admins)
export function requireSuperAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  if (req.admin?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}
