import axios from 'axios';
import type { ApiResponse, QuoteRequest } from '@/types';
import { useAuthStore } from '@/store/auth.store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'https://api.bazionweb.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// ─── Request interceptor: attach JWT from the auth store ─────────────────────
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: refresh once, then sign out ──────────────────────
function onProtectedRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  if (path.startsWith('/portal/login')) return false;
  return /^\/(portal|admin)(\/|$)/.test(path);
}

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status !== 401 || typeof window === 'undefined' || !original) {
      return Promise.reject(error);
    }

    // Single silent refresh attempt (no interceptor recursion — plain axios).
    if (!original._retry && onProtectedRoute()) {
      original._retry = true;
      try {
        const { user, refreshToken, setSession } = useAuthStore.getState();
        if (user && refreshToken) {
          const res = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: rt, expiresIn } = res.data.data;
          setSession(user, accessToken, rt, expiresIn);
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        }
      } catch {
        // Fall through to sign-out below.
      }
    }

    useAuthStore.getState().clearSession();
    if (onProtectedRoute()) {
      window.location.href = '/portal/login';
    }
    return Promise.reject(error);
  },
);

// ─── Quote endpoints (public) ────────────────────────────────────────────────
export const quoteApi = {
  /**
   * Submit a quote request / lead capture form
   */
  submit: (data: QuoteRequest): Promise<ApiResponse> =>
    api.post('/quotes/submit', data).then(r => r.data),

  /**
   * Calculate an instant quote based on requirements
   */
  calculate: (data: { pages: number; hasCms: boolean; needsMigration: boolean; tier: string }) =>
    api.post('/quotes/calculate', data).then(r => r.data),
};

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),

  logout: () => api.post('/auth/logout').then(r => r.data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then(r => r.data),
};

// ─── Client portal ───────────────────────────────────────────────────────────
export const portalApi = {
  getMyClient: () => api.get('/clients/me').then(r => r.data),
  getMyHosting: () => api.get('/hosting/me').then(r => r.data),
  getMyTickets: () => api.get('/tickets?scope=mine').then(r => r.data),
  getMyInvoices: () => api.get('/invoices?scope=mine').then(r => r.data),
  getMyReports: () => api.get('/reports/me').then(r => r.data),

  createTicket: (data: { subject: string; priority: string; category: string; body: string }) =>
    api.post('/tickets', data).then(r => r.data),
};

export default api;
