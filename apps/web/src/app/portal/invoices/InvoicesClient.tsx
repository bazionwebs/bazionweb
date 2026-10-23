'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Smartphone,
  ShieldCheck,
  X,
  Zap,
  TrendingUp,
  Building,
  RefreshCw,
} from 'lucide-react';
import {
  useClientInvoices,
  useClientProfile,
  usePayInvoiceMpesa,
  usePayInvoiceCard,
  ApiInvoice,
} from '@/hooks/usePortalData';
import { TableSkeletonRows, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatMoney, formatDate, titleCase, providerLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  PAID: {
    color: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  OVERDUE: {
    color: 'bg-rose-100 text-rose-800 border border-rose-200',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  PENDING: {
    color: 'bg-amber-100 text-amber-800 border border-amber-200',
    icon: <Clock className="w-3 h-3" />,
  },
  CANCELLED: {
    color: 'bg-slate-100 text-slate-600 border border-slate-200',
    icon: null,
  },
};

export default function InvoicesClient() {
  const { data: liveInvoices = [], isLoading, isError, refetch } = useClientInvoices();
  const { data: liveClient } = useClientProfile();
  const mpesaPay = usePayInvoiceMpesa();
  const cardPay = usePayInvoiceCard();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<ApiInvoice | null>(null);
  const [paymentMethodTab, setPaymentMethodTab] = useState<'mpesa' | 'card'>('mpesa');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [stkResult, setStkResult] = useState<{ message: string; provider: string; invoiceNumber: string } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [cardReturnNotice, setCardReturnNotice] = useState(false);

  const activeSubscription = liveClient?.subscriptions?.[0];
  const planPrice = activeSubscription?.plan?.priceMonthly ?? liveClient?.plan?.priceMonthly;

  // Detect the return from a Paystack card redirect (?card_settled=1).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.search.includes('card_settled=1')) {
      setCardReturnNotice(true);
      refetch();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refetch]);

  const paidInvoices = useMemo(() => liveInvoices.filter(i => i.status === 'PAID'), [liveInvoices]);
  const overdueInvoices = useMemo(() => liveInvoices.filter(i => i.status === 'OVERDUE'), [liveInvoices]);
  const pendingInvoices = useMemo(() => liveInvoices.filter(i => i.status === 'PENDING'), [liveInvoices]);

  const totalPaid = useMemo(
    () => paidInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [paidInvoices]
  );
  const totalPending = useMemo(
    () => pendingInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [pendingInvoices]
  );
  const totalOverdue = useMemo(
    () => overdueInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [overdueInvoices]
  );

  const filteredInvoices = useMemo(() => {
    return liveInvoices.filter(inv => {
      const matchSearch =
        !searchQuery.trim() ||
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.notes && inv.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [liveInvoices, searchQuery, statusFilter]);

  const handleTriggerSTK = async () => {
    if (!selectedInvoiceForPay || mpesaPay.isPending) return;
    const phone = phoneNumber.trim() || liveClient?.phone;
    if (!phone) {
      setPayError('Please enter a valid M-Pesa phone number.');
      return;
    }
    setPayError(null);
    try {
      const res = await mpesaPay.mutateAsync({
        invoiceId: selectedInvoiceForPay.id,
        mpesaPhoneNumber: phone,
      }) as { data?: { message?: string; provider?: string; invoiceNumber?: string }; message?: string; provider?: string; invoiceNumber?: string };
      const payload = res?.data ?? res;
      setStkResult({
        message: payload?.message || 'M-Pesa prompt sent! Check your handset and enter PIN to complete.',
        provider: payload?.provider || 'DARAJA',
        invoiceNumber: payload?.invoiceNumber || selectedInvoiceForPay.invoiceNumber,
      });
      setTimeout(() => refetch(), 10000);
      setTimeout(() => refetch(), 30000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error?.response?.data?.message;
      setPayError(msg || 'Could not send the M-Pesa prompt. Check the number and try again.');
    }
  };

  const handleCardPay = async () => {
    if (!selectedInvoiceForPay || cardPay.isPending) return;
    setPayError(null);
    try {
      const res = await cardPay.mutateAsync({ invoiceId: selectedInvoiceForPay.id }) as { data?: { checkoutUrl?: string }; checkoutUrl?: string };
      const payload = res?.data ?? res;
      if (payload?.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
      } else {
        setPayError('Card checkout could not be opened. Please try again.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error?.response?.data?.message;
      setPayError(msg || 'Card checkout could not be opened. Please try again.');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Return notice after Paystack redirect */}
      {cardReturnNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            Your card payment was received. Account statements have been refreshed.
          </span>
          <button
            type="button"
            onClick={() => setCardReturnNotice(false)}
            className="p-1 text-emerald-700 hover:text-emerald-900 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner / Billing Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>M-Pesa & Card Payments Settled Automatically</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Billing Center & Cloud Subscriptions
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Itemized commercial statements with real-time status. Settle invoices by M-Pesa STK Push or card — payments reconcile to the exact invoice automatically.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Statements
            </button>
            {pendingInvoices.length > 0 && (
              <button
                onClick={() => setSelectedInvoiceForPay(pendingInvoices[0])}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
              >
                <Smartphone className="w-4 h-4" />
                Pay Pending ({pendingInvoices.length})
              </button>
            )}
          </div>
        </div>

        {/* Quick Highlights Under Header */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              <span>Client Entity: <strong className="text-white font-semibold">{liveClient?.businessName ?? 'Your organization'}</strong></span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-400" />
              <span>Invoices on Record: <strong className="text-white font-semibold">{liveInvoices.length}</strong></span>
            </div>
          </div>
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {pendingInvoices.length + overdueInvoices.length} invoice{(pendingInvoices.length + overdueInvoices.length) !== 1 ? 's' : ''} awaiting settlement
          </span>
        </div>
      </div>

      {/* Overdue Warning Callout (if any overdue) */}
      {overdueInvoices.length > 0 && (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-rose-900">
                Action Required: {overdueInvoices.length} Overdue Invoice ({formatMoney(totalOverdue)})
              </div>
              <p className="text-xs text-rose-700 mt-0.5">
                Service continuity requires settlement. Please clear your balance to maintain uninterrupted access.
              </p>
            </div>
          </div>

          <button
            onClick={() => setSelectedInvoiceForPay(overdueInvoices[0])}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors shrink-0 flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5" />
            Clear Overdue Balance
          </button>
        </div>
      )}

      {/* Summary KPI Cards with trend indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> 100% On-Time
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A]">{paidInvoices.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Settled Invoices</div>
          </div>
          <div className="text-xs font-bold text-emerald-700 mt-3 pt-3 border-t border-slate-100">
            {formatMoney(totalPaid)} lifetime
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                Pending Net 14
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A]">{pendingInvoices.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Awaiting Settlement</div>
          </div>
          <div className="text-xs font-bold text-amber-700 mt-3 pt-3 border-t border-slate-100">
            {pendingInvoices.length > 0 ? `${formatMoney(totalPending)} due` : 'Zero balance due'}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                overdueInvoices.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              )}>
                {overdueInvoices.length === 0 ? 'Status Clean' : 'Action Required'}
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A]">{overdueInvoices.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Overdue Accounts</div>
          </div>
          <div className={cn(
            'text-xs font-bold mt-3 pt-3 border-t border-slate-100',
            overdueInvoices.length === 0 ? 'text-slate-400' : 'text-rose-600'
          )}>
            {overdueInvoices.length === 0 ? 'All accounts up to date' : `${formatMoney(totalOverdue)} overdue`}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                Cloud Care
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A]">
              {planPrice !== undefined && planPrice !== null ? formatMoney(planPrice) : 'KES 14,500'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Monthly SLA Retainer</div>
          </div>
          <div className="text-xs font-bold text-blue-700 mt-3 pt-3 border-t border-slate-100">
            Next renewal: Nov 01, 2026
          </div>
        </div>
      </div>

      {/* Active Subscription Spotlight Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold mb-2">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span>Active Cloud Care & Hosting Tier</span>
            </div>
            <h2 className="text-xl font-black text-[#0F172A]">
              {activeSubscription?.plan?.name ?? liveClient?.plan?.name ?? 'Growth Cloud Care & Enterprise SLA'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Fully managed infrastructure retainer covering zero-downtime Cloudflare Edge CDN, 4-hour emergency SLA, offsite S3 backups, and monthly performance audits.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 min-w-[260px] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Monthly Plan Fee:</span>
              <span className="font-extrabold text-[#0F172A]">
                {planPrice !== undefined && planPrice !== null ? formatMoney(planPrice) : 'KES 14,500'} / mo
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Next Billing Cycle:</span>
              <span className="font-semibold text-slate-700">
                {activeSubscription?.renewalDate ? formatDate(activeSubscription.renewalDate) : 'Nov 01, 2026'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Payment Channel:</span>
              <span className="font-bold text-emerald-700">
                {providerLabel(activeSubscription?.provider ?? 'PAYSTACK')}
              </span>
            </div>
          </div>
        </div>

        {/* Retainer Inclusions */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>99.99% Uptime Guarantee</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Daily Automated Backups</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>4-Hour Incident SLA</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>KRA eTIMS Validated</span>
          </div>
        </div>
      </div>

      {/* Invoices History Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filter Bar */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-[#0F172A] text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2563EB]" />
              Commercial Statement History ({filteredInvoices.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Official tax invoices backed by KRA Control Unit signatures.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice #…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
              {(['ALL', 'PAID', 'PENDING', 'OVERDUE'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    'px-3 py-1 rounded-lg transition-all',
                    statusFilter === tab
                      ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  {tab === 'ALL' ? 'All' : tab === 'PAID' ? 'Paid' : tab === 'PENDING' ? 'Pending' : 'Overdue'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase text-slate-500 text-left">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Tax Validation</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Issued</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeletonRows rows={4} cols={8} />
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8">
                    <QueryError message="Your invoices could not be loaded." onRetry={() => refetch()} />
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      title={searchQuery ? 'No matching invoices' : 'No invoices on record'}
                      hint="Invoices appear here automatically following each monthly billing cycle."
                    />
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const sc = statusConfig[inv.status] ?? statusConfig.PENDING;
                  const isPaid = inv.status === 'PAID';
                  const isPendingOrOverdue = inv.status === 'PENDING' || inv.status === 'OVERDUE';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {inv.invoiceNumber}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-[#0F172A] max-w-xs">
                        <div className="truncate">{inv.notes || <span className="text-slate-400 italic">Subscription & Maintenance</span>}</div>
                      </td>

                      <td className="py-3.5 px-4 font-black text-[#0F172A]">
                        {formatMoney(inv.amount, inv.currency)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold', sc.color)}>
                          {sc.icon}
                          {titleCase(inv.status)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isPaid ? (
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                            <FileText className="w-3 h-3 text-emerald-600" />
                            <span>Receipt On Record</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Pending Settlement</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {formatDate(inv.dueDate)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {formatDate(inv.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {isPendingOrOverdue && (
                            <button
                              onClick={() => setSelectedInvoiceForPay(inv)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
                            >
                              <Smartphone className="w-3 h-3" />
                              Pay Now
                            </button>
                          )}

                          {inv.pdfUrl ? (
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                              PDF
                            </a>
                          ) : (
                            <button
                              onClick={() => window.print()}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                              Receipt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Pay Now Modal */}
      {selectedInvoiceForPay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-xl font-black text-[#0F172A]">Direct Invoice Checkout</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Invoice <span className="font-mono font-bold text-slate-700">{selectedInvoiceForPay.invoiceNumber}</span> • {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedInvoiceForPay(null);
                  setStkResult(null);
                  setPayError(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 mb-6 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethodTab('mpesa');
                  setPayError(null);
                }}
                className={cn(
                  'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                  paymentMethodTab === 'mpesa' ? 'bg-white text-emerald-700 shadow-xs' : 'hover:text-slate-900'
                )}
              >
                <Smartphone className="w-3.5 h-3.5" />
                M-Pesa STK
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethodTab('card');
                  setPayError(null);
                }}
                className={cn(
                  'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                  paymentMethodTab === 'card' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
                )}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Card Checkout
              </button>
            </div>

            {/* M-Pesa STK Push Tab */}
            {paymentMethodTab === 'mpesa' && (
              <div className="space-y-4">
                {stkResult ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>M-Pesa prompt sent</strong> — {stkResult.message}
                        <br />
                        Invoice <span className="font-mono font-bold">{stkResult.invoiceNumber}</span> will settle automatically upon PIN confirmation.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceForPay(null);
                        setStkResult(null);
                      }}
                      className="w-full py-3 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      Done — Watching for Prompt
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-xs text-emerald-900 leading-relaxed">
                      Enter your Safaricom M-Pesa number. An instant STK Push prompt will be sent directly to your phone.
                    </div>

                    {selectedInvoiceForPay.currency !== 'KES' && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                        This invoice is billed in {selectedInvoiceForPay.currency}. M-Pesa supports KES invoices; please use the card checkout option instead.
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        M-Pesa Phone Number
                      </label>
                      <input
                        type="text"
                        value={phoneNumber || liveClient?.phone || ''}
                        onChange={e => setPhoneNumber(e.target.value)}
                        placeholder="0712 345 678"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
                      <span className="text-slate-500">Payable Balance:</span>
                      <span className="text-base font-black text-[#0F172A]">
                        {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)}
                      </span>
                    </div>

                    {payError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900">
                        {payError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleTriggerSTK}
                      disabled={mpesaPay.isPending || selectedInvoiceForPay.currency !== 'KES'}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mpesaPay.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Sending M-Pesa Prompt…
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4" />
                          Send M-Pesa STK Push
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Card / Paystack Tab */}
            {paymentMethodTab === 'card' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 text-xs text-indigo-900 leading-relaxed">
                  Pay securely via card. You will be redirected to complete the 3D-Secure payment through our payment partner Paystack.
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
                  <span className="text-slate-500">Payable Balance:</span>
                  <span className="text-base font-black text-[#0F172A]">
                    {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)}
                  </span>
                </div>

                {payError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900">
                    {payError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCardPay}
                  disabled={cardPay.isPending}
                  className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cardPay.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Opening Secure Checkout…
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pay {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)} by Card
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
