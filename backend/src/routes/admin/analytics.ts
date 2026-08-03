import { Router, Response } from 'express';
import { pool } from '../../db/pool'; // ADJUST to your db module
import { adminAuth, AdminRequest } from '../../middleware/adminAuth';

const router = Router();
router.use(adminAuth);

// GET /api/admin/analytics/overview
router.get('/overview', async (req: AdminRequest, res: Response) => {
  try {
    const [totalUsers, newToday, newWeek, banned, pendingReports, verified] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= now() - interval '7 days'"),
      pool.query('SELECT COUNT(*) FROM users WHERE is_banned = true'),
      pool.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'"),
      pool.query('SELECT COUNT(*) FROM users WHERE is_verified = true'),
    ]);

    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      newSignupsToday: parseInt(newToday.rows[0].count),
      newSignupsThisWeek: parseInt(newWeek.rows[0].count),
      bannedUsers: parseInt(banned.rows[0].count),
      verifiedUsers: parseInt(verified.rows[0].count),
      pendingReports: parseInt(pendingReports.rows[0].count),
    });
  } catch (err) {
    console.error('Admin analytics overview error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/analytics/signups-trend  -> last 30 days, one row per day
router.get('/signups-trend', async (req: AdminRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS date,
             COALESCE(u.count, 0) AS signups
      FROM generate_series(CURRENT_DATE - interval '29 days', CURRENT_DATE, interval '1 day') d
      LEFT JOIN (
        SELECT created_at::date AS day, COUNT(*) AS count
        FROM users
        WHERE created_at >= CURRENT_DATE - interval '29 days'
        GROUP BY created_at::date
      ) u ON u.day = d::date
      ORDER BY d ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin signups trend error:', err);
    res.status(500).json({ error: 'Failed to fetch signup trend' });
  }
});

export default router;
