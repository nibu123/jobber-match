import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../../db/pool'; // ADJUST: point this to your existing db pool (same one auth.ts / communities.ts use)
import { adminAuth, AdminRequest } from '../../middleware/adminAuth';

const router = Router();
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET as string;

// POST /api/admin/auth/login
router.post('/login', async (req, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, name, role, is_active FROM admin_users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const admin = result.rows[0];

    if (!admin || !admin.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatches = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      ADMIN_JWT_SECRET,
      { expiresIn: '8h' }
    );

    await pool.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [admin.id]);

    res.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/admin/auth/me
router.get('/me', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role FROM admin_users WHERE id = $1',
      [req.admin!.adminId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Admin not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin /me error:', err);
    res.status(500).json({ error: 'Failed to fetch admin profile' });
  }
});

export default router;
