'use client';

import React, { useState } from 'react';
import {
  Search,
  AlertCircle,
  Plus,
  X,
} from 'lucide-react';
import { useAdminInvoices, useCanSeeBilling, useMarkInvoicePaid, useAdminClients } from '@/hooks/useAdminData';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatMoney, formatDate, shortId } from '@/lib/format';
import { adminApi } from '@/lib/api';

export default function AdminInvoicesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const rawInvoices = invoicesQuery.data?.items ?? [];
  const rawClients = clientsQuery.data?.items ?? [];

  const invoices = rawInvoices.map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber || `INV-${shortId(inv.id, 6)}`,
    clientName: inv.client?.businessName || 'Client',
    amount: Number(inv.amount || 0),
    currency: inv.currency || 'USD',
    status: inv.status || 'SENT',
    dueDate: inv.dueDate ? formatDate(inv.dueDate) : '—',
    createdAt: inv.createdAt ? formatDate(inv.createdAt) : '—',
  }));

  const filteredInvoices = invoices.filter(i => {
    const matchesSearch =
      i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.clientName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBilled = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.amount, 0);
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE');
  const overdueTotal = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);

  const handleMarkPaid = async (id: string) => {
    if (confirm('Are you sure you want to manually mark this invoice as PAID? This will update subscription records.')) {
      await markPaidMutation.mutateAsync(id);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await adminApi.generateInvoice({
        clientId,
        amount: parseFloat(amount),
        notes,
      });
      setShowGenerateModal(false);
      setClientId('');
      setAmount('');
      setNotes('');
      invoicesQuery.refetch();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to generate invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Invoices & Receivables Ledger</h2>
          <p className="text-xs text-slate-500">Corporate invoices, automated payment verification, and manual reconciliation</p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Invoice</span>
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
          <div className="text-[11px] text-slate-400 mt-1">Reconciled via Paystack</div>
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
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoice # or client name…"
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'PAID', 'OVERDUE', 'SENT', 'DRAFT'].map(st => (
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
                {filteredInvoices.map(inv => (
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
                      {inv.status !== 'PAID' && (
                        <button
                          onClick={() => handleMarkPaid(inv.id)}
                          disabled={markPaidMutation.isPending}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Generate Invoice Modal ───────────────────────────────────────────── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Generate B2B Invoice</h3>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleGenerateInvoice} className="py-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Client *</label>
                <select
                  required
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  <option value="">-- Choose Client --</option>
                  {rawClients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.businessName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (USD) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="e.g. 299.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Scope Description</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Quarterly Managed Cloud retainer & security SLA..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Generating…' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
