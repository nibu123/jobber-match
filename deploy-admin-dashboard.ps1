<#
  Admin Dashboard auto-deploy script for BuddiesPride
  Sabhi 16 files ko exact target paths pe copy karta hai (root = current directory, E:\BuddiesPride se chalao)
  .NET Directory.CreateDirectory + File.WriteAllText use karta hai -- New-Item/Set-Content ke race/cache issue se bachne ke liye
  Run: cd E:\BuddiesPride ; powershell -ExecutionPolicy Bypass -File .\deploy-admin-dashboard.ps1
#>

$root = (Get-Location).Path
Write-Host "Deploying admin dashboard files under: $root" -ForegroundColor Cyan

function Write-ProjectFile {
    param([string]$RelPath, [string]$Content)
    $full = Join-Path $root $RelPath
    $dir = Split-Path $full -Parent
    [System.IO.Directory]::CreateDirectory($dir) | Out-Null
    [System.IO.File]::WriteAllText($full, $Content)
    if (Test-Path $full) {
        Write-Host "  written: $RelPath" -ForegroundColor Green
    } else {
        Write-Host "  FAILED : $RelPath" -ForegroundColor Red
    }
}

# ---- backend\src\db\migrations\migration_005_admin_dashboard.sql ----
$content_migration_005_admin_dashboard_sql = @'
-- Migration 005: Admin Dashboard
-- Run this in Supabase SQL editor (same way you ran migration_003)

-- 1. Admin users table (separate from regular users table)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- 'super_admin' | 'admin' | 'moderator'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add moderation columns to existing users table (safe, no-op if already present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

-- 3. Reports table (user safety reports) -- created IF NOT EXISTS in case Safety.tsx already uses one
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'reviewed' | 'action_taken' | 'dismissed'
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id);

-- 4. Admin audit log (tracks every admin action -- important for accountability)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id),
  action TEXT NOT NULL, -- e.g. 'ban_user', 'verify_user', 'resolve_report'
  target_type TEXT,     -- e.g. 'user', 'report'
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);
'@
Write-ProjectFile -RelPath "backend\src\db\migrations\migration_005_admin_dashboard.sql" -Content $content_migration_005_admin_dashboard_sql

# ---- backend\src\middleware\adminAuth.ts ----
$content_adminAuth_ts = @'
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
'@
Write-ProjectFile -RelPath "backend\src\middleware\adminAuth.ts" -Content $content_adminAuth_ts

# ---- backend\src\routes\admin\index.ts ----
$content_index_ts = @'
import { Router } from 'express';
import authRoutes from './auth';
import usersRoutes from './users';
import reportsRoutes from './reports';
import analyticsRoutes from './analytics';

const router = Router();

router.use('/auth', authRoutes);         // /api/admin/auth/login, /api/admin/auth/me
router.use('/users', usersRoutes);       // /api/admin/users, /api/admin/users/:id/ban etc
router.use('/reports', reportsRoutes);   // /api/admin/reports
router.use('/analytics', analyticsRoutes); // /api/admin/analytics/overview

export default router;

/*
  WIRE THIS UP in your main server file (e.g. backend/src/index.ts or server.ts),
  wherever you currently mount other route groups like:
    app.use('/api/communities', communitiesRoutes);
    app.use('/api/notifications', notificationsRoutes);

  Add:
    import adminRoutes from './routes/admin';
    app.use('/api/admin', adminRoutes);
*/
'@
Write-ProjectFile -RelPath "backend\src\routes\admin\index.ts" -Content $content_index_ts

# ---- backend\src\routes\admin\auth.ts ----
$content_auth_ts = @'
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../../db'; // ADJUST: point this to your existing db pool (same one auth.ts / communities.ts use)
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
'@
Write-ProjectFile -RelPath "backend\src\routes\admin\auth.ts" -Content $content_auth_ts

# ---- backend\src\routes\admin\users.ts ----
$content_users_ts = @'
import { Router, Response } from 'express';
import { pool } from '../../db'; // ADJUST to your db module
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
'@
Write-ProjectFile -RelPath "backend\src\routes\admin\users.ts" -Content $content_users_ts

