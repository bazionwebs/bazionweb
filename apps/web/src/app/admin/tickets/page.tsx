'use client';

import React, { useState } from 'react';
import {
  Ticket,
  Filter,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  UserCheck,
  Download,
  X,
  MessageSquare,
} from 'lucide-react';
import { useAdminTickets, useUpdateTicket } from '@/hooks/useAdminData';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';
import { timeAgo, shortId } from '@/lib/format';

export default function AdminTicketsPage() {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  const ticketsQuery = useAdminTickets();
  const updateTicketMutation = useUpdateTicket();

  const rawTickets = ticketsQuery.data?.items ?? [];

  const tickets = rawTickets.map(t => {
    const assigneeName =
      t.assignee && (t.assignee.firstName || t.assignee.lastName)
        ? `${t.assignee.firstName ?? ''} ${t.assignee.lastName ?? ''}`.trim()
        : 'Unassigned';

    return {
      raw: t,
      id: `#${shortId(t.id, 4)}`,
      rawId: t.id,
      client: t.client?.businessName ?? '—',
      subject: t.subject,
      priority: t.priority,
      status: t.status,
      category: t.category ?? 'OTHER',
      assignee: assigneeName,
      slaBreached: !!t.slaBreached,
      age: timeAgo(t.createdAt),
      createdDate: t.createdAt ? new Date(t.createdAt).toLocaleString() : '—',
    };
  });

  const filteredTickets = tickets.filter(t => {
    const matchesSearch =
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.client.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const openCount = tickets.filter(t => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const pendingClientCount = tickets.filter(t => t.status === 'PENDING_CLIENT').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
  const breachedCount = tickets.filter(t => t.slaBreached).length;

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    await updateTicketMutation.mutateAsync({ id: ticketId, status: newStatus });
    if (selectedTicket && selectedTicket.rawId === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Support Tickets & SLA Queue</h2>
          <p className="text-xs text-slate-500">Live multi-tier support dispatch, priority escalation, and SLA commitments</p>
        </div>

        {breachedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />
            <span>{breachedCount} Tickets Breached Target SLA</span>
          </div>
        )}
      </div>

      {/* ── Status Tally Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open Queue', count: openCount, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', status: 'OPEN' },
          { label: 'In Progress', count: inProgressCount, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', status: 'IN_PROGRESS' },
          { label: 'Pending Client', count: pendingClientCount, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', status: 'PENDING_CLIENT' },
          { label: 'Resolved / Closed', count: resolvedCount, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', status: 'RESOLVED' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(statusFilter === s.status ? 'ALL' : s.status)}
            className={`p-4 rounded-2xl bg-white border ${s.border} shadow-sm text-center transition-all hover:shadow-md ${
              statusFilter === s.status ? 'ring-2 ring-[#2563EB]' : ''
            }`}
          >
            <div className={`text-2xl font-black ${s.color} mb-0.5`}>{s.count}</div>
            <div className="text-xs text-slate-500 font-medium">{s.label}</div>
          </button>
        ))}
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets, clients, or ID…"
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Priority:</span>
          {['ALL', 'P1', 'P2', 'P3', 'P4'].map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                priorityFilter === p
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tickets Table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {ticketsQuery.isLoading ? (
          <div className="p-8">
            <SectionLoading label="Loading support ticket queue…" />
          </div>
        ) : ticketsQuery.isError ? (
          <div className="p-8">
            <QueryError message="Could not load tickets queue." onRetry={() => ticketsQuery.refetch()} />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No tickets found" hint="No tickets match the selected filters." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-left">
                <tr>
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Subject & Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Age</th>
                  <th className="py-3 px-4">SLA State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTickets.map(t => (
                  <tr key={t.rawId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{t.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{t.client}</td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 truncate">{t.subject}</div>
                      <div className="text-[10px] text-slate-400 capitalize">{t.category.toLowerCase()}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.priority === 'P1'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : t.priority === 'P2'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'OPEN'
                            ? 'bg-red-100 text-red-800'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : t.status === 'PENDING_CLIENT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={t.assignee === 'Unassigned' ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                        {t.assignee}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{t.age}</td>
                    <td className="py-3 px-4">
                      {t.slaBreached ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-red-600">
                          <AlertTriangle className="w-3.5 h-3.5" /> Breached
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> OK
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className="px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Triage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Triage & Status Update Modal ────────────────────────────────────── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400">{selectedTicket.id}</span>
                <h3 className="font-bold text-slate-900 text-base">{selectedTicket.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-slate-400 font-medium">Client</div>
                  <div className="text-slate-900 font-bold mt-0.5">{selectedTicket.client}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-slate-400 font-medium">Priority</div>
                  <div className="text-slate-900 font-bold mt-0.5">{selectedTicket.priority}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-slate-400 font-medium">Current Status</div>
                  <div className="text-slate-900 font-bold mt-0.5">{selectedTicket.status.replace('_', ' ')}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-slate-400 font-medium">Created Time</div>
                  <div className="text-slate-900 font-semibold mt-0.5">{selectedTicket.createdDate}</div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Change Ticket Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {['OPEN', 'IN_PROGRESS', 'PENDING_CLIENT', 'RESOLVED', 'CLOSED'].map(st => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(selectedTicket.rawId, st)}
                      disabled={updateTicketMutation.isPending}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between ${
                        selectedTicket.status === st
                          ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{st.replace('_', ' ')}</span>
                      {selectedTicket.status === st && <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
