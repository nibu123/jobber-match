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