# ---- backend\src\routes\admin\reports.ts ----
$content_reports_ts = @'
import { Router, Response } from 'express';
import { pool } from '../../db'; // ADJUST to your db module
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
       JOIN users reported ON reported.id = r.reported_user_id
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
'@
Write-ProjectFile -RelPath "backend\src\routes\admin\reports.ts" -Content $content_reports_ts

# ---- backend\src\routes\admin\analytics.ts ----
$content_analytics_ts = @'
import { Router, Response } from 'express';
import { pool } from '../../db'; // ADJUST to your db module
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
'@
Write-ProjectFile -RelPath "backend\src\routes\admin\analytics.ts" -Content $content_analytics_ts

# ---- backend\scripts\create-admin.ts ----
$content_create_admin_ts = @'
/**
 * One-time script to create the first super_admin.
 * Run locally with: npx ts-node scripts/create-admin.ts
 *
 * Needs DATABASE_URL env var pointing to your Supabase Postgres instance
 * (same one your backend uses -- copy from Railway env vars).
 */
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

async function main() {
  const email = (await ask('Admin email: ')).trim().toLowerCase();
  const name = (await ask('Admin name: ')).trim();
  const password = await ask('Admin password: ');
  rl.close();

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO admin_users (email, password_hash, name, role) VALUES ($1, $2, $3, 'super_admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3`,
    [email, passwordHash, name]
  );

  console.log(`✅ Admin created/updated: ${email}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
'@
Write-ProjectFile -RelPath "backend\scripts\create-admin.ts" -Content $content_create_admin_ts

# ---- frontend\src\services\adminApi.ts ----
$content_adminApi_ts = @'
import axios from 'axios';

// ADJUST: use the same base URL your regular api.ts / axios instance uses
// e.g. https://jobber-match-production-1e12.up.railway.app
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/api/admin`,
});

// attach admin token (kept separate from the regular user token in localStorage)
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// auto logout on 401
adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminInfo');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export default adminApi;
'@
Write-ProjectFile -RelPath "frontend\src\services\adminApi.ts" -Content $content_adminApi_ts

# ---- frontend\src\context\AdminAuthContext.tsx ----
$content_AdminAuthContext_tsx = @'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import adminApi from '../services/adminApi';

interface AdminInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AdminAuthContextType {
  admin: AdminInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setLoading(false);
      return;
    }
    adminApi
      .get('/auth/me')
      .then((res) => setAdmin(res.data))
      .catch(() => {
        localStorage.removeItem('adminToken');
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await adminApi.post('/auth/login', { email, password });
    localStorage.setItem('adminToken', res.data.token);
    setAdmin(res.data.admin);
  }

  function logout() {
    localStorage.removeItem('adminToken');
    setAdmin(null);
    window.location.href = '/admin/login';
  }

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
'@
Write-ProjectFile -RelPath "frontend\src\context\AdminAuthContext.tsx" -Content $content_AdminAuthContext_tsx

# ---- frontend\src\pages\admin\AdminLogin.tsx ----
$content_AdminLogin_tsx = @'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/admin/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f14' }}>
      <form onSubmit={handleSubmit} style={{ width: 340, padding: 32, background: '#1a1a22', borderRadius: 12 }}>
        <h2 style={{ color: '#fff', marginBottom: 24 }}>Admin Login</h2>
        {error && <p style={{ color: '#ff6b6b', marginBottom: 16 }}>{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: 10, marginBottom: 12, borderRadius: 6, border: 'none' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: 10, marginBottom: 20, borderRadius: 6, border: 'none' }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', background: '#e94057', color: '#fff', fontWeight: 600 }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
'@
Write-ProjectFile -RelPath "frontend\src\pages\admin\AdminLogin.tsx" -Content $content_AdminLogin_tsx

# ---- frontend\src\pages\admin\AdminLayout.tsx ----
$content_AdminLayout_tsx = @'
import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminLayout() {
  const { admin, loading, logout } = useAdminAuth();

  if (loading) return <div style={{ color: '#fff', padding: 40 }}>Loading...</div>;
  if (!admin) return <Navigate to="/admin/login" replace />;

  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'block',
    padding: '10px 16px',
    borderRadius: 8,
    marginBottom: 4,
    color: isActive ? '#fff' : '#aaa',
    background: isActive ? '#e94057' : 'transparent',
    textDecoration: 'none',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f0f14' }}>
      <aside style={{ width: 220, padding: 20, borderRight: '1px solid #222' }}>
        <h3 style={{ color: '#fff', marginBottom: 24 }}>BuddiesPride Admin</h3>
        <nav>
          <NavLink to="/admin/dashboard" style={linkStyle}>Dashboard</NavLink>
          <NavLink to="/admin/users" style={linkStyle}>Users</NavLink>
          <NavLink to="/admin/reports" style={linkStyle}>Reports</NavLink>
        </nav>
        <div style={{ marginTop: 40, color: '#666', fontSize: 13 }}>
          Logged in as<br />
          <span style={{ color: '#fff' }}>{admin.name}</span> ({admin.role})
        </div>
        <button
          onClick={logout}
          style={{ marginTop: 16, padding: '8px 12px', background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: 6, cursor: 'pointer' }}
        >
          Logout
        </button>
      </aside>
      <main style={{ flex: 1, padding: 32 }}>
        <Outlet />
      </main>
    </div>
  );
}
'@
Write-ProjectFile -RelPath "frontend\src\pages\admin\AdminLayout.tsx" -Content $content_AdminLayout_tsx

