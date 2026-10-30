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

function useToken() {
  return useAuthStore(s => s.accessToken);
}

function useRoles() {
  return useAuthStore(s => s.user?.roles ?? []);
}

const opts = { staleTime: 30_000, retry: 1 as const, refetchOnWindowFocus: false };

/** MRR + SLA endpoints are ADMIN/SUPER_ADMIN-only; uptime allows SUPPORT. */
export function useCanSeeBilling() {
  const roles = useRoles();
  return roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
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
