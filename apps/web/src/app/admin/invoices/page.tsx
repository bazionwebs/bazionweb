'use client';

import React, { useState } from 'react';
import {
  Search,
  AlertCircle,
  Plus,
  X,
  ShoppingCart,
  Trash2,
  Minus,
  Download,
  Check,
  Globe,
  FileText,
  Server,
  Wrench,
  Sparkles,
  Eye,
  Loader2,
  Receipt,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useAdminInvoices, useCanSeeBilling, useMarkInvoicePaid, useAdminClients } from '@/hooks/useAdminData';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatMoney, formatDate, shortId } from '@/lib/format';
import { adminApi } from '@/lib/api';
import { resolveApiV1Base } from '@/lib/api-base';

interface RawInvoice {
  id: string;
  invoiceNumber?: string | null;
  client?: { id?: string; businessName?: string; email?: string; country?: string };
  clientId?: string;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  dueDate?: string | Date | null;
  createdAt?: string | Date | null;
  paidAt?: string | Date | null;
  lineItems?: Array<{ description?: string; label?: string; quantity?: number; unitPrice?: number; amount?: number; total?: number }> | null;
  notes?: string | null;
  breakdown?: {
    subtotal?: number;
    vatRate?: number;
    vatAmount?: number;
    vatLabel?: string;
    total?: number;
    amountPaid?: number;
    balanceDue?: number;
  };
}

interface ServiceCatalogItem {
  id: string;
  category: 'websites' | 'care' | 'hosting' | 'addons';
  name: string;
  tagline: string;
  priceKes: number;
  priceUsd: number;
  period: 'one-time' | 'month' | 'year';
  badge?: string;
}

