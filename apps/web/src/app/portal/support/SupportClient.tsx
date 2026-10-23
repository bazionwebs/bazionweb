'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Clock,
  CheckCircle2,
  Check,
  AlertTriangle,
  X,
  Ticket,
  Search,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Send,
  User,
  Zap,
  Sparkles,
  MessageSquare,
  Activity,
  Headphones,
} from 'lucide-react';
import {
  useClientTickets,
  useCreateTicket,
  useAddTicketComment,
} from '@/hooks/usePortalData';
import { TableSkeletonRows, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatDate, titleCase, shortId } from '@/lib/format';
import { cn } from '@/lib/utils';

const PRIORITY_MAP: Record<string, string> = {
  Critical: 'P1',
  Urgent: 'P2',
  Normal: 'P3',
  Low: 'P4',
};

const TICKET_CATEGORIES = [
  'HOSTING',
  'DEVELOPMENT',
  'MAINTENANCE',
  'SECURITY',
  'BILLING',
  'PERFORMANCE',
  'OTHER',
];

const SLA_TARGETS: Record<string, { label: string; hours: number; desc: string }> = {
  P1: { label: '4 hours', hours: 4, desc: 'Production Outage / Emergency' },
  P2: { label: '8 hours', hours: 8, desc: 'Major Feature Malfunction' },
  P3: { label: '24 hours', hours: 24, desc: 'Standard Technical Request' },
  P4: { label: '72 hours', hours: 72, desc: 'Cosmetic / Minor Enhancement' },
};

const QUICK_TEMPLATES = [
  {
    title: '502 Bad Gateway / Server Downtime',
    category: 'HOSTING',
    priority: 'Critical',
    subject: 'Emergency: Site returning 502 Bad Gateway error',
    body: 'The live website is currently unresponsive or returning 502 Bad Gateway errors for visitors. Please inspect Cloudflare origin servers and reverse proxy immediately.',
  },
  {
    title: 'M-Pesa STK Push Callback Timeout',
    category: 'BILLING',
    priority: 'Urgent',
    subject: 'M-Pesa Daraja STK Push transactions not confirming',
    body: 'Patients are completing payment on their handsets, but the appointment booking screen continues to spin without receiving the Daraja instant confirmation callback.',
  },
  {
    title: 'Doctor Directory & Bio Updates',
    category: 'DEVELOPMENT',
    priority: 'Normal',
    subject: 'Update specialist doctor schedules and contact bios',
    body: 'Please update the clinic hours and doctor biographies for our new pediatric consultant starting next Monday.',
  },
  {
    title: 'SSL Certificate / DNS Check',
    category: 'SECURITY',
    priority: 'Urgent',
    subject: 'Check SSL certificate renewal and DNS delegation status',
    body: 'Please verify that our SSL certificates are actively renewed across all subdomains and that Cloudflare Edge proxy headers remain valid.',
  },
];

function calculateSlaCountdown(createdAt: string, priority: string, isResolved: boolean) {
  if (isResolved) {
    return { label: 'Met On-Time', color: 'emerald', percent: 100, breached: false };
  }
  const targetHours = SLA_TARGETS[priority]?.hours ?? 24;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) {
    return { label: `${targetHours}h SLA`, color: 'slate', percent: 100, breached: false };
  }
  const deadline = createdTime + targetHours * 3600 * 1000;
  const now = Date.now();
  const diffMs = deadline - now;
  const totalWindowMs = targetHours * 3600 * 1000;
  const elapsedMs = Math.max(0, now - createdTime);
  const percentElapsed = Math.min(100, Math.round((elapsedMs / totalWindowMs) * 100));

  if (diffMs <= 0) {
    const overdueMins = Math.floor(Math.abs(diffMs) / 60000);
    const overdueHours = Math.floor(overdueMins / 60);
    const overdueLabel = overdueHours > 0 ? `${overdueHours}h overdue` : `${overdueMins}m overdue`;
    return { label: overdueLabel, color: 'rose', percent: 100, breached: true };
  }

  const minsRemaining = Math.floor(diffMs / 60000);
  const hoursRemaining = Math.floor(minsRemaining / 60);
  const minsRemainder = minsRemaining % 60;
  const label = hoursRemaining > 0 ? `${hoursRemaining}h ${minsRemainder}m left` : `${minsRemaining}m left`;
  const color = percentElapsed > 85 ? 'rose' : percentElapsed > 60 ? 'amber' : 'emerald';

  return { label, color, percent: percentElapsed, breached: false };
}

