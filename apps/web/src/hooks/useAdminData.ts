'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { ApiClient, ApiHostingAccount, ApiTicket } from './usePortalData';

// ─── Shapes ─────────────────────────────────────────────────────────────────

export interface AdminMrrTier {
  count: number;
  mrr: number;
  clients: string[];
}

export interface AdminMrr {
  period: string;
  totalMrr: number;
  totalClients: number;
  arr: number;
  byTier: Record<string, AdminMrrTier>;
}

export interface UptimeSite {
  domain: string;
  client: string;
  plan: string;
  status: string;
  sslExpiry: string | null;
  sslDaysLeft: number | null;
  sslAlert: boolean;
  backups: { total: number; failed: number; successRate: number };
}

export interface AdminUptime {
  period: string;
  totalSites: number;
  sslAlerts: number;
  summary: UptimeSite[];
}

export interface AdminSla {
  period: string;
  totalTickets: number;
  slaBreaches: number;
  complianceRate: number;
  resolvedTickets: number;
  resolutionRate: number;
  avgResolutionMinutes: number;
}

const EMPTY_ROLES: readonly string[] = [];

function useToken() {
  return useAuthStore(s => s.accessToken);
}

export function useRoles(): readonly string[] {
  return useAuthStore(s => s.user?.roles) ?? EMPTY_ROLES;
}

const opts = { staleTime: 30_000, retry: 1 as const, refetchOnWindowFocus: false };

/** MRR + SLA endpoints are ADMIN/SUPER_ADMIN-only; uptime allows SUPPORT. */
export function useCanSeeBilling(): boolean {
  return useAuthStore(s => {
    const roles = s.user?.roles;
    if (!roles) return false;
    return roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  });
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useAdminClients() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'clients'],
    queryFn: () =>
      adminApi.listClients().then(r => ({
        items: (r.data ?? []) as (ApiClient & {
          plan?: { name: string; tier: string; priceMonthly: string | number } | null;
          subscriptions?: { renewalDate: string | null }[];
          _count?: { tickets: number };
        })[],
        total: (r.meta?.total as number) ?? 0,
      })),
    enabled: !!token,
    ...opts,
  });
}

export function useAdminTickets() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'tickets'],
    queryFn: () =>
      adminApi.listTickets().then(r => ({
        items: (r.data ?? []) as ApiTicket[],
        total: (r.meta?.total as number) ?? 0,
      })),
    enabled: !!token,
    ...opts,
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateTicket(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
    },
  });
}

export function useAdminHosting() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'hosting'],
    queryFn: () =>
      adminApi.listHosting().then(r => ({
        items: (r.data ?? []) as ApiHostingAccount[],
        total: (r.meta?.total as number) ?? 0,
      })),
    enabled: !!token,
    ...opts,
  });
}

export function useAdminInvoices() {
  const token = useToken();
  const allowed = useCanSeeBilling();
  return useQuery({
    queryKey: ['admin', 'invoices'],
    queryFn: () =>
      adminApi.listInvoices().then(r => ({
        items: (r.data ?? []) as {
          id: string;
          invoiceNumber: string;
          amount: string | number;
          currency: string;
          status: string;
        }[],
        total: (r.meta?.total as number) ?? 0,
      })),
    enabled: !!token && allowed,
    ...opts,
  });
}

export function useMrr() {
  const token = useToken();
  const allowed = useCanSeeBilling();
  return useQuery({
    queryKey: ['admin', 'mrr'],
    queryFn: () => adminApi.getMrr().then(r => r.data as AdminMrr),
    enabled: !!token && allowed,
    ...opts,
  });
}

export function useUptime(days = 30) {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'uptime', days],
    queryFn: () => adminApi.getUptime(days).then(r => r.data as AdminUptime),
    enabled: !!token,
    ...opts,
  });
}

export function useSla() {
  const token = useToken();
  const allowed = useCanSeeBilling();
  return useQuery({
    queryKey: ['admin', 'sla'],
    queryFn: () => adminApi.getSla().then(r => r.data as AdminSla),
    enabled: !!token && allowed,
    ...opts,
  });
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.markInvoicePaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'mrr'] });
    },
  });
}

export function useUpdateHosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; serverIp?: string } }) =>
      adminApi.updateHosting(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hosting'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'uptime'] });
    },
  });
}

export function useSystemHealth() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => adminApi.getHealth().then(r => r.data),
    enabled: !!token,
    refetchInterval: 30_000,
    ...opts,
  });
}

export function useClusterHealth() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'diagnostics', 'health'],
    queryFn: () => adminApi.getClusterHealth().then(r => r.data ?? r),
    enabled: !!token,
    refetchInterval: 15_000,
    ...opts,
  });
}

export function useWebhookLogs(limit = 50) {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'diagnostics', 'webhooks', limit],
    queryFn: () => adminApi.getWebhookLogs(limit).then(r => (r.data ?? r) as any[]),
    enabled: !!token,
    refetchInterval: 10_000,
    ...opts,
  });
}

export function useReplayWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.replayWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'webhooks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices'] });
    },
  });
}

export function useReconcilePayments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi.reconcilePayments().then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'webhooks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
  });
}

