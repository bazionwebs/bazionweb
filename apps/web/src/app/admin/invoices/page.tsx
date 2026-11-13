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
  FileText,
  Sparkles,
  Eye,
  Loader2,
  Receipt,
  ArrowRight,
  Check,
  Globe,
  Server,
  Wrench,
  Layout,
  Puzzle,
  Lock,
} from 'lucide-react';
import { useAdminInvoices, useCanSeeBilling, useMarkInvoicePaid, useAdminClients } from '@/hooks/useAdminData';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatMoney, formatDate, shortId } from '@/lib/format';
import { adminApi } from '@/lib/api';
import { pulse } from '@/components/pulse';
import { resolveApiV1Base } from '@/lib/api-base';
import { getApiErrorMessage } from '@/lib/error-helpers';
import {
  CANONICAL_SERVICE_CATALOG as SERVICE_CATALOG,
  BILLING_CYCLES_META,
  getServiceBillingOptions,
  ServiceCatalogItem,
  CommitmentCycle,
  BillingOption,
} from '@/lib/priceBooks';
import { COMMERCIAL_FLOW_STEPS } from '@/lib/pricingData';

type SettlementCurrency = 'USD' | 'KES' | 'EUR' | 'GBP';
type GeneratorStep = 1 | 2 | 3 | 4 | 'custom';
type Step1SubTab = 'websites' | 'addons';

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
  lineItems?: Array<{
    description?: string;
    label?: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
    total?: number;
  }> | null;
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

interface CartLineItem {
  id: string; // client-side item key
  serviceId?: string;
  stepCategory?: 'website' | 'addon' | 'domain' | 'hosting' | 'care' | 'custom';
  description: string;
  quantity: number;
  unitPrice: number;
  period?: string;
  cycle?: CommitmentCycle;
  domainMeta?: string;
}

const WEBSITE_FOUNDATION_IDS = new Set([
  'website-existing',
  'pkg-launch',
  'pkg-business',
  'pkg-professional',
  'pkg-ecommerce',
  'pkg-ecommerce-business',
  'pkg-custom-app',
  'service-admin-hub-starter',
  'service-admin-hub-corporate',
  'rate-extra-landing-page',
]);

function classifyServiceStep(service: ServiceCatalogItem): CartLineItem['stepCategory'] {
  if (service.category === 'domains') return 'domain';
  if (service.category === 'hosting') return 'hosting';
  if (service.category === 'care') return 'care';
  if (service.category === 'addons' || service.id === 'rate-extra-page') return 'addon';
  if (WEBSITE_FOUNDATION_IDS.has(service.id) || service.category === 'websites') return 'website';
  return 'addon';
}

function stepSortRank(item: CartLineItem): number {
  switch (item.stepCategory) {
    case 'website':
      return 1;
    case 'addon':
      return 2;
    case 'domain':
      return 3;
    case 'hosting':
      return 4;
    case 'care':
      return 5;
    default:
      return 6;
  }
}

function stepBadgeLabel(item: CartLineItem): string {
  switch (item.stepCategory) {
    case 'website':
      return 'Step 1 · Website / App Foundation';
    case 'addon':
      return 'Step 1B · Add-On Enhancement';
    case 'domain':
      return item.domainMeta ? `Step 2 · Domain (${item.domainMeta})` : 'Step 2 · Domain Name';
    case 'hosting':
      return 'Step 3 · Managed Hosting';
    case 'care':
      return 'Step 4 · Care Plan (Optional)';
    default:
      return 'Custom B2B Line Item';
  }
}

