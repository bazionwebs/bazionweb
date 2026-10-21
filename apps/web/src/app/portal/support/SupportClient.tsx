'use client';

import React, { useState } from 'react';
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Ticket,
} from 'lucide-react';
import {
  useClientTickets,
  useCreateTicket,
} from '@/hooks/usePortalData';
import { TableSkeletonRows, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatDate, titleCase, shortId } from '@/lib/format';
import { cn } from '@/lib/utils';

const PRIORITY_MAP: Record<string, string> = {
  Critical: 'P1',
  Urgent: 'P2',
  Normal: 'P3',
};
const TICKET_CATEGORIES = [
  'HOSTING', 'DEVELOPMENT', 'MAINTENANCE', 'SECURITY', 'BILLING', 'PERFORMANCE', 'OTHER',
];

const SLA_TARGETS: Record<string, string> = {
  P1: '4 hours',
  P2: '8 hours',
  P3: '24 hours',
  P4: '72 hours',
};

const priorityColor = (p: string) => {
  if (p === 'P1') return 'bg-red-100 text-red-800 border border-red-200';
  if (p === 'P2') return 'bg-amber-100 text-amber-800 border border-amber-200';
  if (p === 'P3') return 'bg-blue-100 text-blue-800 border border-blue-200';
  return 'bg-slate-100 text-slate-700';
};

const statusColor = (s: string) => {
  if (s === 'RESOLVED' || s === 'CLOSED') return 'bg-emerald-100 text-emerald-800';
  if (s === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800';
  return 'bg-amber-100 text-amber-800';
};

export default function SupportClient() {
  const {
    data: liveTickets = [],
    isLoading,
    isError,
    refetch,
  } = useClientTickets();
  const createTicket = useCreateTicket();

  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [category, setCategory] = useState('HOSTING');
  const [body, setBody] = useState('');
  const [ticketError, setTicketError] = useState<string | null>(null);

  const openTickets = liveTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const resolvedTickets = liveTickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || body.trim().length < 20 || createTicket.isPending) return;
    setTicketError(null);
    createTicket.mutate(
      {
        subject: subject.trim(),
        priority: PRIORITY_MAP[priority] ?? 'P3',
        category,
        body: body.trim(),
      },
      {
        onSuccess: () => {
          setSubject('');
          setBody('');
          setPriority('Normal');
          setCategory('HOSTING');
          setShowModal(false);
        },
        onError: () => setTicketError('Could not submit your request. Please try again.'),
      },
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F172A]">Direct Engineering Support</h2>
          <p className="text-xs text-slate-400 mt-1">
            Submit sprint modifications or technical tickets with transparent SLA response countdowns.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          New Engineering Request
        </button>
      </div>

      {/* SLA Guarantee Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(SLA_TARGETS).map(([priority, target]) => (
          <div key={priority} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs text-center">
            <div className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-bold mb-2', priorityColor(priority))}>
              {priority}
            </div>
            <div className="text-sm font-black text-[#0F172A] flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
              {target}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Response SLA</div>
          </div>
        ))}
      </div>

      {/* Active Tickets */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
            <Ticket className="w-4 h-4 text-amber-500" />
            Active Requests ({openTickets.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 text-left">
              <tr>
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">SLA Target</th>
                <th className="py-3 px-4">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeletonRows rows={4} cols={7} />
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6">
                    <QueryError message="Your requests couldn't be loaded." onRetry={() => refetch()} />
                  </td>
                </tr>
              ) : openTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <EmptyState
                      title="No active requests"
                      hint="All issues are resolved. Submit a new request above."
                    />
                  </td>
                </tr>
              ) : (
                openTickets.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-400">
                      #{shortId(t.id, 6)}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#0F172A] max-w-xs">
                      <div className="truncate">{t.subject}</div>
                      {t.slaBreached && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-rose-600 font-bold">
                          <AlertTriangle className="w-3 h-3" /> SLA Breached
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', priorityColor(t.priority))}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', statusColor(t.status))}>
                        {titleCase(t.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{titleCase(t.category)}</td>
                    <td className="py-3 px-4 text-slate-500">{SLA_TARGETS[t.priority] ?? '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{formatDate(t.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolved Tickets */}
      {resolvedTickets.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Resolved History ({resolvedTickets.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 text-left">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resolvedTickets.slice(0, 8).map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 opacity-75">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-400">#{shortId(t.id, 6)}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-600 max-w-xs truncate">{t.subject}</td>
                    <td className="py-2.5 px-4">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', priorityColor(t.priority))}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {titleCase(t.status)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{titleCase(t.category)}</td>
                    <td className="py-2.5 px-4 text-slate-400">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Submit Engineering Request</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assigned to your lead engineer under the 4-Hour SLA Guarantee.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Request Description</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Update emergency contact phone on landing page"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Priority Level</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  >
                    <option value="Normal">Normal (Standard)</option>
                    <option value="Urgent">Urgent (8hr SLA)</option>
                    <option value="Critical">Critical (4hr SLA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  >
                    {TICKET_CATEGORIES.map(c => (
                      <option key={c} value={c}>{titleCase(c)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Detailed Description <span className="text-slate-400 font-normal">(min. 20 chars)</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Describe the issue, where it happens, and what you expected to happen…"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none resize-none"
                />
              </div>

              {ticketError && (
                <p className="text-xs font-semibold text-rose-600">{ticketError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createTicket.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {createTicket.isPending ? 'Submitting…' : 'Submit to Engineering'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
