import { Router, Response } from 'express';
import { pool } from '../../db/pool'; // ADJUST to your db module
import { adminAuth, AdminRequest } from '../../middleware/adminAuth';

const router = Router();
router.use(adminAuth);

// GET /api/admin/reports?status=pending&page=1&limit=20
router.get('/', async (req: AdminRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;
  const status = (req.query.status as string) || 'pending';

  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM reports WHERE status = $1', [status]);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT r.id, r.reason, r.description, r.status, r.created_at,
              reporter.name AS reporter_name, reporter.email AS reporter_email,
              reported.id AS reported_user_id, reported.name AS reported_user_name, reported.email AS reported_user_email
       FROM reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       JOIN users reported ON reported.id = r.reported_id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    res.json({ reports: result.rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Admin reports list error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// PATCH /api/admin/reports/:id  { status: "action_taken" | "dismissed" | "reviewed" }
router.patch('/:id', async (req: AdminRequest, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'reviewed', 'action_taken', 'dismissed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await pool.query(
      'UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3',
      [status, req.admin!.adminId, req.params.id]
    );
    await pool.query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.admin!.adminId, 'resolve_report', 'report', req.params.id, JSON.stringify({ status })]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Admin report update error:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

export default router;
