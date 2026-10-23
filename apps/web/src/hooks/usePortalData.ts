'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { portalApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── API shapes (mirror the NestJS responses) ───────────────────────────────

export interface ApiPlan {
  id: string;
  name: string;
  tier: string;
  priceMonthly: string | number;
}

export interface ApiSubscription {
  id: string;
  status: string;
  billingCycle: string;
  provider: string;
  renewalDate: string | null;
  plan?: ApiPlan | null;
}

export interface ApiClient {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  status: string;
  plan?: ApiPlan | null;
  subscriptions?: ApiSubscription[];
}

export interface ApiTicket {
  id: string;
  subject: string;
  description?: string | null;
  priority: 'P1' | 'P2' | 'P3' | 'P4' | string;
  status: string;
  category: string;
  createdAt: string;
  slaBreached?: boolean;
  client?: { businessName: string } | null;
  assignee?: { firstName: string | null; lastName: string | null } | null;
  _count?: { comments: number };
}

export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  amount: string | number;
  currency: string;
  status: string;
  notes: string | null;
  pdfUrl: string | null;
  createdAt: string;
  dueDate: string;
}

export interface ApiHostingBackup {
  status: string;
  createdAt: string;
}

export interface ApiProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
}

export interface ApiProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  completionPct: number;
  startDate: string | null;
  dueDate: string | null;
  stagingUrl: string | null;
  productionUrl: string | null;
  tasks?: ApiProjectTask[];
}

export interface ApiHostingAccount {
  id: string;
  clientId: string;
  domain: string;
  server: string;
  plan: string;
  status: string;
  sslExpiry: string | null;
  createdAt?: string | null;
  backups?: ApiHostingBackup[];
}

export interface ApiMonthlyReport {
  clientId: string;
  period: string;
  uptimePercent: number;
  totalDowntimeMinutes: number;
  incidentCount: number;
  ticketsOpened: number;
  ticketsResolved: number;
  backupsCompleted: number;
  backupsFailed: number;
  securityScansClean: number;
  lighthouseScore: number;
  avgLoadTimeMs: number;
  generatedAt: string;
}

function useToken() {
  return useAuthStore(s => s.accessToken);
}

const opts = { staleTime: 30_000, retry: 1 as const, refetchOnWindowFocus: false };

async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const res = await promise;
  return res.data;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useClientProfile() {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'client'],
    queryFn: () => unwrap<ApiClient>(portalApi.getMyClient()),
    enabled: !!token,
    ...opts,
  });
}

export function useClientProjects() {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'projects'],
    queryFn: () => portalApi.getMyProjects().then(r => (r.data ?? []) as ApiProject[]),
    enabled: !!token,
    ...opts,
  });
}

export function useClientHosting() {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'hosting'],
    queryFn: () => unwrap<ApiHostingAccount[]>(portalApi.getMyHosting()),
    enabled: !!token,
    ...opts,
  });
}

export function useClientTickets() {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'tickets'],
    queryFn: () => portalApi.getMyTickets().then(r => (r.data ?? []) as ApiTicket[]),
    enabled: !!token,
    ...opts,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { subject: string; priority: string; category: string; body: string }) =>
      portalApi.createTicket(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'tickets'] });
    },
  });
}

export function useAddTicketComment() {
  return useMutation({
    mutationFn: (input: { ticketId: string; body: string }) =>
      portalApi.addTicketComment(input.ticketId, input.body),
  });
}

export function usePayInvoiceMpesa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { invoiceId: string; mpesaPhoneNumber: string }) =>
      portalApi.payInvoiceMpesa(input.invoiceId, { mpesaPhoneNumber: input.mpesaPhoneNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'invoices'] });
    },
  });
}

export function usePayInvoiceCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { invoiceId: string; email?: string }) =>
      portalApi.payInvoiceCard(input.invoiceId, input.email ? { email: input.email } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'invoices'] });
    },
  });
}

export function useClientInvoices() {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'invoices'],
    queryFn: () => portalApi.getMyInvoices().then(r => (r.data ?? []) as ApiInvoice[]),
    enabled: !!token,
    ...opts,
  });
}

export function useClientReports() {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'reports'],
    queryFn: () => unwrap<ApiMonthlyReport[]>(portalApi.getMyReports()),
    enabled: !!token,
    ...opts,
  });
}
