import axios from 'axios';
import type { ApiResponse, QuoteRequest } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { resolveApiV1Base } from '@/lib/api-base';

const api = axios.create({
  baseURL: resolveApiV1Base(),
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

  changePassword: (data: { currentPassword?: string; newPassword: string }) =>
    api.post('/auth/change-password', data).then(r => r.data),
};

// ─── Client portal ───────────────────────────────────────────────────────────
export const portalApi = {
  getMyClient: () => api.get('/clients/me').then(r => r.data),
  getMyProjects: () => api.get('/projects/me').then(r => r.data),
  getMyHosting: () => api.get('/hosting/me').then(r => r.data),
  getMyTickets: () => api.get('/tickets?scope=mine').then(r => r.data),
  getMyInvoices: () => api.get('/invoices?scope=mine').then(r => r.data),
  /** Mints a 5-minute signed PDF download link for an invoice the caller owns. */
  getInvoicePdfLink: (invoiceId: string) =>
    api.get(`/invoices/${invoiceId}/pdf`).then(r => r.data),
  markOnboarded: (completedSteps?: string[]) =>
    api.post('/clients/me/onboard', { completedSteps }).then(r => r.data),
  getMyReports: () => api.get('/reports/me').then(r => r.data),

  signOffProjectTask: (projectId: string, taskId: string) =>
    api.post(`/projects/${projectId}/tasks/${taskId}/sign-off`).then(r => r.data),

  getTicket: (ticketId: string) =>
    api.get(`/tickets/${ticketId}`).then(r => r.data),

  getTicketComments: (ticketId: string) =>
    api.get(`/tickets/${ticketId}/comments`).then(r => r.data),

  createTicket: (data: { subject: string; priority: string; category: string; body: string }) =>
    api.post('/tickets', data).then(r => r.data),

  addTicketComment: (ticketId: string, body: string) =>
    api.post(`/tickets/${ticketId}/comments`, { body }).then(r => r.data),

  listVaultSecrets: (clientId?: string) =>
    api.get('/vault', { params: clientId ? { clientId } : {} }).then(r => r.data),

  createVaultSecret: (data: {
    label: string;
    category?: string;
    username?: string;
    serviceUrl?: string;
    value: string;
    notes?: string;
  }) => api.post('/vault', data).then(r => r.data),

  revealVaultSecret: (secretId: string) =>
    api.post(`/vault/${secretId}/reveal`).then(r => r.data),

  deleteVaultSecret: (secretId: string) =>
    api.delete(`/vault/${secretId}`).then(r => r.data),

  payInvoiceMpesa: (invoiceId: string, data: { mpesaPhoneNumber: string }) =>
    api.post(`/invoices/${invoiceId}/pay/mpesa`, data).then(r => r.data),

  payInvoiceCard: (invoiceId: string, data: { email?: string } = {}) =>
    api.post(`/invoices/${invoiceId}/pay/card`, data).then(r => r.data),

  getNotifications: (params: { read?: boolean; page?: number; limit?: number } = {}) =>
    api.get('/notifications', { params: { limit: 15, ...params } }).then(r => r.data),

  getUnreadNotificationCount: () =>
    api.get('/notifications/unread-count').then(r => r.data),

  markNotificationRead: (id: string) =>
    api.patch(`/notifications/${id}/read`).then(r => r.data),

  markAllNotificationsRead: () =>
    api.patch('/notifications/mark-all-read').then(r => r.data),

  updateClient: (
    id: string,
    data: {
      businessName?: string;
      contactName?: string;
      phone?: string;
      address?: string;
      country?: string;
      taxPin?: string;
    },
  ) => api.patch(`/clients/${id}`, data).then(r => r.data),
};

// ─── Staff (admin/support) ───────────────────────────────────────────────────
export const adminApi = {
  listClients: (params: { q?: string; page?: number; limit?: number } = {}) =>
    api.get('/clients', { params: { limit: 100, ...params } }).then(r => r.data),

  updateClient: (
    id: string,
    data: {
      businessName?: string;
      contactName?: string;
      email?: string;
      phone?: string | null;
      address?: string | null;
      country?: string | null;
      taxPin?: string | null;
      status?: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'TRIAL';
      planTier?: 'STARTER' | 'GROWTH' | 'BUSINESS' | 'ENTERPRISE';
    },
  ) => api.patch(`/clients/${id}`, data).then(r => r.data),

  deleteClient: (id: string) =>
    api.delete(`/clients/${id}`).then(r => r.data),

  listTickets: (params: { status?: string; priority?: string; page?: number; limit?: number } = {}) =>
    api.get('/tickets', { params: { limit: 50, ...params } }).then(r => r.data),

  updateTicket: (id: string, data: { status?: string }) =>
    api.patch(`/tickets/${id}`, data).then(r => r.data),

  listInvoices: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get('/invoices', { params: { limit: 50, ...params } }).then(r => r.data),

  listHosting: () =>
    api.get('/hosting', { params: { limit: 100 } }).then(r => r.data),

  listProjects: (params: { page?: number; limit?: number } = {}) =>
    api.get('/projects', { params: { limit: 50, ...params } }).then(r => r.data),

  getMrr: () => api.get('/reports/mrr').then(r => r.data),

  getUptime: (days = 30) => api.get('/reports/uptime', { params: { days } }).then(r => r.data),

  getSla: () => api.get('/reports/sla').then(r => r.data),

  markInvoicePaid: (id: string) => api.patch(`/invoices/${id}/mark-paid`).then(r => r.data),

  generateInvoice: (data: { clientId: string; subscriptionId?: string; amount: number; notes?: string }) =>
    api.post('/invoices/generate', data).then(r => r.data),

  createClient: (data: { businessName: string; contactName: string; email: string; phone?: string; planId?: string }) =>
    api.post('/clients', data).then(r => r.data),

  createHosting: (data: { clientId: string; domain: string; serverIp?: string; plan?: string }) =>
    api
      .post('/hosting', {
        clientId: data.clientId,
        domain: data.domain,
        server: data.serverIp || 'Oracle Cloud (Frankfurt)',
        plan: data.plan || 'STARTER',
        ipAddress: data.serverIp && /^\d{1,3}(\.\d{1,3}){3}$/.test(data.serverIp) ? data.serverIp : undefined,
      })
      .then(r => r.data),

  updateHosting: (id: string, data: { status?: string; serverIp?: string }) =>
    api.patch(`/hosting/${id}`, data).then(r => r.data),

  getHealth: () => api.get('/health').then(r => r.data),

  // ─── SuperAdmin Diagnostics & Operations Suite ───────────────────────────
  getClusterHealth: () =>
    api.get('/admin/diagnostics/health').then(r => r.data),

  resolveDns: (domain: string) =>
    api.post('/admin/diagnostics/dns-resolve', { domain }).then(r => r.data),

  getWebhookLogs: (limit = 50) =>
    api.get('/admin/diagnostics/webhooks', { params: { limit } }).then(r => r.data),

  replayWebhook: (id: string) =>
    api.post(`/admin/diagnostics/webhooks/${id}/replay`).then(r => r.data),

  reconcilePayments: () =>
    api.post('/admin/diagnostics/reconcile').then(r => r.data),

  impersonateClient: (clientId: string) =>
    api.post('/admin/diagnostics/impersonate', { clientId }).then(r => r.data),

  getClientVault: (clientId: string) =>
    api.get('/vault', { params: { clientId } }).then(r => r.data),

  revealVaultSecret: (secretId: string) =>
    api.post(`/vault/${secretId}/reveal`).then(r => r.data),

  // ─── Manual Client Account Provisioning ──────────────────────────────────
  manualProvisionClient: (data: {
    businessName: string;
    contactName: string;
    email: string;
    phone?: string;
    planId?: string;
    planTier?: string;
    marketCode?: string;
    currency?: string;
    projectTitle?: string;
    country?: string;
  }) => api.post('/clients/manual-provision', data).then(r => r.data),

  resendClientInvite: (id: string) =>
    api.post(`/clients/${id}/resend-invite`).then(r => r.data),

  syncClientOnboarding: (id: string) =>
    api.post(`/clients/${id}/sync-onboarding`).then(r => r.data),

  // ─── One-Click Diagnostic & Remediation Workstation ───────────────────────
  getTroubleshootingOverview: () =>
    api.get('/admin/diagnostics/suite/overview').then(r => r.data),

  getOrphanPayments: () =>
    api.get('/admin/diagnostics/orphan-payments').then(r => r.data),

  remediateOrphanPayment: (data: {
    paymentLogId: string;
    targetInvoiceId?: string;
    targetClientId?: string;
    action: 'LINK_AND_SETTLE' | 'CREDIT_CLIENT';
  }) => api.post('/admin/diagnostics/remediate/orphan-payment', data).then(r => r.data),

  getDnsSslFleet: () =>
    api.get('/admin/diagnostics/dns-ssl/fleet').then(r => r.data),

  remediateDnsSsl: (data: {
    domain: string;
    hostingAccountId?: string;
    action: 'REFRESH_SSL' | 'REISSUE_SSL';
  }) => api.post('/admin/diagnostics/remediate/dns-ssl', data).then(r => r.data),

  getWebhookFailures: (limit = 50) =>
    api.get('/admin/diagnostics/webhooks/failures', { params: { limit } }).then(r => r.data),

  retryWebhooksBatch: (windowHours = 24) =>
    api.post('/admin/diagnostics/remediate/webhooks/retry-all', { windowHours }).then(r => r.data),

  getUnsyncedInvoices: () =>
    api.get('/admin/diagnostics/invoices/unsynced').then(r => r.data),

  remediateInvoiceSync: (data: {
    invoiceId: string;
    action: 'SYNC_FROM_PAYMENTS' | 'RECALCULATE_FROM_ITEMS' | 'MARK_PAID' | 'MARK_OVERDUE';
  }) => api.post('/admin/diagnostics/remediate/invoice-sync', data).then(r => r.data),

  getClientAccessIssues: () =>
    api.get('/admin/diagnostics/clients/access-issues').then(r => r.data),

  remediateClientAccess: (data: {
    clientId: string;
    action: 'UNLOCK_ACCOUNT' | 'GENERATE_RESET_LINK' | 'RESTORE_USER';
  }) => api.post('/admin/diagnostics/remediate/client-access', data).then(r => r.data),

  getSuspendedDomains: () =>
    api.get('/admin/diagnostics/domains/suspended').then(r => r.data),

  remediateDomainState: (data: {
    hostingAccountId: string;
    action: 'UNSUSPEND' | 'NORMALIZE_STATUS';
  }) => api.post('/admin/diagnostics/remediate/domain-state', data).then(r => r.data),

  // ─── Proactive Intelligence & Anomaly Remediation ─────────────────────────
  getProactiveScan: () =>
    api.get('/admin/diagnostics/proactive-scan').then(r => r.data),

  remediateProactiveAnomaly: (data: {
    anomalyId?: string;
    rule?: string;
    remediationAction: string;
    remediationPayload?: Record<string, any>;
  }) => api.post('/admin/diagnostics/proactive-scan/remediate', data).then(r => r.data),

  dispatchAdminLinkEmail: async (data: {
    to: string;
    url: string;
    clientName?: string;
    type?: 'claim' | 'magic';
  }) => {
    const res = await fetch('/api/admin/dispatch-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

export default api;