# ---- frontend\src\pages\admin\AdminDashboard.tsx ----
$content_AdminDashboard_tsx = @'
import { useEffect, useState } from 'react';
import adminApi from '../../services/adminApi';

interface Overview {
  totalUsers: number;
  newSignupsToday: number;
  newSignupsThisWeek: number;
  bannedUsers: number;
  verifiedUsers: number;
  pendingReports: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Overview | null>(null);

  useEffect(() => {
    adminApi.get('/analytics/overview').then((res) => setStats(res.data));
  }, []);

  if (!stats) return <p style={{ color: '#aaa' }}>Loading...</p>;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers },
    { label: 'New Today', value: stats.newSignupsToday },
    { label: 'New This Week', value: stats.newSignupsThisWeek },
    { label: 'Verified Users', value: stats.verifiedUsers },
    { label: 'Banned Users', value: stats.bannedUsers },
    { label: 'Pending Reports', value: stats.pendingReports, highlight: stats.pendingReports > 0 },
  ];

  return (
    <div>
      <h2 style={{ color: '#fff', marginBottom: 24 }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              background: c.highlight ? '#3a1a1f' : '#1a1a22',
              border: c.highlight ? '1px solid #e94057' : '1px solid #222',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ color: '#888', fontSize: 13 }}>{c.label}</div>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 8 }}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
'@
Write-ProjectFile -RelPath "frontend\src\pages\admin\AdminDashboard.tsx" -Content $content_AdminDashboard_tsx

