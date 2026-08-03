# Admin Dashboard â€” Setup Steps

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
Isko apne existing db module ke path se replace karo â€” jo path `communities.ts` ya `notifications.ts` use karta hai wahi use karo. (`grep -r "pool" backend/src/routes/communities.ts` chala ke check kar lena.)

## 3. Migration run karo (Supabase SQL editor mein paste karo)

`migration_005_admin_dashboard.sql` ka pura content copy-paste karke run karo â€” jaise `migration_003` run kiya tha.

## 4. Railway env var add karo

Railway â†’ Variables â†’ naya add karo:
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

Local machine se (DATABASE_URL env var set karke â€” Railway se copy kar lo):
```powershell
cd E:\BuddiesPride\backend
$env:DATABASE_URL="<railway ka postgres connection string>"
npx ts-node scripts/create-admin.ts
```
Email/name/password poochega â€” enter kar do. Isse `super_admin` role wala pehla account ban jayega.

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
4. Dashboard stats, users list, reports â€” sab dikhna chahiye

---

**Note on scope:** Ye scaffold List 1-8 (user management + safety/reports + analytics) cover karta hai. Agar aage chahiye:
- User detail modal (matches, reports against them, activity log)
- Revenue/subscription analytics tab
- Bulk actions (multi-select ban)
- Audit log viewer (`admin_audit_log` table already ban raha hai data â€” bas UI baaki hai)

Bata dena agla priority kya hai.