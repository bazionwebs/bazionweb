// ─── API Types ────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'CLIENT';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  keycloakId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export type PlanTier = 'starter' | 'growth' | 'business' | 'enterprise';
export type ClientStatus = 'active' | 'suspended' | 'cancelled' | 'trial';

export interface Client {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  planId: string;
  plan?: Plan;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  priceMonthly: number;
  priceAnnual: number;
  uptimeSla: string;
  p1ResponseMinutes: number;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketCategory = 'hosting' | 'development' | 'maintenance' | 'security' | 'billing' | 'other';

export interface Ticket {
  id: string;
  clientId: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  assignedTo?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Hosting ─────────────────────────────────────────────────────────────────

export type HostingStatus = 'active' | 'suspended' | 'provisioning' | 'migrating';

export interface HostingAccount {
  id: string;
  clientId: string;
  domain: string;
  server: string;
  plan: string;
  sslExpiry: string;
  status: HostingStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  clientId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string;
  createdAt: string;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface UptimeReport {
  domain: string;
  period: string;
  uptimePercent: number;
  totalDowntimeMinutes: number;
  incidentCount: number;
}

export interface PerformanceReport {
  domain: string;
  period: string;
  lighthouseScore: number;
  avgLoadTimeMs: number;
  coreWebVitals: {
    lcp: number;
    fid: number;
    cls: number;
  };
}

// ─── Quote ───────────────────────────────────────────────────────────────────

export interface QuoteRequest {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  plan?: PlanTier | 'unsure';
  service?: string;
  message: string;
  urgent: boolean;
}
