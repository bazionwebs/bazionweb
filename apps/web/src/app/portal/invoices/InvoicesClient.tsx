'use client';

import React from 'react';
import {
  Download,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useClientInvoices, useClientProfile } from '@/hooks/usePortalData';
import { TableSkeletonRows, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatMoney, formatDate, titleCase, providerLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  PAID: {
    color: 'bg-emerald-100 text-emerald-800',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  OVERDUE: {
    color: 'bg-rose-100 text-rose-800',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  PENDING: {
    color: 'bg-amber-100 text-amber-800',
    icon: <Clock className="w-3 h-3" />,
  },
  CANCELLED: {
    color: 'bg-slate-100 text-slate-600',
    icon: null,
  },
};

export default function InvoicesClient() {
  const { data: liveInvoices = [], isLoading, isError, refetch } = useClientInvoices();
  const { data: liveClient } = useClientProfile();

  const activeSubscription = liveClient?.subscriptions?.[0];
  const planPrice = activeSubscription?.plan?.priceMonthly ?? liveClient?.plan?.priceMonthly;
  const paidInvoices = liveInvoices.filter(i => i.status === 'PAID');
  const overdueInvoices = liveInvoices.filter(i => i.status === 'OVERDUE');
  const pendingInvoices = liveInvoices.filter(i => i.status === 'PENDING');
  const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl font-extrabold text-[#0F172A]">Invoices & Cloud Care Subscriptions</h2>
        <p className="text-xs text-slate-400 mt-1">
          Itemized commercial statements with official KRA eTIMS tax receipts and direct M-Pesa statements.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{paidInvoices.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Paid Invoices</div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            {formatMoney(totalPaid)} total
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{pendingInvoices.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Pending</div>
          <div className="text-[11px] font-semibold text-amber-600 mt-1">Awaiting payment</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{overdueInvoices.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Overdue</div>
          <div className="text-[11px] font-semibold text-rose-600 mt-1">
            {overdueInvoices.length === 0 ? 'All clear' : 'Action required'}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {planPrice !== undefined && planPrice !== null ? formatMoney(planPrice) : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Monthly Rate</div>
          <div className="text-[11px] font-semibold text-blue-600 mt-1">Auto-renew active</div>
        </div>
      </div>

      {/* Active Subscription Banner */}
      {(activeSubscription || liveClient?.plan) && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              Active Subscription
            </span>
            <h3 className="text-base font-bold text-[#0F172A] mt-1">
              {activeSubscription?.plan?.name ?? liveClient?.plan?.name ?? '—'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {planPrice !== undefined && planPrice !== null
                ? `${formatMoney(planPrice)} / mo`
                : 'No active plan'}{' '}
              · Next cycle:{' '}
              {activeSubscription?.renewalDate
                ? formatDate(activeSubscription.renewalDate)
                : '—'}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-400">Payment Channel</div>
            <div className="text-xs font-bold text-[#0F172A] mt-0.5">
              {providerLabel(activeSubscription?.provider)}
            </div>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2563EB]" />
            Invoice History ({liveInvoices.length})
          </h3>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 text-left">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Currency</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Issued</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeletonRows rows={4} cols={8} />
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6">
                    <QueryError message="Your invoices couldn't be loaded." onRetry={() => refetch()} />
                  </td>
                </tr>
              ) : liveInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10">
                    <EmptyState
                      title="No invoices yet"
                      hint="Invoices appear here after your first billing cycle."
                    />
                  </td>
                </tr>
              ) : (
                liveInvoices.map(inv => {
                  const sc = statusConfig[inv.status] ?? statusConfig.PENDING;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-500">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#0F172A] max-w-xs truncate">
                        {inv.notes ?? 'Cloud Care subscription billing'}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatMoney(inv.amount, inv.currency)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{inv.currency}</td>
                      <td className="py-3 px-4">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold', sc.color)}>
                          {sc.icon}
                          {titleCase(inv.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatDate(inv.dueDate)}</td>
                      <td className="py-3 px-4 text-slate-400">{formatDate(inv.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        {inv.pdfUrl ? (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 font-medium">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
