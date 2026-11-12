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
  priceYearly?: string | number | null;
  uptimeSla?: string | number | null;
  p1ResponseMinutes?: number | null;
  p2ResponseMinutes?: number | null;
  p3ResponseMinutes?: number | null;
}

export interface ApiSubscription {
  id: string;
  status: string;
  billingCycle: string;
  provider: string;
  renewalDate: string | null;
  gracePeriodEnd?: string | null;
  plan?: ApiPlan | null;
}

export interface ApiPlatformProjectionSummary {
  id: string;
  externalOrderId: string;
  status: string;
  subscriptionStatus?: string | null;
  graceEndsAt?: string | null;
  lifecycleReasonCode?: string | null;
  customerStatusMessage?: string | null;
  platformUpdatedAt: string;
}

export interface ApiClient {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  address?: string | null;
  country?: string | null;
  taxPin?: string | null;
  website?: string | null;
  onboardedAt?: string | null;
  status: string;
  createdAt?: string;
  plan?: ApiPlan | null;
  subscriptions?: ApiSubscription[];
  platformProvisioningProjections?: ApiPlatformProjectionSummary[];
}

export interface ApiTicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal?: boolean;
  createdAt: string;
  author?: {
    firstName: string | null;
    lastName: string | null;
    role: string;
  } | null;
}

export interface ApiTicket {
  id: string;
  subject: string;
  description?: string | null;
  priority: 'P1' | 'P2' | 'P3' | 'P4' | string;
  status: string;
  category: string;
  createdAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  slaBreached?: boolean;
  client?: { businessName: string } | null;
  assignee?: { firstName: string | null; lastName: string | null } | null;
  comments?: Array<{
    id: string;
    body: string;
    createdAt: string;
    author?: { firstName: string | null; lastName: string | null; role: string } | null;
  }>;
  _count?: { comments: number };
}

export interface ApiInvoiceLineItem {
  description?: string;
  label?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  total?: number;
}

export interface ApiPaymentLogSummary {
  provider: string;
  providerRef: string;
  createdAt: string;
}

export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  amount: string | number;
  currency: string;
  status: string;
  notes: string | null;
  pdfUrl: string | null;
  lineItems?: ApiInvoiceLineItem[] | Record<string, unknown> | null;
  paymentLogs?: ApiPaymentLogSummary[];
  createdAt: string;
  dueDate: string;
  paidAt?: string | null;
  /** Server-computed VAT split (from the Market tax rule that priced the invoice). */
  breakdown?: {
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    vatLabel: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
  };
}

export interface ApiHostingBackup {
  id?: string;
  status: string;
  sizeMb?: number | null;
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
  serverOs?: string | null;
  ipAddress?: string | null;
  diskUsageMb?: number | null;
  sslIssuer?: string | null;
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

export interface ApiVaultSecret {
  id: string;
  clientId?: string;
  label: string;
  category:
    | 'DOMAIN_REGISTRAR'
    | 'HOSTING_SSH'
    | 'API_KEY'
    | 'PAYMENT_GATEWAY'
    | 'DATABASE'
    | 'CMS_ADMIN'
    | 'OTHER'
    | string;
  username: string | null;
  serviceUrl: string | null;
  maskedHint: string;
  notes: string | null;
  lastRevealedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiVaultRevealResult {
  id: string;
  label: string;
  value: string;
  revealedAt: string;
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

export function useSignOffProjectTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; taskId: string }) =>
      portalApi.signOffProjectTask(input.projectId, input.taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'projects'] });
    },
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

export function useTicketComments(ticketId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'tickets', ticketId, 'comments'],
    queryFn: () =>
      portalApi.getTicketComments(ticketId!).then(r => ((r.data ?? r) as ApiTicketComment[]) ?? []),
    enabled: !!token && !!ticketId,
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; body: string }) =>
      portalApi.addTicketComment(input.ticketId, input.body),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'tickets', variables.ticketId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['portal', 'tickets'] });
    },
  });
}

export function useVaultSecrets() {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'vault'],
    queryFn: () => portalApi.listVaultSecrets().then(r => ((r.data ?? r) as ApiVaultSecret[]) ?? []),
    enabled: !!token,
    ...opts,
  });
}

export function useCreateVaultSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      label: string;
      category?: string;
      username?: string;
      serviceUrl?: string;
      value: string;
      notes?: string;
    }) => portalApi.createVaultSecret(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'vault'] });
    },
  });
}

export function useRevealVaultSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (secretId: string) =>
      portalApi.revealVaultSecret(secretId).then(r => (r.data ?? r) as ApiVaultRevealResult),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'vault'] });
    },
  });
}

export function useDeleteVaultSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (secretId: string) => portalApi.deleteVaultSecret(secretId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'vault'] });
    },
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

// ─── Notifications ──────────────────────────────────────────────────────────

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export function useNotifications() {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'notifications'],
    queryFn: () =>
      portalApi
        .getNotifications({ limit: 15 })
        .then(r => {
          if (Array.isArray(r)) return r;
          if (Array.isArray(r?.data)) return r.data;
          if (Array.isArray(r?.data?.items)) return r.data.items;
          return [];
        })
        .catch(() => [] as ApiNotification[]),
    enabled: !!token,
    ...opts,
  });
}

export function useUnreadNotificationCount() {
  const token = useToken();
  return useQuery({
    queryKey: ['portal', 'notifications', 'unread-count'],
    queryFn: () =>
      portalApi
        .getUnreadNotificationCount()
        .then(r => ((r.data ?? r) as { count?: number })?.count ?? 0),
    enabled: !!token,
    refetchInterval: 60_000,
    ...opts,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => portalApi.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'notifications'] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalApi.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'notifications'] });
    },
  });
}

export function useUpdateClientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      clientId: string;
      businessName?: string;
      contactName?: string;
      phone?: string;
      address?: string;
      country?: string;
      taxPin?: string;
    }) =>
      portalApi.updateClient(input.clientId, {
        ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.taxPin !== undefined ? { taxPin: input.taxPin } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'client'] });
    },
  });
}
