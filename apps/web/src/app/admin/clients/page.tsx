'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  ExternalLink,
  X,
  AlertCircle,
} from 'lucide-react';
import { useAdminClients, useAdminHosting } from '@/hooks/useAdminData';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatDate } from '@/lib/format';
import { adminApi } from '@/lib/api';

export default function AdminClientsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const clientsQuery = useAdminClients();
  const hostingQuery = useAdminHosting();

  const domainByClient: Record<string, string> = {};
  (hostingQuery.data?.items ?? []).forEach(h => {
    if (h.clientId && !domainByClient[h.clientId]) domainByClient[h.clientId] = h.domain;
  });

  const rawClients = clientsQuery.data?.items ?? [];

  const clients = rawClients.map(c => {
    const hasActiveSub = (c.subscriptions?.length ?? 0) > 0;
    const price = Number(c.plan?.priceMonthly ?? 0);
    return {
      id: c.id,
      name: c.businessName,
      contact: c.contactName || '—',
      email: c.email || '—',
      domain: domainByClient[c.id] ?? '—',
      plan: c.plan?.name ?? 'Standard',
      tier: c.plan?.tier ?? 'GROWTH',
      status: c.status,
      tickets: c._count?.tickets ?? 0,
      mrr: hasActiveSub ? price : 0,
      renewal: c.subscriptions?.[0]?.renewalDate ? formatDate(c.subscriptions[0].renewalDate) : '—',
    };
  });

  const filteredClients = clients.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.domain.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await adminApi.createClient({
        businessName,
        contactName,
        email,
        phone,
      });
      setShowAddModal(false);
      setBusinessName('');
      setContactName('');
      setEmail('');
      setPhone('');
      clientsQuery.refetch();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to create client. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header Controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Clients & Organizations</h2>
          <p className="text-xs text-slate-500">Manage client accounts, assigned subscriptions, and domains</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* ── Filters & Search Bar ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, domain, or email…"
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Clients' : st}
            </button>
          ))}
        </div>
      </div>

      {/* ── Clients Data Table ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {clientsQuery.isLoading ? (
          <div className="p-8">
            <SectionLoading label="Loading client directory…" />
          </div>
        ) : clientsQuery.isError ? (
          <div className="p-8">
            <QueryError message="Could not load clients directory." onRetry={() => clientsQuery.refetch()} />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No clients found" hint="Try adjusting your search criteria or add a new client." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-left">
                <tr>
                  <th className="py-3 px-4">Client & Contact</th>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Plan Tier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Tickets</th>
                  <th className="py-3 px-4">MRR</th>
                  <th className="py-3 px-4">Renewal</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredClients.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{c.name}</div>
                      <div className="text-[11px] font-normal text-slate-400">{c.contact} • {c.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {c.domain !== '—' ? (
                        <a
                          href={`https://${c.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2563EB] hover:underline inline-flex items-center gap-1"
                        >
                          {c.domain}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {c.plan}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'TRIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.tickets > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          {c.tickets}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {c.mrr > 0 ? `$${c.mrr}` : <span className="text-slate-300 font-normal">—</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{c.renewal}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedClient(c)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-[#2563EB] hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Client Detail Drawer / Modal ─────────────────────────────────────── */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedClient.name}</h3>
                <p className="text-xs text-slate-400">Client ID: {selectedClient.id}</p>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Domain</div>
                  <div className="text-slate-900 font-mono font-bold mt-0.5">{selectedClient.domain}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Plan Tier</div>
                  <div className="text-slate-900 font-bold mt-0.5">{selectedClient.plan}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Status</div>
                  <div className="text-slate-900 font-bold mt-0.5">{selectedClient.status}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Monthly MRR</div>
                  <div className="text-slate-900 font-bold mt-0.5">${selectedClient.mrr}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-slate-400 font-medium">Contact Details</div>
                <div className="text-slate-800 font-semibold mt-1">{selectedClient.contact}</div>
                <div className="text-slate-600">{selectedClient.email}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
              <Link
                href={`/admin/troubleshooting?impersonate=${selectedClient.id}`}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
              >
                Inspect as Client →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Client Modal ─────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add New Client Account</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddClient} className="py-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="e.g. Acacia Healthcare Ltd"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person *</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="e.g. Dr. Sarah Kamau"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="sarah@acaciahealthcare.co.ke"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+254 712 345 678"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
