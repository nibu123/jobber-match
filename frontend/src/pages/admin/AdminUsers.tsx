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