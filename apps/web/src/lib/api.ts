import axios from 'axios';
import type { ApiResponse, QuoteRequest } from '@/types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'https://api.bazionweb.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// ─── Request interceptor: attach JWT ────────────────────────────────────────
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('bazionweb_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response interceptor: handle 401 ───────────────────────────────────────
api.interceptors.response.use(
  res => res,
  async error => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      sessionStorage.removeItem('bazionweb_access_token');
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
