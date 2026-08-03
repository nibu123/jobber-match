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