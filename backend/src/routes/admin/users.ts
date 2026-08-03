import { Router, Response } from 'express';
import { pool } from '../../db/pool'; // ADJUST to your db module
import { adminAuth, AdminRequest } from '../../middleware/adminAuth';

const router = Router();
router.use(adminAuth); // every route below requires a valid admin token

async function logAction(adminId: string, action: string, targetType: string, targetId: string, details: object = {}) {
  await pool.query(
    'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
    [adminId, action, targetType, targetId, JSON.stringify(details)]
  );
}

// GET /api/admin/users?search=&page=1&limit=20&filter=banned|verified|all
router.get('/', async (req: AdminRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;
  const search = (req.query.search as string) || '';
  const filter = (req.query.filter as string) || 'all';

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`);
  }
  if (filter === 'banned') conditions.push('is_banned = true');
  if (filter === 'verified') conditions.push('is_verified = true');
  if (filter === 'unverified') conditions.push('is_verified = false');

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const usersResult = await pool.query(
      `SELECT id, name, email, phone, is_banned, ban_reason, is_verified, created_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ users: usersResult.rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Admin users list error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/users/:id
router.get('/:id', async (req: AdminRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    delete result.rows[0].password_hash; // never leak this even to admins
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin user detail error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/admin/users/:id/ban  { banned: true, reason: "..." }
router.patch('/:id/ban', async (req: AdminRequest, res: Response) => {
  const { banned, reason } = req.body;
  try {
    await pool.query(
      `UPDATE users SET is_banned = $1, ban_reason = $2, banned_at = CASE WHEN $1 THEN now() ELSE NULL END WHERE id = $3`,
      [!!banned, banned ? reason || 'No reason provided' : null, req.params.id]
    );
    await logAction(req.admin!.adminId, banned ? 'ban_user' : 'unban_user', 'user', req.params.id, { reason });
    res.json({ success: true });
  } catch (err) {
    console.error('Admin ban error:', err);
    res.status(500).json({ error: 'Failed to update ban status' });
  }
});

// PATCH /api/admin/users/:id/verify  { verified: true }
router.patch('/:id/verify', async (req: AdminRequest, res: Response) => {
  const { verified } = req.body;
  try {
    await pool.query('UPDATE users SET is_verified = $1 WHERE id = $2', [!!verified, req.params.id]);
    await logAction(req.admin!.adminId, verified ? 'verify_user' : 'unverify_user', 'user', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Admin verify error:', err);
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

export default router;