export default function AdminInvoicesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Generator Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [clientId, setClientId] = useState('');
  const [currency, setCurrency] = useState<SettlementCurrency>('USD');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(Date.now() + 14 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('Payment terms: Net 14 days. Bank wire or M-Pesa accepted.');
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);

  // Guided 4-Step Mandatory Commercial Flow State (mirrors public /store & /pricing)
  const [activeStep, setActiveStep] = useState<GeneratorStep>(1);
  const [step1SubTab, setStep1SubTab] = useState<Step1SubTab>('websites');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [domainNameInput, setDomainNameInput] = useState('');

  // Commitment Cycle State (global per-step + optional per-card overrides)
  const [hostingCycle, setHostingCycle] = useState<CommitmentCycle>('annually');
  const [careCycle, setCareCycle] = useState<CommitmentCycle>('monthly');
  const [cardCycleOverrides, setCardCycleOverrides] = useState<Record<string, CommitmentCycle>>({});

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
    currency: (inv.currency as SettlementCurrency) || 'USD',
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

  // Price helpers aligned with official KE-2026-v1 and GLOBAL-2026-v1 price books
  const getItemPrice = (catalogItem: ServiceCatalogItem, curr: SettlementCurrency) => {
    if (curr === 'KES') return catalogItem.priceKes;
    if (curr === 'EUR') return Math.round(catalogItem.priceUsd * 0.92 * 100) / 100;
    if (curr === 'GBP') return Math.round(catalogItem.priceUsd * 0.79 * 100) / 100;
    return catalogItem.priceUsd;
  };

  const getEffectiveCardCycle = (service: ServiceCatalogItem): CommitmentCycle => {
    if (cardCycleOverrides[service.id]) return cardCycleOverrides[service.id];
    if (service.category === 'hosting') return hostingCycle;
    if (service.category === 'care') return careCycle;
    return service.period === 'year' ? 'annually' : 'monthly';
  };

  const buildCatalogCartFields = (
    service: ServiceCatalogItem,
    curr: SettlementCurrency,
    chosenCycle?: CommitmentCycle,
    domainOverride?: string,
  ): Pick<CartLineItem, 'unitPrice' | 'description' | 'cycle'> => {
    const options = getServiceBillingOptions(service, curr);
    if (options && options.length > 0) {
      const targetCycle = chosenCycle || getEffectiveCardCycle(service);
      const opt = options.find((o) => o.cycle === targetCycle) || options[0];
      return {
        cycle: opt.cycle,
        unitPrice: opt.amount,
        description: `${service.name} — ${opt.label} (${opt.discountPct > 0 ? `${opt.discountPct}% off` : 'Standard'})`,
      };
    }

    const unitPrice = getItemPrice(service, curr);
    const trimmedDomain = (domainOverride ?? '').trim();
    if (service.category === 'domains' && trimmedDomain) {
      return {
        unitPrice,
        description: `${service.name} (${trimmedDomain})`,
      };
    }

    const desc =
      service.period === 'one-time'
        ? service.name
        : `${service.name} (${
            service.period === 'month'
              ? 'Monthly'
              : service.period === 'quarter'
              ? '3 Months'
              : service.period === 'half-year'
              ? '6 Months'
              : 'Annual'
          })`;

    return { unitPrice, description: desc };
  };

  const repriceCartForCurrency = (nextCurrency: SettlementCurrency) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (!item.serviceId) return item;
        const catalogService = SERVICE_CATALOG.find((s) => s.id === item.serviceId);
        if (!catalogService) return item;
        const updated = buildCatalogCartFields(
          catalogService,
          nextCurrency,
          item.cycle,
          item.domainMeta,
        );
        return {
          ...item,
          unitPrice: updated.unitPrice,
          description: updated.description,
          cycle: updated.cycle,
        };
      }),
    );
  };

  const handleCurrencyChange = (nextCurrency: SettlementCurrency) => {
    setCurrency(nextCurrency);
    repriceCartForCurrency(nextCurrency);
  };

  // Auto-detect client currency when client selected
  const handleClientSelect = (selectedId: string) => {
    setClientId(selectedId);
    const chosen = rawClients.find((c) => c.id === selectedId);
    if (chosen) {
      const isKenya = chosen.country === 'KE' || /kenya/i.test(chosen.country || '');
      const nextCurrency: SettlementCurrency = isKenya ? 'KES' : 'USD';
      setCurrency(nextCurrency);
      repriceCartForCurrency(nextCurrency);
    }
  };

  const handleStepCycleChange = (stepCategory: 'hosting' | 'care', nextCycle: CommitmentCycle) => {
    if (stepCategory === 'hosting') {
      setHostingCycle(nextCycle);
    } else {
      setCareCycle(nextCycle);
    }
    // Clear per-card overrides in that category so the pill bar updates all cards in view
    setCardCycleOverrides((prev) => {
      const next = { ...prev };
      for (const s of SERVICE_CATALOG) {
        if (s.category === stepCategory) {
          delete next[s.id];
        }
      }
      return next;
    });
  };

  const handleAddServiceToCart = (
    service: ServiceCatalogItem,
    chosenCycle?: CommitmentCycle,
    autoAdvance = false,
  ) => {
    const stepCategory = classifyServiceStep(service);
    const trimmedDomain = stepCategory === 'domain' ? domainNameInput.trim() : undefined;
    const { unitPrice, description, cycle } = buildCatalogCartFields(
      service,
      currency,
      chosenCycle,
      trimmedDomain,
    );

    const newItem: CartLineItem = {
      id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      serviceId: service.id,
      stepCategory,
      description,
      quantity: 1,
      unitPrice,
      period: service.period,
      cycle,
      domainMeta: trimmedDomain || undefined,
    };

    // Single-choice steps (Website foundation, Domain, Hosting, Care) replace the prior selection in that slot,
    // matching the public /store & /pricing configurator behavior, while add-ons accumulate.
    setCartItems((prev) => {
      if (
        stepCategory === 'website' ||
        stepCategory === 'domain' ||
        stepCategory === 'hosting' ||
        stepCategory === 'care'
      ) {
        const withoutSameSlot = prev.filter((i) => i.stepCategory !== stepCategory);
        return [...withoutSameSlot, newItem];
      }
      const existingAddon = prev.find((i) => i.serviceId === service.id);
      if (existingAddon) {
        return prev.map((i) =>
          i.serviceId === service.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, newItem];
    });

    setErrorMsg(null);
    if (autoAdvance) {
      if (stepCategory === 'website') setActiveStep(2);
      else if (stepCategory === 'domain') setActiveStep(3);
      else if (stepCategory === 'hosting') setActiveStep(4);
    }
  };

  const handleUpdateCartItemCycle = (id: string, newCycle: CommitmentCycle) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.serviceId) return item;
        const catalogService = SERVICE_CATALOG.find((s) => s.id === item.serviceId);
        if (!catalogService) return item;
        const updated = buildCatalogCartFields(
          catalogService,
          currency,
          newCycle,
          item.domainMeta,
        );
        return {
          ...item,
          cycle: updated.cycle,
          unitPrice: updated.unitPrice,
          description: updated.description,
        };
      }),
    );
  };

  const handleAddExtraPages = (pagesCount = 1) => {
    const extraPageService = SERVICE_CATALOG.find((s) => s.id === 'rate-extra-page');
    const unitPrice = extraPageService
      ? getItemPrice(extraPageService, currency)
      : currency === 'KES'
      ? 2000
      : currency === 'EUR'
      ? 37
      : currency === 'GBP'
      ? 32
      : 40;

    setCartItems((prev) => {
      const existing = prev.find((i) => i.serviceId === 'rate-extra-page');
      if (existing) {
        return prev.map((i) =>
          i.serviceId === 'rate-extra-page'
            ? { ...i, quantity: i.quantity + pagesCount }
            : i,
        );
      }
      return [
        ...prev,
        {
          id: `cart-extra-page-${Date.now()}`,
          serviceId: 'rate-extra-page',
          stepCategory: 'addon',
          description: 'Additional Web Page Build (Design, Layout & SEO)',
          quantity: pagesCount,
          unitPrice,
          period: 'one-time',
        },
      ];
    });
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDescription.trim()) return;
    const priceNum = parseFloat(customPrice);
    if (isNaN(priceNum) || priceNum < 0) return;

    const newItem: CartLineItem = {
      id: `custom-${Date.now()}`,
      stepCategory: 'custom',
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

  // Mandatory 4-Step Commercial Stack Checklist State (aligned with public StoreView & PricingView)
  const selectedWebsiteItem = cartItems.find((i) => i.stepCategory === 'website');
  const selectedDomainItem = cartItems.find((i) => i.stepCategory === 'domain');
  const selectedHostingItem = cartItems.find((i) => i.stepCategory === 'hosting');
  const selectedCareItem = cartItems.find((i) => i.stepCategory === 'care');
  const selectedAddonsCount = cartItems
    .filter((i) => i.stepCategory === 'addon')
    .reduce((sum, i) => sum + i.quantity, 0);

  const websiteSatisfied = Boolean(selectedWebsiteItem);
  const domainSatisfied = Boolean(selectedDomainItem);
  const hostingSatisfied = Boolean(selectedHostingItem);
  const careSatisfied = Boolean(selectedCareItem);
  const mandatoryStackReady = websiteSatisfied && domainSatisfied && hostingSatisfied;

  const sortedCartItems = [...cartItems].sort((a, b) => stepSortRank(a) - stepSortRank(b));

  // Financial calculations
  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const grandTotal = cartSubtotal;

  const handleMarkPaid = async (id: string) => {
    const confirmed = await pulse.confirm({
      title: 'Mark invoice as PAID?',
      detail: 'This will manually mark the invoice as settled and update linked client subscription records.',
      confirmLabel: 'Confirm Payment',
    });
    if (!confirmed) return;
    await pulse.track(
      () => markPaidMutation.mutateAsync(id),
      {
        pending: 'Marking invoice as paid…',
        success: 'Invoice marked as PAID',
        scope: 'invoices',
      },
    );
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
      const msg = getApiErrorMessage(err) || 'Could not download invoice PDF.';
      setErrorMsg(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setErrorMsg('Please select a target client account to bill.');
      return;
    }
    if (!websiteSatisfied) {
      setActiveStep(1);
      setStep1SubTab('websites');
      setErrorMsg('Step 1 Required: Select an Existing Website (KSh 0 / $0) or a New Website Package first.');
      return;
    }
    if (!domainSatisfied) {
      setActiveStep(2);
      setErrorMsg('Step 2 Required: Select Connect Existing Domain (KSh 0 / $0) or a New Domain Registration.');
      return;
    }
    if (!hostingSatisfied) {
      setActiveStep(3);
      setErrorMsg('Step 3 Required: Select a Managed Cloud Hosting package and billing cycle.');
      return;
    }
    if (grandTotal <= 0) {
      setErrorMsg('Invoice total must be greater than zero.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payloadLineItems = sortedCartItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));

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
      setDomainNameInput('');
      setActiveStep(1);
      setStep1SubTab('websites');
      setNotes('Payment terms: Net 14 days. Bank wire or M-Pesa accepted.');
      invoicesQuery.refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate invoice.';
      setErrorMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
    } finally {
      setSubmitting(false);
    }
  };

  const stepCatalogItems = SERVICE_CATALOG.filter((item) => {
    const q = catalogSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.tagline.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (activeStep === 1) {
      if (step1SubTab === 'websites') {
        return item.category === 'websites' && item.id !== 'rate-extra-page';
      }
      return item.category === 'addons' || item.id === 'rate-extra-page';
    }
    if (activeStep === 2) return item.category === 'domains';
    if (activeStep === 3) return item.category === 'hosting';
    if (activeStep === 4) return item.category === 'care';
    return false;
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

      {/* ── Guided 4-Step Mandatory Stack Invoice Generation Modal ─────────────── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-6xl w-full shadow-2xl border border-slate-100 my-auto flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0F172A] text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">Generate Professional B2B Invoice</h3>
                  <p className="text-[11px] text-slate-400">
                    Guided 4-Step Mandatory Stack Configurator: 1. Website &amp; Add-Ons &rarr; 2. Domain &rarr; 3. Managed Hosting &rarr; 4. Care Plan (Optional)
                  </p>
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

            {/* Unified 4-Step Progress Bar (Mirrors Public Store & Pricing Flow) */}
            <div className="bg-slate-900 px-4 sm:px-6 py-2.5 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
              {[
                {
                  step: 1 as const,
                  label: COMMERCIAL_FLOW_STEPS[0].shortTitle,
                  done: websiteSatisfied,
                  mandatory: true,
                  icon: Layout,
                },
                {
                  step: 2 as const,
                  label: COMMERCIAL_FLOW_STEPS[1].shortTitle,
                  done: domainSatisfied,
                  mandatory: true,
                  icon: Globe,
                },
                {
                  step: 3 as const,
                  label: COMMERCIAL_FLOW_STEPS[2].shortTitle,
                  done: hostingSatisfied,
                  mandatory: true,
                  icon: Server,
                },
                {
                  step: 4 as const,
                  label: COMMERCIAL_FLOW_STEPS[3].shortTitle,
                  done: careSatisfied,
                  mandatory: false,
                  icon: Wrench,
                },
              ].map((s) => {
                const Icon = s.icon;
                const isActive = activeStep === s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(s.step)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all border ${
                      isActive
                        ? 'bg-[#2563EB] text-white border-blue-400 shadow-sm'
                        : s.done
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                        s.done
                          ? 'bg-emerald-500 text-slate-950'
                          : isActive
                          ? 'bg-white text-[#2563EB]'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {s.done ? <Check className="w-3 h-3 stroke-[3]" /> : s.step}
                    </span>
                    <Icon className="w-3.5 h-3.5 opacity-80" />
                    <span>{s.label}</span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                        s.done
                          ? 'bg-emerald-400/20 text-emerald-200'
                          : s.mandatory
                          ? 'bg-amber-400/20 text-amber-200'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {s.done ? 'Done' : s.mandatory ? 'Required' : 'Optional'}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setActiveStep('custom')}
                className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all border ${
                  activeStep === 'custom'
                    ? 'bg-[#2563EB] text-white border-blue-400'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>+ Custom Line</span>
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Body - 2 Columns (Left: Guided Step Configurator, Right: Mandatory Stack & Cart) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* LEFT: Guided Step Picker (7 Cols) */}
              <div className="lg:col-span-7 p-5 sm:p-6 overflow-y-auto max-h-[72vh] space-y-4">
                {/* Step Context Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      {activeStep === 1 && COMMERCIAL_FLOW_STEPS[0].title}
                      {activeStep === 2 && COMMERCIAL_FLOW_STEPS[1].title}
                      {activeStep === 3 && COMMERCIAL_FLOW_STEPS[2].title}
                      {activeStep === 4 && COMMERCIAL_FLOW_STEPS[3].title}
                      {activeStep === 'custom' && 'Add Bespoke / Custom Milestone Line'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {activeStep === 1 && COMMERCIAL_FLOW_STEPS[0].subtitle}
                      {activeStep === 2 && COMMERCIAL_FLOW_STEPS[1].subtitle}
                      {activeStep === 3 && COMMERCIAL_FLOW_STEPS[2].subtitle}
                      {activeStep === 4 && COMMERCIAL_FLOW_STEPS[3].subtitle}
                      {activeStep === 'custom' &&
                        'Add custom consulting, custom SLA deposits, or bespoke engineering line items.'}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-lg">
                    Active Currency: <strong className="text-slate-900">{currency}</strong>
                  </span>
                </div>

                {/* Sequential Mandatory Step Guard Banners (mirrors PricingView) */}
                {activeStep === 2 && !websiteSatisfied && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Step 1 Required First:</strong> Select an Existing Website ({formatMoney(0, currency)}) or a New Build Package in Step 1.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStep(1);
                        setStep1SubTab('websites');
                      }}
                      className="font-extrabold text-[#2563EB] hover:underline shrink-0"
                    >
                      Go to Step 1 &rarr;
                    </button>
                  </div>
                )}

                {activeStep === 3 && (!websiteSatisfied || !domainSatisfied) && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Complete Prior Mandatory Steps:</strong>{' '}
                        {!websiteSatisfied
                          ? 'Step 1 (Website / App) is required before finalizing.'
                          : 'Step 2 (Domain Name) is required before finalizing.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveStep(!websiteSatisfied ? 1 : 2)}
                      className="font-extrabold text-[#2563EB] hover:underline shrink-0"
                    >
                      Go to Step {!websiteSatisfied ? 1 : 2} &rarr;
                    </button>
                  </div>
                )}

                {/* Step 1 Sub-Tabs: 1A Website Foundation vs 1B Feature Add-Ons */}
                {activeStep === 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setStep1SubTab('websites')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          step1SubTab === 'websites'
                            ? 'bg-[#0F172A] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Layout className="w-3.5 h-3.5" />
                        <span>1A · Website / App Foundation (Required)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep1SubTab('addons')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          step1SubTab === 'addons'
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Puzzle className="w-3.5 h-3.5" />
                        <span>
                          1B · Optional Add-Ons &amp; Extra Pages
                          {selectedAddonsCount > 0 ? ` (${selectedAddonsCount})` : ''}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2 Domain Name Input */}
                {activeStep === 2 && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                    <label
                      htmlFor="admin-invoice-domain-input"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-600"
                    >
                      Client Domain Name (Optional — embedded on the invoice line item)
                    </label>
                    <input
                      id="admin-invoice-domain-input"
                      type="text"
                      value={domainNameInput}
                      onChange={(e) => setDomainNameInput(e.target.value)}
                      placeholder="e.g. clientbusiness.co.ke or company.com"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                )}

                {/* Interactive 6-Cycle Commitment Selector for Step 3 (Hosting) & Step 4 (Care Plans) */}
                {(activeStep === 3 || activeStep === 4) && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                        Select Billing Cycle &amp; Commitment Discount
                      </span>
                      {activeStep === 4 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedCareItem) {
                              handleRemoveCartItem(selectedCareItem.id);
                            }
                          }}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline"
                        >
                          {selectedCareItem
                            ? 'Remove Care Plan (Use Standard Warranty)'
                            : 'Optional — Standard Warranty Included'}
                        </button>
                      )}
                    </div>
                    <div
                      role="group"
                      aria-label="Billing commitment cycles"
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      {BILLING_CYCLES_META.map((meta) => {
                        const currentCycle = activeStep === 3 ? hostingCycle : careCycle;
                        const isSelected = currentCycle === meta.cycle;
                        const pillText =
                          activeStep === 4 && meta.cycle === 'annually'
                            ? '1 Year (-20%)'
                            : meta.pillLabel;
                        return (
                          <button
                            key={meta.cycle}
                            type="button"
                            onClick={() =>
                              handleStepCycleChange(activeStep === 3 ? 'hosting' : 'care', meta.cycle)
                            }
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 border ${
                              isSelected
                                ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            <span>{pillText}</span>
                            {meta.popular && !isSelected && (
                              <span className="text-[9px] bg-blue-50 text-[#2563EB] px-1.5 py-0.5 rounded-full font-extrabold">
                                Popular
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Search Input within Current Step */}
                {activeStep !== 'custom' && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Filter options in this step…"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                )}

                {/* Catalog Grid or Custom Item Form */}
                {activeStep === 'custom' ? (
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {stepCatalogItems.map((service) => {
                      const options: BillingOption[] | undefined = getServiceBillingOptions(service, currency);
                      const activeCardCycle = getEffectiveCardCycle(service);
                      const selectedOpt = options?.find((o) => o.cycle === activeCardCycle) || options?.[0];
                      const displayAmount = selectedOpt ? selectedOpt.amount : getItemPrice(service, currency);
                      const inCartItem = cartItems.find((i) => i.serviceId === service.id);
                      const isZeroOnboarding =
                        service.id === 'website-existing' || service.id === 'domain-existing';

                      return (
                        <div
                          key={service.id}
                          className={`p-3.5 rounded-2xl shadow-2xs transition-all flex flex-col justify-between gap-2.5 border-2 ${
                            inCartItem
                              ? 'border-emerald-500 bg-emerald-50/30'
                              : isZeroOnboarding
                              ? 'border-[#14B8A6] bg-teal-50/30 hover:shadow-xs'
                              : 'border-slate-200 bg-white hover:border-blue-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1.5 mb-1">
                              <h4 className="font-bold text-xs text-slate-900 leading-snug">{service.name}</h4>
                              {service.badge && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold shrink-0 ${
                                    isZeroOnboarding
                                      ? 'bg-[#14B8A6] text-slate-950'
                                      : 'bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  {service.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2">{service.tagline}</p>
                          </div>

                          {/* Per-Card Billing Cycle Dropdown when service supports multi-cycle commitments */}
                          {options && options.length > 0 && (
                            <div className="pt-1.5 border-t border-slate-100">
                              <label
                                htmlFor={`cycle-select-${service.id}`}
                                className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1"
                              >
                                Billing Cycle
                              </label>
                              <select
                                id={`cycle-select-${service.id}`}
                                value={activeCardCycle}
                                onChange={(e) => {
                                  const nextCycle = e.target.value as CommitmentCycle;
                                  setCardCycleOverrides((prev) => ({ ...prev, [service.id]: nextCycle }));
                                  if (inCartItem) {
                                    handleUpdateCartItemCycle(inCartItem.id, nextCycle);
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 text-[11px] font-bold bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                              >
                                {options.map((opt) => (
                                  <option key={opt.cycle} value={opt.cycle}>
                                    {opt.label}
                                    {opt.discountPct > 0 ? ` (-${opt.discountPct}%)` : ''} —{' '}
                                    {formatMoney(opt.amount, currency)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 gap-2">
                            <div>
                              <span className="font-black text-sm text-slate-900">
                                {displayAmount === 0
                                  ? `${formatMoney(0, currency)} (Included)`
                                  : formatMoney(displayAmount, currency)}
                              </span>
                              {selectedOpt ? (
                                <span className="block text-[10px] text-emerald-700 font-bold">
                                  {selectedOpt.periodMonths === 1
                                    ? 'Billed monthly'
                                    : `${selectedOpt.formattedMonthly} eq. · ${
                                        selectedOpt.discountPct > 0
                                          ? `Save ${selectedOpt.discountPct}%`
                                          : 'Standard'
                                      }`}
                                </span>
                              ) : (
                                service.period !== 'one-time' && (
                                  <span className="text-[10px] text-slate-400 font-medium ml-1">
                                    /{service.period === 'year' ? 'yr' : 'mo'}
                                  </span>
                                )
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleAddServiceToCart(
                                  service,
                                  selectedOpt?.cycle,
                                  service.category === 'domains' || service.category === 'hosting',
                                )
                              }
                              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 shrink-0 ${
                                inCartItem
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-slate-900 text-white hover:bg-[#2563EB]'
                              }`}
                            >
                              {inCartItem ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>
                                    {classifyServiceStep(service) === 'addon' ? '+ Add Another' : 'Selected'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Select</span>
                                </>
                              )}
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

                {/* Guided Step Footer Navigation (Mirrors StoreView Step Progression) */}
                {activeStep === 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <span className="text-xs text-slate-500">
                      {websiteSatisfied
                        ? `Step 1 Selected: ${selectedWebsiteItem?.description}`
                        : 'Select an Existing Website or New Build Package above to complete Step 1.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveStep(2)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shrink-0"
                    >
                      <span>Continue to Step 2: Domain</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <span className="text-xs text-slate-500">
                      {domainSatisfied
                        ? `Step 2 Selected: ${selectedDomainItem?.description}`
                        : 'Select Existing Domain or New Domain Registration to complete Step 2.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveStep(3)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shrink-0"
                    >
                      <span>Continue to Step 3: Hosting</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <span className="text-xs text-slate-500">
                      {hostingSatisfied
                        ? `Step 3 Selected: ${selectedHostingItem?.description}`
                        : 'Select a Managed Cloud Hosting package above to complete Step 3.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveStep(4)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shrink-0"
                    >
                      <span>Step 4: Care Plan (Optional)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT: Mandatory Stack Checklist, Target Client & Active Cart (5 Cols) */}
              <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between max-h-[72vh] overflow-y-auto space-y-4 bg-slate-50/70">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-blue-600" /> Invoice Target &amp; Stack Cart
                    </span>
                    {cartItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCartItems([])}
                        className="text-[11px] text-red-600 hover:underline font-semibold"
                      >
                        Clear Stack
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
                          onChange={(e) => handleCurrencyChange(e.target.value as SettlementCurrency)}
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

                  {/* Mandatory 4-Step Stack Flow Checklist (Mirrors StoreOrderSummary) */}
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Mandatory Public-Site Stack Flow
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveStep(1);
                          setStep1SubTab('websites');
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border text-left font-semibold flex items-center gap-1.5 transition-colors ${
                          websiteSatisfied
                            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                            : 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70'
                        }`}
                      >
                        {websiteSatisfied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span className="truncate">1. Website {websiteSatisfied ? '✓' : '(Req)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveStep(2)}
                        className={`px-2.5 py-1.5 rounded-xl border text-left font-semibold flex items-center gap-1.5 transition-colors ${
                          domainSatisfied
                            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                            : 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70'
                        }`}
                      >
                        {domainSatisfied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span className="truncate">2. Domain {domainSatisfied ? '✓' : '(Req)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveStep(3)}
                        className={`px-2.5 py-1.5 rounded-xl border text-left font-semibold flex items-center gap-1.5 transition-colors ${
                          hostingSatisfied
                            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                            : 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70'
                        }`}
                      >
                        {hostingSatisfied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span className="truncate">3. Hosting {hostingSatisfied ? '✓' : '(Req)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveStep(4)}
                        className={`px-2.5 py-1.5 rounded-xl border text-left font-semibold flex items-center gap-1.5 transition-colors ${
                          careSatisfied
                            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {careSatisfied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">4. Care {careSatisfied ? '✓' : '(Opt)'}</span>
                      </button>
                    </div>
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

                  {/* Active Line Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>Billed Services Stack ({sortedCartItems.length})</span>
                      <span className="text-[11px] text-slate-400 font-normal">Ordered Step 1 &rarr; 4</span>
                    </div>

                    {sortedCartItems.length === 0 ? (
                      <div className="p-5 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white space-y-1">
                        <ShoppingCart className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-slate-600">Start with Step 1 (Website / App)</p>
                        <p className="text-[11px] text-slate-400">
                          Follow Steps 1 &rarr; 2 &rarr; 3 &rarr; 4 on the left to build the client&apos;s stack.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {sortedCartItems.map((item) => {
                          const catalogService = item.serviceId
                            ? SERVICE_CATALOG.find((s) => s.id === item.serviceId)
                            : undefined;
                          const itemBillingOptions = catalogService
                            ? getServiceBillingOptions(catalogService, currency)
                            : undefined;

                          return (
                            <div
                              key={item.id}
                              className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-2 shadow-2xs"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] font-bold text-blue-600 block">
                                  {stepBadgeLabel(item)}
                                </span>
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
                                      onChange={(e) =>
                                        handleUpdateCartItemPrice(item.id, parseFloat(e.target.value) || 0)
                                      }
                                      className="w-16 px-1 py-0.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded text-right"
                                    />
                                  </div>
                                </div>

                                {itemBillingOptions && itemBillingOptions.length > 0 && (
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-500 font-semibold shrink-0">Cycle:</span>
                                    <select
                                      aria-label={`Billing cycle for ${item.description}`}
                                      value={item.cycle || 'annually'}
                                      onChange={(e) =>
                                        handleUpdateCartItemCycle(item.id, e.target.value as CommitmentCycle)
                                      }
                                      className="w-full text-[10px] font-bold bg-blue-50/90 border border-blue-200 text-blue-900 rounded-lg px-1.5 py-1 focus:ring-1 focus:ring-blue-500"
                                    >
                                      {itemBillingOptions.map((opt) => (
                                        <option key={opt.cycle} value={opt.cycle}>
                                          {opt.label} ({opt.discountPct > 0 ? `-${opt.discountPct}%` : 'Standard'}) —{' '}
                                          {formatMoney(opt.amount, currency)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 pt-1">
                                <span className="text-xs font-black text-slate-900">
                                  {item.quantity * item.unitPrice === 0
                                    ? `Included`
                                    : formatMoney(item.quantity * item.unitPrice, currency)}
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
                          );
                        })}
                      </div>
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
                        Total: {formatMoney(cartSubtotal, currency)}
                      </span>
                    </div>
                    <div className="text-xl font-black text-emerald-400">
                      {formatMoney(grandTotal, currency)}
                    </div>
                  </div>

                  {!mandatoryStackReady && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 font-medium">
                      Complete mandatory steps before issuing:{' '}
                      {[
                        !websiteSatisfied && 'Step 1 (Website)',
                        !domainSatisfied && 'Step 2 (Domain)',
                        !hostingSatisfied && 'Step 3 (Hosting)',
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      .
                    </p>
                  )}

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
                      disabled={submitting || !mandatoryStackReady || !clientId}
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
