cd E:\BuddiesPride\frontend

$content = Get-Content src\App.tsx -Raw

# 1. Add admin imports after CallManager import
$content = $content.Replace(
  'import CallManager from "./components/CallManager";',
  "import CallManager from `"./components/CallManager`";`nimport { AdminAuthProvider } from `"./context/AdminAuthContext`";`nimport AdminLogin from `"./pages/admin/AdminLogin`";`nimport AdminLayout from `"./pages/admin/AdminLayout`";`nimport AdminDashboard from `"./pages/admin/AdminDashboard`";`nimport AdminUsers from `"./pages/admin/AdminUsers`";`nimport AdminReports from `"./pages/admin/AdminReports`";"
)

# 2. Wrap <Routes> opening tag with <AdminAuthProvider>
$content = $content.Replace(
  "      <Routes>",
  "      <AdminAuthProvider>`n      <Routes>"
)

# 3. Insert admin routes before the catch-all "*" route, and close AdminAuthProvider after </Routes>
$content = $content.Replace(
  "      <Route path=`"*`" element={<Navigate to=`"/browse`" replace />} />`n      </Routes>",
  "      <Route path=`"/admin/login`" element={<AdminLogin />} />`n      <Route path=`"/admin`" element={<AdminLayout />}>`n        <Route path=`"dashboard`" element={<AdminDashboard />} />`n        <Route path=`"users`" element={<AdminUsers />} />`n        <Route path=`"reports`" element={<AdminReports />} />`n      </Route>`n      <Route path=`"*`" element={<Navigate to=`"/browse`" replace />} />`n      </Routes>`n      </AdminAuthProvider>"
)

Set-Content -Path src\App.tsx -Value $content -Encoding UTF8

Write-Host "App.tsx updated. Verifying..." -ForegroundColor Cyan
Select-String -Path src\App.tsx -Pattern "AdminAuthProvider|/admin"
