import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
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
