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

interface UserDetail extends UserRow {
  ban_reason: string | null;
  banned_at: string | null;
  [key: string]: any;
}

interface LoginRecord {
  id: string;
  ip_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  created_at: string;
}

const HIDDEN_DETAIL_FIELDS = new Set([
  'id', 'name', 'email', 'phone', 'is_banned', 'ban_reason',
  'banned_at', 'is_verified', 'created_at', 'user_id',
]);

function formatFieldLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

function formatLocation(r: LoginRecord) {
  const parts = [r.city, r.region, r.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  async function toggleBan(u: UserRow | UserDetail, e?: React.MouseEvent) {
    e?.stopPropagation();
    const reason = u.is_banned ? undefined : prompt('Ban reason:') || 'Violation of terms';
    setActionLoading(true);
    try {
      await adminApi.patch(`/users/${u.id}/ban`, { banned: !u.is_banned, reason });
      load();
      if (selectedUser && selectedUser.id === u.id) await openDetail(u.id);
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleVerify(u: UserRow | UserDetail, e?: React.MouseEvent) {
    e?.stopPropagation();
    setActionLoading(true);
    try {
      await adminApi.patch(`/users/${u.id}/verify`, { verified: !u.is_verified });
      load();
      if (selectedUser && selectedUser.id === u.id) await openDetail(u.id);
    } finally {
      setActionLoading(false);
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetailError('');
    setSelectedUser(null);
    setLoginHistory([]);
    try {
      const res = await adminApi.get(`/users/${id}`);
      setSelectedUser(res.data);
    } catch (err: any) {
      setDetailError(err?.response?.data?.error || 'Failed to load user detail');
    } finally {
      setDetailLoading(false);
    }

    setHistoryLoading(true);
    try {
      const histRes = await adminApi.get(`/users/${id}/login-history`);
      setLoginHistory(histRes.data.history || []);
    } catch {
      setLoginHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeModal() {
    setSelectedUser(null);
    setDetailError('');
    setLoginHistory([]);
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
            <tr
              key={u.id}
              style={{ borderBottom: '1px solid #222', cursor: 'pointer' }}
              onClick={() => openDetail(u.id)}
            >
              <td style={{ padding: 8 }}>{u.name}</td>
              <td style={{ padding: 8 }}>{u.email}</td>
              <td style={{ padding: 8 }}>
                {u.is_banned && <span style={{ color: '#e94057' }}>Banned </span>}
                {u.is_verified && <span style={{ color: '#4caf50' }}>Verified</span>}
              </td>
              <td style={{ padding: 8 }}>{new Date(u.created_at).toLocaleDateString()}</td>
              <td style={{ padding: 8, display: 'flex', gap: 8 }}>
                <button onClick={(e) => toggleBan(u, e)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: u.is_banned ? '#4caf50' : '#e94057', color: '#fff' }}>
                  {u.is_banned ? 'Unban' : 'Ban'}
                </button>
                <button onClick={(e) => toggleVerify(u, e)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#333', color: '#fff' }}>
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

      {(detailLoading || selectedUser || detailError) && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a22', color: '#fff', borderRadius: 10, padding: 24,
              width: '90%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', position: 'relative',
              border: '1px solid #333',
            }}
          >
            <button
              onClick={closeModal}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#aaa', fontSize: 18, cursor: 'pointer' }}
            >
              ✕
            </button>

            {detailLoading && <div style={{ color: '#aaa', textAlign: 'center', padding: 24 }}>Loading profile...</div>}
            {detailError && <div style={{ color: '#e94057', marginBottom: 12 }}>{detailError}</div>}

            {selectedUser && !detailLoading && (
              <>
                <h3 style={{ marginBottom: 4 }}>{selectedUser.name || 'Unnamed User'}</h3>
                <p style={{ color: '#aaa', marginBottom: 4 }}>{selectedUser.email}</p>
                {selectedUser.phone && <p style={{ color: '#aaa', marginBottom: 12 }}>{selectedUser.phone}</p>}

                <div style={{ marginBottom: 16 }}>
                  {selectedUser.is_banned && <span style={{ color: '#e94057', marginRight: 8 }}>Banned</span>}
                  {selectedUser.is_verified && <span style={{ color: '#4caf50' }}>Verified</span>}
                </div>

                <h4 style={{ fontSize: 13, color: '#888', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1px solid #333', paddingBottom: 4 }}>
                  Account Info
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>Joined</div>
                    <div>{new Date(selectedUser.created_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>User ID</div>
                    <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{selectedUser.id}</div>
                  </div>
                  {selectedUser.is_banned && (
                    <>
                      <div>
                        <div style={{ fontSize: 11, color: '#888' }}>Ban Reason</div>
                        <div>{formatValue(selectedUser.ban_reason)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#888' }}>Banned At</div>
                        <div>{selectedUser.banned_at ? new Date(selectedUser.banned_at).toLocaleString() : '—'}</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Login History */}
                <h4 style={{ fontSize: 13, color: '#888', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1px solid #333', paddingBottom: 4 }}>
                  Login History (IP, Device, Location)
                </h4>
                <div style={{ marginBottom: 20 }}>
                  {historyLoading && <div style={{ color: '#888', fontSize: 13 }}>Loading login history...</div>}
                  {!historyLoading && loginHistory.length === 0 && (
                    <div style={{ color: '#888', fontSize: 13 }}>No login records yet.</div>
                  )}
                  {!historyLoading && loginHistory.length > 0 && (
                    <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #2a2a33', borderRadius: 6 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#20202b' }}>
                          <tr style={{ textAlign: 'left' }}>
                            <th style={{ padding: '6px 8px' }}>When</th>
                            <th style={{ padding: '6px 8px' }}>IP</th>
                            <th style={{ padding: '6px 8px' }}>Location</th>
                            <th style={{ padding: '6px 8px' }}>Device</th>
                            <th style={{ padding: '6px 8px' }}>Browser / OS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loginHistory.map((r, idx) => (
                            <tr key={r.id} style={{ borderTop: '1px solid #2a2a33', background: idx === 0 ? '#1f2a22' : 'transparent' }}>
                              <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                                {new Date(r.created_at).toLocaleString()}
                                {idx === 0 && <span style={{ color: '#4caf50', marginLeft: 6 }}>● latest</span>}
                              </td>
                              <td style={{ padding: '6px 8px' }}>{r.ip_address || '—'}</td>
                              <td style={{ padding: '6px 8px' }}>{formatLocation(r)}</td>
                              <td style={{ padding: '6px 8px' }}>{r.device_type || '—'}</td>
                              <td style={{ padding: '6px 8px' }}>{r.browser || '—'} / {r.os || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <h4 style={{ fontSize: 13, color: '#888', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1px solid #333', paddingBottom: 4 }}>
                  Profile Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {Object.entries(selectedUser)
                    .filter(([key]) => !HIDDEN_DETAIL_FIELDS.has(key))
                    .map(([key, value]) => (
                      <div key={key}>
                        <div style={{ fontSize: 11, color: '#888' }}>{formatFieldLabel(key)}</div>
                        <div>{formatValue(value)}</div>
                      </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    disabled={actionLoading}
                    onClick={(e) => toggleBan(selectedUser, e)}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: selectedUser.is_banned ? '#4caf50' : '#e94057', color: '#fff' }}
                  >
                    {selectedUser.is_banned ? 'Unban User' : 'Ban User'}
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={(e) => toggleVerify(selectedUser, e)}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#333', color: '#fff' }}
                  >
                    {selectedUser.is_verified ? 'Unverify User' : 'Verify User'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}