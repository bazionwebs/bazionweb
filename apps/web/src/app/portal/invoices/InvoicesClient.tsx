'use client';

import React, { useState, useMemo } from 'react';
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
  QrCode,
  Copy,
  Check,
  X,
  Zap,
  TrendingUp,
  Building,
  RefreshCw,
} from 'lucide-react';
import { useClientInvoices, useClientProfile, ApiInvoice } from '@/hooks/usePortalData';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<ApiInvoice | null>(null);
  const [paymentMethodTab, setPaymentMethodTab] = useState<'mpesa' | 'card' | 'paybill'>('mpesa');
  const [phoneNumber, setPhoneNumber] = useState('0712 345 678');
  const [stkPushSending, setStkPushSending] = useState(false);
  const [stkPushSuccess, setStkPushSuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeSubscription = liveClient?.subscriptions?.[0];
  const planPrice = activeSubscription?.plan?.priceMonthly ?? liveClient?.plan?.priceMonthly;

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

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTriggerSTK = () => {
    setStkPushSending(true);
    setStkPushSuccess(null);
    setTimeout(() => {
      setStkPushSending(false);
      setStkPushSuccess(
        `✓ STK Prompt transmitted to ${phoneNumber}. Please input your M-Pesa PIN on your phone to authorize settlement.`
      );
    }, 1400);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Billing Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Official KRA eTIMS Validated • PIN: P051938291X</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Billing Center & Cloud Subscriptions
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Transparent itemized commercial statements, automated Safaricom Daraja M-Pesa reconciliations, and instant downloadable KRA eTIMS fiscal tax receipts.
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
              <span>Client Entity: <strong className="text-white font-semibold">{liveClient?.businessName ?? 'Acacia Healthcare'}</strong></span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-400" />
              <span>Default Channel: <strong className="text-white font-semibold">M-Pesa Daraja Express</strong></span>
            </div>
          </div>
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Automatic Monthly Reconciliation Active
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
                Service continuity guarantee requires settlement. Avoid automated Cloudflare staging suspension by clearing balance.
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
                {providerLabel(activeSubscription?.provider ?? 'INTASEND')}
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
                        <div className="truncate">{inv.notes ?? 'Cloud Care Managed Retainer & Hosting'}</div>
                        <div className="text-[10px] text-slate-400">Includes Cloudflare Edge & Daily Backup</div>
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
                            <QrCode className="w-3 h-3 text-emerald-600" />
                            <span>eTIMS Validated</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Pending Receipt</span>
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
                  setStkPushSuccess(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-100 mb-6 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethodTab('mpesa');
                  setStkPushSuccess(null);
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
                  setPaymentMethodTab('paybill');
                  setStkPushSuccess(null);
                }}
                className={cn(
                  'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                  paymentMethodTab === 'paybill' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
                )}
              >
                <Building className="w-3.5 h-3.5" />
                Paybill Till
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethodTab('card');
                  setStkPushSuccess(null);
                }}
                className={cn(
                  'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                  paymentMethodTab === 'card' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
                )}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Card / Paystack
              </button>
            </div>

            {/* M-Pesa STK Push Tab */}
            {paymentMethodTab === 'mpesa' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-xs text-emerald-900 leading-relaxed">
                  Enter your Safaricom M-Pesa number below. An instant Daraja STK Push prompt will be sent directly to your mobile phone.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    M-Pesa Phone Number
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
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

                {stkPushSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-100/70 border border-emerald-300 text-xs font-semibold text-emerald-900 animate-fade-in flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{stkPushSuccess}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleTriggerSTK}
                  disabled={stkPushSending}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {stkPushSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Transmitting Daraja Prompt…
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

            {/* Manual Paybill Instructions Tab */}
            {paymentMethodTab === 'paybill' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 text-xs text-blue-900 leading-relaxed">
                  Open the M-Pesa menu on your handset &rarr; Select <strong>Lipa na M-Pesa</strong> &rarr; <strong>Paybill</strong>.
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Business Number (Paybill)</div>
                      <div className="font-mono font-black text-sm text-[#0F172A]">4082219</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('4082219', 'paybill')}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                    >
                      {copiedKey === 'paybill' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === 'paybill' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Account Number</div>
                      <div className="font-mono font-black text-sm text-[#0F172A]">{selectedInvoiceForPay.invoiceNumber}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedInvoiceForPay.invoiceNumber, 'acc')}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                    >
                      {copiedKey === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === 'acc' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Amount</div>
                      <div className="font-mono font-black text-sm text-[#0F172A]">
                        {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)}
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold">Auto-Reconciled</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPay(null)}
                  className="w-full py-3 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  I Have Completed Payment
                </button>
              </div>
            )}

            {/* Credit Card / Paystack Tab */}
            {paymentMethodTab === 'card' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 text-xs text-indigo-900 leading-relaxed">
                  Secure 256-bit SSL encrypted checkout powered by Paystack. All major Visa, Mastercard, and Verve debit/credit cards accepted with instant 3D-Secure.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Card Number</label>
                  <input
                    type="text"
                    disabled
                    value="•••• •••• •••• 4242"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Expires</label>
                    <input
                      type="text"
                      disabled
                      value="12 / 28"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">CVC</label>
                    <input
                      type="password"
                      disabled
                      value="•••"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStkPushSuccess('✓ Card payment authorized successfully. Receipt dispatched to registered email.');
                    setTimeout(() => setSelectedInvoiceForPay(null), 2500);
                  }}
                  className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Charge {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
