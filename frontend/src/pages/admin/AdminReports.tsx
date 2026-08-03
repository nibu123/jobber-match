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