# ---- frontend\src\pages\admin\AdminUsers.tsx ----
$content_AdminUsers_tsx = @'
import { useEffect, useState } from 'react';
import adminApi from '../../services/adminApi';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_banned: boolean;
  is_verified: boolean;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  function load() {
    adminApi.get('/users', { params: { search, filter, page, limit: 20 } }).then((res) => {
      setUsers(res.data.users);
      setTotalPages(res.data.totalPages);
    });
  }

  useEffect(() => { load(); }, [page, filter]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function toggleBan(u: UserRow) {
    const reason = u.is_banned ? undefined : prompt('Ban reason:') || 'Violation of terms';
    await adminApi.patch(`/users/${u.id}/ban`, { banned: !u.is_banned, reason });
    load();
  }

  async function toggleVerify(u: UserRow) {
    await adminApi.patch(`/users/${u.id}/verify`, { verified: !u.is_verified });
    load();
  }

  return (
    <div>
      <h2 style={{ color: '#fff', marginBottom: 24 }}>Users</h2>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone..."
          style={{ padding: 8, borderRadius: 6, border: '1px solid #333', background: '#1a1a22', color: '#fff', flex: 1 }}
        />
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} style={{ padding: 8, borderRadius: 6 }}>
          <option value="all">All</option>
          <option value="banned">Banned</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
        <button type="submit" style={{ padding: '8px 16px', borderRadius: 6, background: '#e94057', color: '#fff', border: 'none' }}>Search</button>
      </form>

      <table style={{ width: '100%', color: '#ddd', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Email</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Joined</th>
            <th style={{ padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: 8 }}>{u.name}</td>
              <td style={{ padding: 8 }}>{u.email}</td>
              <td style={{ padding: 8 }}>
                {u.is_banned && <span style={{ color: '#e94057' }}>Banned </span>}
                {u.is_verified && <span style={{ color: '#4caf50' }}>Verified</span>}
              </td>
              <td style={{ padding: 8 }}>{new Date(u.created_at).toLocaleDateString()}</td>
              <td style={{ padding: 8, display: 'flex', gap: 8 }}>
                <button onClick={() => toggleBan(u)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: u.is_banned ? '#4caf50' : '#e94057', color: '#fff' }}>
                  {u.is_banned ? 'Unban' : 'Ban'}
                </button>
                <button onClick={() => toggleVerify(u)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#333', color: '#fff' }}>
                  {u.is_verified ? 'Unverify' : 'Verify'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, color: '#aaa' }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span>Page {page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
'@
Write-ProjectFile -RelPath "frontend\src\pages\admin\AdminUsers.tsx" -Content $content_AdminUsers_tsx

# ---- frontend\src\pages\admin\AdminReports.tsx ----
$content_AdminReports_tsx = @'
import { useEffect, useState } from 'react';
import adminApi from '../../services/adminApi';

interface ReportRow {
  id: string;
  reason: string;
  description: string;
  status: string;
  created_at: string;
  reporter_name: string;
  reporter_email: string;
  reported_user_id: string;
  reported_user_name: string;
  reported_user_email: string;
}

export default function AdminReports() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [status, setStatus] = useState('pending');

  function load() {
    adminApi.get('/reports', { params: { status, limit: 50 } }).then((res) => setReports(res.data.reports));
  }

  useEffect(() => { load(); }, [status]);

  async function resolve(id: string, newStatus: string) {
    await adminApi.patch(`/reports/${id}`, { status: newStatus });
    load();
  }

  return (
    <div>
      <h2 style={{ color: '#fff', marginBottom: 24 }}>Reports</h2>

      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: 8, borderRadius: 6, marginBottom: 16 }}>
        <option value="pending">Pending</option>
        <option value="reviewed">Reviewed</option>
        <option value="action_taken">Action Taken</option>
        <option value="dismissed">Dismissed</option>
      </select>

      {reports.length === 0 && <p style={{ color: '#666' }}>No reports here.</p>}

      {reports.map((r) => (
        <div key={r.id} style={{ background: '#1a1a22', border: '1px solid #222', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ color: '#fff', fontWeight: 600 }}>{r.reason}</div>
          <div style={{ color: '#aaa', margin: '6px 0' }}>{r.description}</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            Reported: {r.reported_user_name} ({r.reported_user_email}) &nbsp;|&nbsp;
            By: {r.reporter_name} ({r.reporter_email}) &nbsp;|&nbsp;
            {new Date(r.created_at).toLocaleString()}
          </div>
          {status === 'pending' && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button onClick={() => resolve(r.id, 'action_taken')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#e94057', color: '#fff' }}>Take Action</button>
              <button onClick={() => resolve(r.id, 'dismissed')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#333', color: '#fff' }}>Dismiss</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
'@
Write-ProjectFile -RelPath "frontend\src\pages\admin\AdminReports.tsx" -Content $content_AdminReports_tsx

# ---- README-ADMIN-SETUP.md ----
$content_README_ADMIN_SETUP_md = @'
# Admin Dashboard — Setup Steps

## 1. Files copy karo apne project mein

```
backend/src/db/migrations/migration_005_admin_dashboard.sql  -> E:\BuddiesPride\backend\src\db\migrations\
backend/src/middleware/adminAuth.ts                            -> E:\BuddiesPride\backend\src\middleware\
backend/src/routes/admin\*.ts                                  -> E:\BuddiesPride\backend\src\routes\admin\
backend/scripts/create-admin.ts                                -> E:\BuddiesPride\backend\scripts\

frontend/src/services/adminApi.ts                              -> E:\BuddiesPride\frontend\src\services\
frontend/src/context/AdminAuthContext.tsx                      -> E:\BuddiesPride\frontend\src\context\
frontend/src/pages/admin\*.tsx                                 -> E:\BuddiesPride\frontend\src\pages\admin\
```

## 2. IMPORTANT: db import path fix karo

Har backend file mein ye line hai:
```ts
import { pool } from '../../db';
```
Isko apne existing db module ke path se replace karo — jo path `communities.ts` ya `notifications.ts` use karta hai wahi use karo. (`grep -r "pool" backend/src/routes/communities.ts` chala ke check kar lena.)

## 3. Migration run karo (Supabase SQL editor mein paste karo)

`migration_005_admin_dashboard.sql` ka pura content copy-paste karke run karo — jaise `migration_003` run kiya tha.

## 4. Railway env var add karo

Railway → Variables → naya add karo:
```
ADMIN_JWT_SECRET=<ek strong random string, alag from JWT_SECRET>
```

## 5. Backend deps check karo

Agar already nahi hain:
```powershell
cd E:\BuddiesPride\backend
npm install bcryptjs jsonwebtoken pg
npm install -D @types/bcryptjs @types/jsonwebtoken @types/pg
```

## 6. Main server file mein admin routes mount karo

Jahan `app.use('/api/communities', ...)` jaisi lines hain, wahin add karo:
```ts
import adminRoutes from './routes/admin';
app.use('/api/admin', adminRoutes);
```

## 7. Pehla admin user banao

Local machine se (DATABASE_URL env var set karke — Railway se copy kar lo):
```powershell
cd E:\BuddiesPride\backend
$env:DATABASE_URL="<railway ka postgres connection string>"
npx ts-node scripts/create-admin.ts
```
Email/name/password poochega — enter kar do. Isse `super_admin` role wala pehla account ban jayega.

## 8. Frontend App.tsx mein routes add karo

```tsx
import { AdminAuthProvider } from './context/AdminAuthContext';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminReports from './pages/admin/AdminReports';

// Wrap your <Routes> (or the relevant part) with:
<AdminAuthProvider>
  <Routes>
    {/* ...existing routes... */}
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route path="/admin" element={<AdminLayout />}>
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="reports" element={<AdminReports />} />
    </Route>
  </Routes>
</AdminAuthProvider>
```

## 9. Frontend env var

`.env` (frontend) mein confirm karo ye hai:
```
VITE_API_URL=https://jobber-match-production-1e12.up.railway.app
```

## 10. Test flow

1. Backend push + Railway redeploy
2. Frontend push + Vercel redeploy (ya `vercel --prod`)
3. `buddiespride.com/admin/login` pe jao, step 7 wala email/password se login karo
4. Dashboard stats, users list, reports — sab dikhna chahiye

---

**Note on scope:** Ye scaffold List 1-8 (user management + safety/reports + analytics) cover karta hai. Agar aage chahiye:
- User detail modal (matches, reports against them, activity log)
- Revenue/subscription analytics tab
- Bulk actions (multi-select ban)
- Audit log viewer (`admin_audit_log` table already ban raha hai data — bas UI baaki hai)

Bata dena agla priority kya hai.
'@
Write-ProjectFile -RelPath "README-ADMIN-SETUP.md" -Content $content_README_ADMIN_SETUP_md

Write-Host ""
Write-Host "Sab 16 files copy ho gaye (upar FAILED kahin na dikhe, wahi confirm hai)." -ForegroundColor Cyan
Write-Host "Ab README-ADMIN-SETUP.md padho: db import path fix, migration run, env var, deps install, route mount, create-admin.ts, App.tsx wiring." -ForegroundColor Yellow