const SERVICE_CATALOG: ServiceCatalogItem[] = [
  // ── Web Development Packages ──
  {
    id: 'pkg-launch',
    category: 'websites',
    name: 'Launch Website Package',
    tagline: 'Up to 5 pages, WhatsApp chat, responsive UI, basic SEO',
    priceKes: 25000,
    priceUsd: 450,
    period: 'one-time',
    badge: 'Starter',
  },
  {
    id: 'pkg-business',
    category: 'websites',
    name: 'Business Website Package',
    tagline: 'Up to 10 pages, CMS blog engine, analytics & lead funnel',
    priceKes: 90000,
    priceUsd: 950,
    period: 'one-time',
    badge: 'Popular',
  },
  {
    id: 'pkg-ecommerce',
    category: 'websites',
    name: 'Ecommerce Storefront Package',
    tagline: 'Product catalog, shopping cart, M-Pesa & Card checkout',
    priceKes: 150000,
    priceUsd: 1500,
    period: 'one-time',
    badge: 'High-Volume',
  },
  {
    id: 'pkg-custom-app',
    category: 'websites',
    name: 'Custom Web Application',
    tagline: 'Bespoke web portal, NestJS API, PostgreSQL & custom flows',
    priceKes: 250000,
    priceUsd: 2500,
    period: 'one-time',
    badge: 'Enterprise',
  },
  {
    id: 'service-admin-hub-starter',
    category: 'websites',
    name: 'Standalone Admin Media Hub (Retrofit)',
    tagline: 'Independent Next.js admin control panel for existing websites with R2 media vault & banner editor',
    priceKes: 45000,
    priceUsd: 490,
    period: 'one-time',
    badge: 'Retrofit Hub',
  },
  {
    id: 'service-admin-hub-corporate',
    category: 'websites',
    name: 'Corporate Operations Desk & Multi-User Admin',
    tagline: 'Multi-user role-based admin workstation with content collections, live preview & audit logs',
    priceKes: 85000,
    priceUsd: 890,
    period: 'one-time',
    badge: 'Multi-User RBAC',
  },
  {
    id: 'rate-extra-page',
    category: 'websites',
    name: 'Additional Web Page Build',
    tagline: 'Custom responsive page design, layout, content formatting & technical SEO (per page)',
    priceKes: 2000,
    priceUsd: 40,
    period: 'one-time',
    badge: '+1 Page Unit',
  },
  {
    id: 'rate-extra-landing-page',
    category: 'websites',
    name: 'Standalone Landing Page / Funnel',
    tagline: 'High-conversion marketing landing page with hero CTA, testimonials & lead capture funnel',
    priceKes: 15000,
    priceUsd: 149,
    period: 'one-time',
    badge: 'Sales Funnel',
  },

  // ── Managed Care & SLA Retainers ──
  {
    id: 'care-essential',
    category: 'care',
    name: 'Care Essential Retainer',
    tagline: 'Automated patch updates, uptime monitor & weekly R2 backups',
    priceKes: 5000,
    priceUsd: 75,
    period: 'month',
    badge: '99.9% SLA',
  },
  {
    id: 'care-growth',
    category: 'care',
    name: 'Care Growth Retainer',
    tagline: 'Daily backups, monthly content updates, 4-hour SLA response',
    priceKes: 12000,
    priceUsd: 150,
    period: 'month',
    badge: 'Recommended',
  },
  {
    id: 'care-pro',
    category: 'care',
    name: 'Care Professional Retainer',
    tagline: '1h critical SLA, security audit, speed tuning & dedicated channel',
    priceKes: 25000,
    priceUsd: 299,
    period: 'month',
    badge: 'Priority 1h',
  },
  {
    id: 'care-enterprise',
    category: 'care',
    name: 'Care Enterprise Retainer',
    tagline: 'Dedicated DevOps engineer, 24/7 cluster monitor & custom SLA',
    priceKes: 50000,
    priceUsd: 599,
    period: 'month',
    badge: 'Full DevOps',
  },

  // ── Managed Cloud Hosting ──
  {
    id: 'host-essential',
    category: 'hosting',
    name: 'Host Essential Container',
    tagline: '0.5 vCPU, 384MB RAM, 10GB NVMe, automated SSL & Cloudflare',
    priceKes: 1500,
    priceUsd: 19,
    period: 'month',
  },
  {
    id: 'host-business',
    category: 'hosting',
    name: 'Host Business Container',
    tagline: '1.5 vCPU, 768MB RAM, 25GB NVMe, 5 email inboxes, daily R2',
    priceKes: 3500,
    priceUsd: 39,
    period: 'month',
  },
  {
    id: 'host-pro',
    category: 'hosting',
    name: 'Host Professional Container',
    tagline: '2.0 vCPU, 1.5GB RAM, 50GB NVMe, isolated Redis 7 cache',
    priceKes: 7500,
    priceUsd: 79,
    period: 'month',
  },
  {
    id: 'host-cloud',
    category: 'hosting',
    name: 'Managed Cloud Cluster',
    tagline: 'Dedicated 4.0 vCPU, 100GB NVMe, standalone PostgreSQL 16 & Redis',
    priceKes: 18000,
    priceUsd: 189,
    period: 'month',
  },

  // ── Modular Add-ons & Integrations ──
  {
    id: 'addon-mpesa',
    category: 'addons',
    name: 'Safaricom M-Pesa STK Push Gateway',
    tagline: 'Direct Daraja API integration with instant webhook reconciliation',
    priceKes: 15000,
    priceUsd: 149,
    period: 'one-time',
  },
  {
    id: 'addon-card',
    category: 'addons',
    name: 'Card Payment Gateway Integration',
    tagline: 'Paystack or Stripe 3D-Secure Visa/Mastercard checkout integration',
    priceKes: 15000,
    priceUsd: 149,
    period: 'one-time',
  },
  {
    id: 'addon-admin-dashboard',
    category: 'addons',
    name: 'Bespoke Client Admin & Media Upload Hub',
    tagline: 'Branded admin portal for owners to upload photos, swap banners, publish PDFs & toggle notices',
    priceKes: 25000,
    priceUsd: 299,
    period: 'one-time',
    badge: 'Client Autonomy',
  },
  {
    id: 'addon-booking',
    category: 'addons',
    name: 'Online Booking & Scheduling Engine',
    tagline: 'Calendar appointment bookings, client reminders & CRM sync',
    priceKes: 20000,
    priceUsd: 199,
    period: 'one-time',
  },
  {
    id: 'addon-seo',
    category: 'addons',
    name: 'Advanced SEO Foundation & Schema',
    tagline: 'Schema.org JSON-LD markup, Google Search Console, keyword meta',
    priceKes: 18000,
    priceUsd: 179,
    period: 'one-time',
  },
  {
    id: 'addon-blog',
    category: 'addons',
    name: 'Blog / Article CMS Engine',
    tagline: 'Full publishing suite, categories, author bio & instant search',
    priceKes: 15000,
    priceUsd: 149,
    period: 'one-time',
  },
  {
    id: 'addon-copy',
    category: 'addons',
    name: 'Commercial Copywriting (5 Pages)',
    tagline: 'Conversion-engineered commercial copy for core landing pages',
    priceKes: 25000,
    priceUsd: 249,
    period: 'one-time',
  },
  {
    id: 'rate-copywriting-extra-page',
    category: 'addons',
    name: 'Additional Page Copywriting',
    tagline: 'Conversion-engineered commercial copywriting and content drafting (per page)',
    priceKes: 5000,
    priceUsd: 50,
    period: 'one-time',
    badge: 'Content',
  },
  {
    id: 'addon-migration',
    category: 'addons',
    name: 'Zero-Downtime Website Migration',
    tagline: 'Complete transfer of databases, code, DNS & SSL from old host',
    priceKes: 10000,
    priceUsd: 99,
    period: 'one-time',
  },
  {
    id: 'addon-domain',
    category: 'addons',
    name: 'Corporate Domain & DNS Setup',
    tagline: 'Annual registration with Cloudflare DNS, MX, SPF & DKIM keys',
    priceKes: 2500,
    priceUsd: 25,
    period: 'year',
  },
  {
    id: 'rate-hourly',
    category: 'addons',
    name: 'Senior Engineering Retainer (Per Hour)',
    tagline: 'DevOps, custom API development, database optimization',
    priceKes: 5000,
    priceUsd: 50,
    period: 'one-time',
  },
];

