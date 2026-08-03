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