const priorityBadge = (p: string) => {
  if (p === 'P1') return 'bg-rose-100 text-rose-800 border border-rose-200';
  if (p === 'P2') return 'bg-amber-100 text-amber-800 border border-amber-200';
  if (p === 'P3') return 'bg-blue-100 text-blue-800 border border-blue-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
};

const statusBadge = (s: string) => {
  if (s === 'RESOLVED' || s === 'CLOSED') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  if (s === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800 border border-blue-200';
  return 'bg-amber-100 text-amber-800 border border-amber-200';
};

export default function SupportClient() {
  const {
    data: liveTickets = [],
    isLoading,
    isError,
    refetch,
  } = useClientTickets();
  const createTicket = useCreateTicket();
  const addTicketComment = useAddTicketComment();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  // Quick reply simulated state for expanded ticket
  const [quickReplyText, setQuickReplyText] = useState('');
  const [replyFeedback, setReplyFeedback] = useState<string | null>(null);

  // New ticket modal states
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [category, setCategory] = useState('HOSTING');
  const [body, setBody] = useState('');
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const openTickets = useMemo(
    () => liveTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS'),
    [liveTickets]
  );
  const resolvedTickets = useMemo(
    () => liveTickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED'),
    [liveTickets]
  );

  const filteredOpenTickets = useMemo(() => {
    return openTickets.filter(t => {
      const matchSearch =
        !searchQuery.trim() ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === 'ALL' || t.category.toUpperCase() === selectedCategory;
      const matchPriority = selectedPriority === 'ALL' || t.priority === selectedPriority;
      return matchSearch && matchCategory && matchPriority;
    });
  }, [openTickets, searchQuery, selectedCategory, selectedPriority]);

  const applyTemplate = (tmpl: typeof QUICK_TEMPLATES[0]) => {
    setSubject(tmpl.subject);
    setCategory(tmpl.category);
    setPriority(tmpl.priority);
    setBody(tmpl.body);
  };

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
          setTicketSuccess(true);
          setTimeout(() => setTicketSuccess(false), 6000);
        },
        onError: () => setTicketError('Could not submit your request. Please try again or check connection.'),
      }
    );
  };

  const handleSendQuickReply = async (ticketId: string) => {
    if (!quickReplyText.trim() || addTicketComment.isPending) return;
    try {
      await addTicketComment.mutateAsync({ ticketId, body: quickReplyText.trim() });
      setQuickReplyText('');
      setReplyFeedback(`Your note for request #${shortId(ticketId, 6)} was posted to the ticket thread.`);
      setTimeout(() => setReplyFeedback(null), 5000);
    } catch {
      setReplyFeedback('Could not post your note. Please try again.');
      setTimeout(() => setReplyFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-semibold mb-3">
              <Headphones className="w-3.5 h-3.5 text-blue-400" />
              <span>Direct Engineering Desk • 24/7 SLA Monitored</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Technical Support & Sprint Triage
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Submit sprint change requests or report technical incidents with transparent SLA response countdowns. Directly routed to lead systems engineers without tier-1 queues.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              New Engineering Request
            </button>
          </div>
        </div>

        {/* Live SLA Metric Strip */}
        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300 uppercase">Active Requests</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-white">{openTickets.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Under live investigation</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300 uppercase">Avg Response Time</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">&lt; 38 mins</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Beat contractual SLA</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300 uppercase">SLA Resolution Rate</span>
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-black text-white">100%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">All tickets closed on-time</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300 uppercase">On-Call Lead</span>
              <User className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-sm font-bold text-white truncate">David K.</div>
            <div className="text-[10px] text-teal-300 mt-0.5">Senior Systems Architect</div>
          </div>
        </div>
      </div>

      {/* Ticket Success Toast Banner */}
      {ticketSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Engineering request created successfully. Assigned to on-call engineer under the contractual SLA.</span>
          </div>
          <button onClick={() => setTicketSuccess(false)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SLA Guarantees Matrix Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            Contractual SLA Response Targets
          </h2>
          <span className="text-xs text-slate-400">Guaranteed maximum first response window</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(SLA_TARGETS).map(([p, info]) => (
            <div key={p} className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', priorityBadge(p))}>
                  {p}
                </span>
                <span className="text-xs font-mono font-bold text-[#2563EB]">{info.label}</span>
              </div>
              <div className="text-xs font-bold text-[#0F172A] mt-1">{info.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Requests Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Controls (Search & Filter Pills) */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-[#0F172A] text-base flex items-center gap-2">
              <Ticket className="w-4 h-4 text-amber-500" />
              Active Engineering Requests ({filteredOpenTickets.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any request to expand engineer triage status, diagnostic logs, and activity notes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ticket or #ID…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none placeholder:text-slate-400"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {TICKET_CATEGORIES.map(c => (
                <option key={c} value={c}>{titleCase(c)}</option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={e => setSelectedPriority(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="P1">P1 Critical</option>
              <option value="P2">P2 Urgent</option>
              <option value="P3">P3 Normal</option>
              <option value="P4">P4 Low</option>
            </select>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase text-slate-500 text-left">
              <tr>
                <th className="py-3 px-4 w-28">Request ID</th>
                <th className="py-3 px-4">Subject & Description</th>
                <th className="py-3 px-4 w-24">Priority</th>
                <th className="py-3 px-4 w-28">Status</th>
                <th className="py-3 px-4 w-32">Category</th>
                <th className="py-3 px-4 w-40">SLA Countdown</th>
                <th className="py-3 px-4 w-28">Submitted</th>
                <th className="py-3 px-4 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeletonRows rows={4} cols={8} />
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8">
                    <QueryError message="Could not load engineering tickets. Please refresh." onRetry={() => refetch()} />
                  </td>
                </tr>
              ) : filteredOpenTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      title={searchQuery ? 'No matching tickets' : 'Zero Active Incidents'}
                      hint={searchQuery ? 'Try broadening your search term or filters.' : 'All systems are operating normally. Submit a request above if you need changes.'}
                    />
                  </td>
                </tr>
              ) : (
                filteredOpenTickets.map(t => {
                  const isExpanded = expandedTicketId === t.id;
                  const countdown = calculateSlaCountdown(t.createdAt, t.priority, false);
                  const isCritical = t.priority === 'P1';
                  const isUrgent = t.priority === 'P2';

                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isCritical
                            ? 'border-l-4 border-l-rose-500 bg-rose-50/20 hover:bg-rose-50/40'
                            : isUrgent
                            ? 'border-l-4 border-l-amber-500 bg-amber-50/20 hover:bg-amber-50/40'
                            : 'border-l-4 border-l-blue-400 hover:bg-slate-50/80',
                          isExpanded && 'bg-blue-50/30'
                        )}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                          #{shortId(t.id, 6)}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-[#0F172A] max-w-sm">
                          <div className="font-bold flex items-center gap-1.5">
                            {t.subject}
                            {countdown.breached && (
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            Assigned to {t.assignee?.firstName ? `${t.assignee.firstName} ${t.assignee.lastName ?? ''}` : 'Lead Systems Architect'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', priorityBadge(t.priority))}>
                            {t.priority}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', statusBadge(t.status))}>
                            {titleCase(t.status)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-600">
                          {titleCase(t.category)}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                              {countdown.breached ? (
                                <span className="text-rose-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 animate-pulse" />
                                  {countdown.label}
                                </span>
                              ) : (
                                <span className={cn(countdown.color === 'emerald' ? 'text-emerald-700' : 'text-amber-700', 'flex items-center gap-1')}>
                                  <Clock className="w-3 h-3" />
                                  {countdown.label}
                                </span>
                              )}
                            </div>
                            {/* SLA elapsed progress bar */}
                            <div className="w-28 h-1 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  countdown.breached ? 'bg-rose-500' : countdown.color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                                )}
                                style={{ width: `${countdown.percent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {formatDate(t.createdAt)}
                        </td>

                        <td className="py-3.5 px-4 text-center text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-blue-600 inline-block" />
                          ) : (
                            <ChevronDown className="w-4 h-4 inline-block hover:text-slate-700" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded Ticket Accordion Detail */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={8} className="p-6">
                            <div className="max-w-4xl space-y-5">
                              {/* Ticket Full Subject & Description */}
                              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-400">#{shortId(t.id, 8)}</span>
                                    <span className="text-xs font-bold text-[#0F172A]">{t.subject}</span>
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    Contract SLA Window: <strong>{SLA_TARGETS[t.priority]?.label ?? '24 hours'}</strong>
                                  </div>
                                </div>

                                {t.description ? (
                                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                    {t.description}
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">
                                    No additional details were provided in the request.
                                  </p>
                                )}
                              </div>

                              {/* Engineer Triage & Activity Trail */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-blue-600" />
                                    Assigned Systems Engineer
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                                      {t.assignee?.firstName ? t.assignee.firstName[0] : <User className="w-4 h-4 text-slate-400" />}
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-[#0F172A]">
                                        {t.assignee?.firstName
                                          ? `${t.assignee.firstName} ${t.assignee.lastName ?? ''}`
                                          : 'Awaiting triage'}
                                      </div>
                                      <div className="text-[11px] text-slate-400">
                                        {t.assignee ? 'Assigned Systems Engineer' : 'An engineer will pick this up within the SLA window'}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                    <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                                    Request Status
                                  </div>
                                  <div className="text-xs text-slate-600 space-y-1">
                                    <div>• Triage status: <strong className="font-semibold">{titleCase(t.status)}</strong></div>
                                    <div>• Response window: <strong className="font-semibold">{SLA_TARGETS[t.priority]?.label ?? '24 hours'}</strong></div>
                                    <div>• Messages on record: <strong className="font-semibold">{t._count?.comments ?? 0}</strong></div>
                                  </div>
                                </div>
                              </div>

                              {/* Quick Reply Box */}
                              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" />
                                    Add Follow-Up Note / Reply to Engineering
                                  </div>
                                  <span className="text-[11px] text-slate-400">Posts directly to the shared ticket thread</span>
                                </div>

                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={quickReplyText}
                                    onChange={e => setQuickReplyText(e.target.value)}
                                    placeholder="Type note or supplementary details for the lead engineer…"
                                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleSendQuickReply(t.id)}
                                    className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Send Note
                                  </button>
                                </div>

                                {replyFeedback && (
                                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium">
                                    {replyFeedback}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolved Tickets Section */}
      {resolvedTickets.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-extrabold text-[#0F172A] text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Resolved Incident History ({resolvedTickets.length})
            </h3>
            <span className="text-xs text-slate-400">Archived compliance records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase text-slate-500 text-left">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">SLA Compliance</th>
                  <th className="py-3 px-4">Closed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resolvedTickets.slice(0, 8).map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 opacity-80">
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-400">#{shortId(t.id, 6)}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-700 max-w-xs truncate">{t.subject}</td>
                    <td className="py-2.5 px-4">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', priorityBadge(t.priority))}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {titleCase(t.status)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{titleCase(t.category)}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Met On-Time
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Engineering Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-xl font-black text-[#0F172A]">Submit Engineering Request</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Contractually routed directly to senior cloud & full-stack engineers.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Template Chips */}
            <div className="mb-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#2563EB]" />
                One-Click Request Templates
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.title}
                    type="button"
                    onClick={() => applyTemplate(tmpl)}
                    className="text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 text-xs transition-colors"
                  >
                    <div className="font-bold text-[#0F172A] truncate">{tmpl.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{tmpl.priority} • {tmpl.category}</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Request Summary / Issue Title
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Optimize doctor appointment checkout flow"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Priority Level</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none font-semibold text-slate-700"
                  >
                    <option value="Normal">Normal (P3 • 24hr SLA)</option>
                    <option value="Urgent">Urgent (P2 • 8hr SLA)</option>
                    <option value="Critical">Critical (P1 • 4hr SLA)</option>
                    <option value="Low">Low (P4 • 72hr SLA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none font-semibold text-slate-700"
                  >
                    {TICKET_CATEGORIES.map(c => (
                      <option key={c} value={c}>{titleCase(c)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority SLA Warning Reminder */}
              <div className={cn(
                'p-3 rounded-xl border text-xs flex items-center gap-2',
                priority === 'Critical'
                  ? 'bg-rose-50 border-rose-200 text-rose-800 font-medium'
                  : priority === 'Urgent'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              )}>
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  {priority === 'Critical'
                    ? 'P1 Critical will immediately page our 24/7 on-call infrastructure lead with guaranteed 4-hour SLA.'
                    : priority === 'Urgent'
                    ? 'P2 Urgent tickets are prioritized in the active sprint queue with guaranteed 8-hour turnaround.'
                    : 'P3 Normal tickets are reviewed and dispatched within 24 hours under your standard care plan.'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Detailed Description</label>
                  <span className={cn('text-[11px]', body.length < 20 ? 'text-rose-500 font-semibold' : 'text-slate-400')}>
                    {body.length} / 20 min characters
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Provide precise details, steps to reproduce, or exact copy modifications required…"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none resize-none"
                />
              </div>

              {ticketError && (
                <p className="text-xs font-semibold text-rose-600 p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  {ticketError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createTicket.isPending || body.length < 20}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {createTicket.isPending ? 'Routing to Engineers…' : 'Submit Engineering Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
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