interface CartLineItem {
  id: string; // client-side item key
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  period?: string;
}

export default function AdminInvoicesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Generator Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [clientId, setClientId] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'KES' | 'EUR' | 'GBP'>('USD');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(Date.now() + 14 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('Payment terms: Net 14 days. Bank wire or M-Pesa accepted.');
  const [applyVat, setApplyVat] = useState(false);
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'websites' | 'care' | 'hosting' | 'addons' | 'custom'>('all');
  const [catalogSearch, setCatalogSearch] = useState('');

  // Custom Item Inputs
  const [customDescription, setCustomDescription] = useState('');
  const [customQty, setCustomQty] = useState(1);
  const [customPrice, setCustomPrice] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Statement Inspection modal
  const [inspectInvoice, setInspectInvoice] = useState<RawInvoice | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canSeeBilling = useCanSeeBilling();
  const invoicesQuery = useAdminInvoices();
  const clientsQuery = useAdminClients();
  const markPaidMutation = useMarkInvoicePaid();

  if (!canSeeBilling) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center max-w-md mx-auto my-12 shadow-sm">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900 text-sm">Access Restricted</h3>
        <p className="text-xs text-slate-500 mt-1">
          Financial invoices and billing ledgers are strictly restricted to Super Admin and Admin staff roles.
        </p>
      </div>
    );
  }

  const rawInvoices = (invoicesQuery.data?.items ?? []) as RawInvoice[];
  const rawClients = clientsQuery.data?.items ?? [];

  const invoices = rawInvoices.map((inv) => ({
    ...inv,
    invoiceNumber: inv.invoiceNumber || `INV-${shortId(inv.id, 6)}`,
    clientName: inv.client?.businessName || 'Client',
    amount: Number(inv.amount || 0),
    currency: (inv.currency as 'USD' | 'KES' | 'EUR' | 'GBP') || 'USD',
    status: inv.status || 'SENT',
    dueDate: inv.dueDate ? formatDate(inv.dueDate) : '—',
    createdAt: inv.createdAt ? formatDate(inv.createdAt) : '—',
  }));

  const filteredInvoices = invoices.filter((i) => {
    const matchesSearch =
      i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.clientName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBilled = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + i.amount, 0);
  const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE');
  const overdueTotal = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);

  // Auto-detect client currency and preset notes when client selected
  const handleClientSelect = (selectedId: string) => {
    setClientId(selectedId);
    const chosen = rawClients.find((c) => c.id === selectedId);
    if (chosen) {
      const isKenya = chosen.country === 'KE' || /kenya/i.test(chosen.country || '');
      if (isKenya) {
        setCurrency('KES');
        setApplyVat(true);
      } else {
        setCurrency('USD');
        setApplyVat(false);
      }
    }
  };

  // Cart operations
  const getItemPrice = (catalogItem: ServiceCatalogItem, curr: string) => {
    if (curr === 'KES') return catalogItem.priceKes;
    if (curr === 'EUR') return Math.round(catalogItem.priceUsd * 0.92);
    if (curr === 'GBP') return Math.round(catalogItem.priceUsd * 0.79);
    return catalogItem.priceUsd;
  };

  const handleAddServiceToCart = (service: ServiceCatalogItem) => {
    const unitPrice = getItemPrice(service, currency);
    const existing = cartItems.find((i) => i.serviceId === service.id);
    if (existing) {
      setCartItems((prev) =>
        prev.map((i) =>
          i.serviceId === service.id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        ),
      );
    } else {
      const newItem: CartLineItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        serviceId: service.id,
        description: service.period === 'one-time' ? service.name : `${service.name} (${service.period === 'month' ? 'Monthly Retainer' : 'Annual'})`,
        quantity: 1,
        unitPrice,
        period: service.period,
      };
      setCartItems((prev) => [...prev, newItem]);
    }
  };

  const handleAddExtraPages = (pagesCount = 1) => {
    const unitPrice = currency === 'KES' ? 2000 : currency === 'EUR' ? 37 : currency === 'GBP' ? 32 : 40;
    const existing = cartItems.find((i) => i.serviceId === 'rate-extra-page');
    if (existing) {
      setCartItems((prev) =>
        prev.map((i) =>
          i.serviceId === 'rate-extra-page'
            ? { ...i, quantity: i.quantity + pagesCount }
            : i,
        ),
      );
    } else {
      const newItem: CartLineItem = {
        id: `cart-extra-page-${Date.now()}`,
        serviceId: 'rate-extra-page',
        description: 'Additional Web Page Build (Design, Layout & SEO)',
        quantity: pagesCount,
        unitPrice,
        period: 'one-time',
      };
      setCartItems((prev) => [...prev, newItem]);
    }
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDescription.trim()) return;
    const priceNum = parseFloat(customPrice);
    if (isNaN(priceNum) || priceNum < 0) return;

    const newItem: CartLineItem = {
      id: `custom-${Date.now()}`,
      description: customDescription.trim(),
      quantity: Math.max(1, customQty),
      unitPrice: priceNum,
    };
    setCartItems((prev) => [...prev, newItem]);
    setCustomDescription('');
    setCustomQty(1);
    setCustomPrice('');
  };

  const handleUpdateCartItemQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartLineItem[],
    );
  };

  const handleUpdateCartItemPrice = (id: string, newPrice: number) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unitPrice: Math.max(0, newPrice) } : item)),
    );
  };

  const handleUpdateCartItemDesc = (id: string, newDesc: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, description: newDesc } : item)),
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Financial calculations
  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const vatRate = applyVat ? (currency === 'KES' ? 0.16 : 0.16) : 0;
  const vatAmount = Math.round(cartSubtotal * vatRate * 100) / 100;
  const grandTotal = Math.round((cartSubtotal + vatAmount) * 100) / 100;

  const handleMarkPaid = async (id: string) => {
    if (confirm('Are you sure you want to manually mark this invoice as PAID? This will update subscription records.')) {
      await markPaidMutation.mutateAsync(id);
    }
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    try {
      const res = await adminApi.getInvoicePdfLink(invoiceId);
      const tokenUrl = res?.data?.downloadUrlWithToken || res?.downloadUrlWithToken;
      if (!tokenUrl) throw new Error('No PDF download link returned from billing API.');

      const fullUrl = tokenUrl.startsWith('http')
        ? tokenUrl
        : `${resolveApiV1Base().replace(/\/api\/v1\/?$/, '')}${tokenUrl}`;

      const link = document.createElement('a');
      link.href = fullUrl;
      link.setAttribute('download', `invoice-${invoiceId}.pdf`);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not download invoice PDF.';
      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setErrorMsg('Please select a client to bill.');
      return;
    }
    if (cartItems.length === 0) {
      setErrorMsg('Please add at least one service item to the invoice cart.');
      return;
    }
    if (grandTotal <= 0) {
      setErrorMsg('Invoice total must be greater than zero.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payloadLineItems = cartItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));

    if (applyVat && vatAmount > 0) {
      payloadLineItems.push({
        description: `Value Added Tax (VAT ${Math.round(vatRate * 100)}%)`,
        quantity: 1,
        unitPrice: vatAmount,
        amount: vatAmount,
      });
    }

    try {
      await adminApi.generateInvoice({
        clientId,
        amount: grandTotal,
        currency,
        dueDate,
        lineItems: payloadLineItems,
        notes: notes.trim() || undefined,
      });

      setShowGenerateModal(false);
      setClientId('');
      setCartItems([]);
      setNotes('Payment terms: Net 14 days. Bank wire or M-Pesa accepted.');
      invoicesQuery.refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate invoice.';
      setErrorMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCatalog = SERVICE_CATALOG.filter((item) => {
    const matchesCategory =
      catalogFilter === 'all' ||
      item.category === catalogFilter ||
      (catalogFilter === 'websites' && (item.id === 'rate-extra-page' || item.id === 'rate-extra-landing-page' || item.id === 'addon-admin-dashboard')) ||
      (catalogFilter === 'addons' && (item.id === 'rate-extra-page' || item.id === 'rate-copywriting-extra-page'));
    const matchesSearch =
      item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      item.tagline.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Invoices &amp; Receivables Ledger</h2>
          <p className="text-xs text-slate-500">Corporate invoices, automated payment verification, and itemized billing suite</p>
        </div>

        <button
          onClick={() => {
            setShowGenerateModal(true);
            setErrorMsg(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Generate B2B Invoice</span>
        </button>
      </div>

      {/* ── Financial Summary KPIs ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs text-slate-400 font-medium">Total Invoiced (Period)</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{formatMoney(totalBilled)}</div>
          <div className="text-[11px] text-slate-400 mt-1">{invoices.length} total invoices issued</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs text-emerald-600 font-medium">Collected Revenue (Paid)</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{formatMoney(totalPaid)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Reconciled via Paystack &amp; M-Pesa</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs text-rose-600 font-medium">Overdue Outstanding</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{formatMoney(overdueTotal)}</div>
          <div className="text-[11px] text-rose-500 mt-1">{overdueInvoices.length} invoices requiring dunning</div>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice # or client name…"
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'PAID', 'OVERDUE', 'SENT', 'DRAFT'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── Invoices Table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {invoicesQuery.isLoading ? (
          <div className="p-8">
            <SectionLoading label="Loading invoice ledger…" />
          </div>
        ) : invoicesQuery.isError ? (
          <div className="p-8">
            <QueryError message="Could not load invoices." onRetry={() => invoicesQuery.refetch()} />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No Invoices Found" hint="Try another search or filter." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-left">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Issued Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{inv.clientName}</td>
                    <td className="py-3 px-4 font-black text-slate-900">{formatMoney(inv.amount, inv.currency)}</td>
                    <td className="py-3 px-4 text-slate-500">{inv.createdAt}</td>
                    <td className="py-3 px-4 text-slate-500">{inv.dueDate}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'OVERDUE'
                            ? 'bg-red-100 text-red-800'
                            : inv.status === 'SENT'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectInvoice(inv)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(inv.id)}
                          disabled={downloadingId === inv.id}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 border border-blue-200 disabled:opacity-50"
                        >
                          {downloadingId === inv.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          <span>PDF</span>
                        </button>
                        {inv.status !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(inv.id)}
                            disabled={markPaidMutation.isPending}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Cart-Based Invoice Generation Modal ───────────────────────────────── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-100 my-auto flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#0F172A] text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">Generate Professional B2B Invoice</h3>
                  <p className="text-[11px] text-slate-400">Cart-driven service selection aligned with BazionWeb service catalog &amp; price books</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Body - 2 Columns (Left: Store / Catalog, Right: Active Cart & Totals) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              {/* LEFT: Service Store / Catalog Picker (7 Cols) */}
              <div className="lg:col-span-7 p-6 overflow-y-auto max-h-[70vh] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" /> 1. Select Services from Store Catalog
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Active Currency: <strong className="text-slate-900">{currency}</strong>
                  </span>
                </div>

                {/* Search & Category Tabs */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search websites, retainers, hosting, add-ons…"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                    {[
                      { id: 'all', label: 'All Services' },
                      { id: 'websites', label: 'Websites & Apps' },
                      { id: 'care', label: 'Care & Retainers' },
                      { id: 'hosting', label: 'Managed Cloud' },
                      { id: 'addons', label: 'Modular Add-ons' },
                      { id: 'custom', label: '+ Custom Line' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCatalogFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                          catalogFilter === tab.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catalog Grid or Custom Item Form */}
                {catalogFilter === 'custom' ? (
                  <form onSubmit={handleAddCustomItem} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Add Custom / Bespoke Service Line
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Service Description *</label>
                      <input
                        type="text"
                        required
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        placeholder="e.g. 50% Milestone Kickoff Deposit for Custom Mobile API"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={customQty}
                          onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit Price ({currency}) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                          placeholder="e.g. 500.00"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Custom Item to Cart</span>
                    </button>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredCatalog.map((service) => {
                      const itemPrice = getItemPrice(service, currency);
                      const inCart = cartItems.some((i) => i.serviceId === service.id);
                      return (
                        <div
                          key={service.id}
                          className="p-3 bg-white border border-slate-200 hover:border-blue-400 rounded-2xl shadow-2xs transition-all flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <h4 className="font-bold text-xs text-slate-900 leading-snug">{service.name}</h4>
                              {service.badge && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 text-blue-700 shrink-0">
                                  {service.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2">{service.tagline}</p>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <div>
                              <span className="font-black text-xs text-slate-900">
                                {formatMoney(itemPrice, currency)}
                              </span>
                              {service.period !== 'one-time' && (
                                <span className="text-[10px] text-slate-400 font-medium ml-1">/{service.period}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddServiceToCart(service)}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${
                                inCart
                                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                  : 'bg-slate-900 text-white hover:bg-blue-600'
                              }`}
                            >
                              <Plus className="w-3 h-3" />
                              <span>{inCart ? 'Add Another' : 'Add'}</span>
                            </button>
                          </div>

                          {service.id.startsWith('pkg-') && (
                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-100">
                              <span className="truncate">
                                {service.id === 'pkg-launch'
                                  ? '5 pages included'
                                  : service.id === 'pkg-business'
                                  ? '10 pages included'
                                  : service.id === 'pkg-ecommerce'
                                  ? '15 pages included'
                                  : 'Custom app scope'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddExtraPages(1)}
                                className="text-blue-600 hover:text-blue-800 font-bold hover:underline shrink-0 ml-1 flex items-center gap-0.5"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span>Extra Page ({formatMoney(currency === 'KES' ? 2000 : 40, currency)})</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT: Active Cart Stack & Checkout Details (5 Cols) */}
              <div className="lg:col-span-5 p-6 flex flex-col justify-between max-h-[70vh] overflow-y-auto space-y-4 bg-slate-50/50">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-blue-600" /> 2. Invoice Target &amp; Cart
                    </span>
                    {cartItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCartItems([])}
                        className="text-[11px] text-red-600 hover:underline font-semibold"
                      >
                        Clear Cart
                      </button>
                    )}
                  </div>

                  {/* Client & Currency Pickers */}
                  <div className="space-y-2.5 bg-white p-3.5 rounded-2xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Client Account *</label>
                      <select
                        required
                        value={clientId}
                        onChange={(e) => handleClientSelect(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      >
                        <option value="">-- Choose Client --</option>
                        {rawClients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.businessName} ({c.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Currency</label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none font-bold text-slate-800"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="KES">KES (KSh)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Due Date</label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active Line Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>Billed Services Stack ({cartItems.length})</span>
                      <span className="text-[11px] text-slate-400 font-normal">Directly printable to PDF</span>
                    </div>

                    {/* Quick Extra Pages Addon Banner */}
                    <div className="p-2.5 bg-blue-50/80 border border-blue-200/90 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Add Extra Web Pages</span>
                        </div>
                        <div className="text-[11px] text-blue-700">
                          {formatMoney(currency === 'KES' ? 2000 : 40, currency)} per additional page
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAddExtraPages(1)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-0.5 shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+1 Page</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddExtraPages(5)}
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-0.5 shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+5 Pages</span>
                        </button>
                      </div>
                    </div>

                    {cartItems.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white space-y-1">
                        <ShoppingCart className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-slate-600">Your invoice cart is empty</p>
                        <p className="text-[11px] text-slate-400">Click any service on the left to add it to this invoice.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {cartItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleUpdateCartItemDesc(item.id, e.target.value)}
                                className="w-full text-xs font-bold text-slate-900 bg-transparent border-0 p-0 focus:ring-0 truncate"
                              />
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center border border-slate-200 rounded-md bg-slate-50 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCartItemQty(item.id, -1)}
                                    className="px-1.5 py-0.5 text-slate-500 hover:text-slate-900"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="px-1.5 font-bold text-slate-800">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCartItemQty(item.id, 1)}
                                    className="px-1.5 py-0.5 text-slate-500 hover:text-slate-900"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <span className="text-[11px] text-slate-400">&times;</span>
                                <div className="flex items-center gap-1 text-[11px]">
                                  <span className="text-slate-400">{currency}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.unitPrice}
                                    onChange={(e) => handleUpdateCartItemPrice(item.id, parseFloat(e.target.value) || 0)}
                                    className="w-16 px-1 py-0.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded text-right"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-black text-slate-900">
                                {formatMoney(item.quantity * item.unitPrice, currency)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCartItem(item.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* VAT / Tax Toggle */}
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyVat}
                        onChange={(e) => setApplyVat(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-700">Apply Value Added Tax (VAT 16%)</span>
                    </label>
                    {applyVat && (
                      <span className="font-bold text-slate-900">+{formatMoney(vatAmount, currency)}</span>
                    )}
                  </div>

                  {/* Notes / Scope */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Notes &amp; Scope</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Payment instructions, bank wire account, or project scope..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Bottom Total & Actions */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Total Billed Amount</span>
                      <span className="text-xs text-slate-300">
                        Subtotal: {formatMoney(cartSubtotal, currency)} {applyVat ? `+ VAT` : ''}
                      </span>
                    </div>
                    <div className="text-xl font-black text-emerald-400">
                      {formatMoney(grandTotal, currency)}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowGenerateModal(false)}
                      className="px-4 py-2 font-semibold text-xs text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submitting || cartItems.length === 0 || !clientId}
                      onClick={handleGenerateInvoice}
                      className="px-5 py-2 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Issuing Invoice…</span>
                        </>
                      ) : (
                        <>
                          <span>Issue Itemized B2B Invoice</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Statement Breakdown Modal (Inspection & Download) ─────────────────── */}
      {inspectInvoice && (() => {
        const lineItems = Array.isArray(inspectInvoice.lineItems) && inspectInvoice.lineItems.length > 0
          ? inspectInvoice.lineItems
          : [
              {
                description: inspectInvoice.notes || 'Engineering & Cloud Services',
                quantity: 1,
                amount: Number(inspectInvoice.amount || 0),
              },
            ];
        const breakdown = inspectInvoice.breakdown;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Invoice Statement Breakdown
                    </h3>
                    <p className="text-xs text-slate-500">
                      Invoice <strong className="font-mono text-slate-800">{inspectInvoice.invoiceNumber}</strong> &bull; Issued {formatDate(inspectInvoice.createdAt)} &bull; Due {formatDate(inspectInvoice.dueDate)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectInvoice(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Client Info Banner */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Billed To</span>
                  <span className="font-bold text-slate-900 text-sm">{inspectInvoice.client?.businessName || 'Valued Client'}</span>
                  {inspectInvoice.client?.email && (
                    <span className="text-slate-500 block text-[11px]">{inspectInvoice.client.email}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block mt-0.5 ${
                      inspectInvoice.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : inspectInvoice.status === 'OVERDUE'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {inspectInvoice.status}
                  </span>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-4">Service Description</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-medium text-slate-800">
                          {item.description || item.label || 'BazionWeb Service'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">
                          {item.quantity ?? 1}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                          {formatMoney(Number(item.amount ?? item.total ?? 0), inspectInvoice.currency ?? 'USD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-800">
                    {formatMoney(breakdown?.subtotal ?? Number(inspectInvoice.amount), inspectInvoice.currency ?? 'USD')}
                  </span>
                </div>
                {breakdown?.vatAmount && breakdown.vatAmount > 0 ? (
                  <div className="flex justify-between text-slate-600">
                    <span>{breakdown.vatLabel || 'Value Added Tax (VAT 16%)'}:</span>
                    <span className="font-semibold text-slate-800">
                      {formatMoney(breakdown.vatAmount, inspectInvoice.currency ?? 'USD')}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Total Amount:</span>
                  <span className="text-emerald-700">
                    {formatMoney(Number(inspectInvoice.amount), inspectInvoice.currency ?? 'USD')}
                  </span>
                </div>
              </div>

              {inspectInvoice.notes && (
                <div className="text-xs text-slate-600 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">Notes &amp; Terms:</span>
                  <p>{inspectInvoice.notes}</p>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectInvoice(null)}
                  className="px-4 py-2 font-semibold text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(inspectInvoice.id)}
                  disabled={downloadingId === inspectInvoice.id}
                  className="px-4 py-2 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  {downloadingId === inspectInvoice.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download PDF Receipt</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
