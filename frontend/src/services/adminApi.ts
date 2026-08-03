import axios from 'axios';

// ADJUST: use the same base URL your regular api.ts / axios instance uses
// e.g. https://jobber-match-production-1e12.up.railway.app
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/api/admin`,
});

// attach admin token (kept separate from the regular user token in localStorage)
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// auto logout on 401
adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminInfo');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export default adminApi;