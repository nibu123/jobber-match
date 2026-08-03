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