export function useResolveDns() {
  return useMutation({
    mutationFn: (domain: string) => adminApi.resolveDns(domain).then(r => r.data ?? r),
  });
}

export function useImpersonateClient() {
  return useMutation({
    mutationFn: (clientId: string) => adminApi.impersonateClient(clientId).then(r => r.data ?? r),
  });
}

// ── Troubleshooting Workstation Hooks ─────────────────────────────────────────

export function useTroubleshootingOverview() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'diagnostics', 'overview'],
    queryFn: () => adminApi.getTroubleshootingOverview().then(r => r.data ?? r),
    enabled: !!token,
    refetchInterval: 15_000,
  });
}

export function useOrphanPayments() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'diagnostics', 'orphans'],
    queryFn: () => adminApi.getOrphanPayments().then(r => r.data ?? r),
    enabled: !!token,
    refetchInterval: 15_000,
  });
}

export function useRemediateOrphanPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.remediateOrphanPayment>[0]) =>
      adminApi.remediateOrphanPayment(data).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'orphans'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'overview'] });
    },
  });
}

export function useDnsSslFleet() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'diagnostics', 'dns-ssl'],
    queryFn: () => adminApi.getDnsSslFleet().then(r => r.data ?? r),
    enabled: !!token,
    refetchInterval: 30_000,
  });
}

export function useRemediateDnsSsl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.remediateDnsSsl>[0]) =>
      adminApi.remediateDnsSsl(data).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'dns-ssl'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'hosting'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'overview'] });
    },
  });
}

export function useWebhookFailures(limit = 50) {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'diagnostics', 'webhook-failures', limit],
    queryFn: () => adminApi.getWebhookFailures(limit).then(r => r.data ?? r),
    enabled: !!token,
    refetchInterval: 10_000,
  });
}

export function useRetryWebhooksBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (windowHours?: number) =>
      adminApi.retryWebhooksBatch(windowHours).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'webhooks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'webhook-failures'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'overview'] });
    },
  });
}

export function useUnsyncedInvoices() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'diagnostics', 'invoices-unsynced'],
    queryFn: () => adminApi.getUnsyncedInvoices().then(r => r.data ?? r),
    enabled: !!token,
    refetchInterval: 15_000,
  });
}

export function useRemediateInvoiceSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.remediateInvoiceSync>[0]) =>
      adminApi.remediateInvoiceSync(data).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'invoices-unsynced'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'overview'] });
    },
  });
}

export function useClientAccessIssues() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'diagnostics', 'client-access'],
    queryFn: () => adminApi.getClientAccessIssues().then(r => r.data ?? r),
    enabled: !!token,
    refetchInterval: 15_000,
  });
}

export function useRemediateClientAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.remediateClientAccess>[0]) =>
      adminApi.remediateClientAccess(data).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'client-access'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'overview'] });
    },
  });
}

export function useSuspendedDomains() {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'diagnostics', 'domains-suspended'],
    queryFn: () => adminApi.getSuspendedDomains().then(r => r.data ?? r),
    enabled: !!token,
    refetchInterval: 15_000,
  });
}

export function useRemediateDomainState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.remediateDomainState>[0]) =>
      adminApi.remediateDomainState(data).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'domains-suspended'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'hosting'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'overview'] });
    },
  });
}

// ── Manual Client Account Provisioning Hooks ──────────────────────────────────

export function useManualProvisionClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.manualProvisionClient>[0]) =>
      adminApi.manualProvisionClient(data).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'client-access'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'overview'] });
    },
  });
}

export function useResendClientInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.resendClientInvite(id).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'client-access'] });
    },
  });
}

export function useSyncClientOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.syncClientOnboarding(id).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'client-access'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics', 'overview'] });
    },
  });
}

// ── Proactive Intelligence & Anomaly Remediation (M3 / R3) ──────────────────

export interface ProactiveAnomaly {
  id: string;
  rule: 'SSL_EXPIRING_7D' | 'WEBHOOK_BURST' | 'UNAPPLIED_PAYMENT' | 'EXPIRED_QUOTE_DEPOSIT' | string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  resourceId: string;
  metadata: Record<string, any>;
  remediationAction: string;
  remediationPayload: Record<string, any>;
}

export interface ProactiveScanReport {
  success: boolean;
  status: 'HEALTHY' | 'ANOMALIES_DETECTED';
  scannedAt: string;
  summary: {
    totalAnomalies: number;
    critical: number;
    warning: number;
    info: number;
  };
  counts: {
    sslExpiring: number;
    webhookBursts: number;
    unappliedPayments: number;
    expiredQuoteDeposits: number;
  };
  anomalies: ProactiveAnomaly[];
}

export function useProactiveHealthScan() {
  const token = useToken();
  return useQuery<ProactiveScanReport>({
    queryKey: ['admin', 'diagnostics', 'proactive-scan'],
    queryFn: () => adminApi.getProactiveScan().then(r => r.data ?? r),
    enabled: !!token,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useRemediateProactiveAnomaly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.remediateProactiveAnomaly>[0]) =>
      adminApi.remediateProactiveAnomaly(data).then(r => r.data ?? r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'hosting'] });
    },
  });
}


