'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  Loader2,
} from 'lucide-react';
import {
  useClientTickets,
  useClientProfile,
  useCreateTicket,
  useAddTicketComment,
  useTicketComments,
} from '@/hooks/usePortalData';
import { TableSkeletonRows, QueryError, EmptyState } from '@/components/ui/QueryState';
import { WhatsAppLink } from '@/components/ui/WhatsAppChat';
import { formatDate, titleCase, shortId, timeAgo } from '@/lib/format';
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

const QUICK_TEMPLATES = [
  {
    title: 'Production Outage / 502 Error',
    category: 'HOSTING',
    priority: 'Critical',
    subject: 'Emergency: Production domain unresponsive or returning 5xx error',
    body: 'Our live application is currently unreachable or returning server errors for visitors. Please inspect edge routing, origin health, and upstream services immediately.',
  },
  {
    title: 'Payment Webhook / Checkout Check',
    category: 'BILLING',
    priority: 'Urgent',
    subject: 'Verify M-Pesa / Card payment settlement callback',
    body: 'A customer completed payment via M-Pesa / Card, and we need confirmation of the webhook settlement status and invoice reconciliation.',
  },
  {
    title: 'Feature / Copy / Page Update',
    category: 'DEVELOPMENT',
    priority: 'Normal',
    subject: 'Sprint update: Revise landing copy and add new section',
    body: 'Please update our main service section with refreshed copy and imagery, and deploy a preview link for review before publishing to production.',
  },
  {
    title: 'Domain DNS / SSL Cutover',
    category: 'SECURITY',
    priority: 'Urgent',
    subject: 'Coordinate DNS record update and TLS certificate check',
    body: 'We have uploaded our registrar credentials into the Encrypted Vault. Please verify DNS records and ensure automated TLS 1.3 renewal is active.',
  },
];

function formatWindowMinutes(mins: number): string {
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.round((mins / 60) * 10) / 10;
  return `${hrs} ${hrs === 1 ? 'hour' : 'hours'}`;
}

function calculateSlaCountdown(createdAt: string, targetMinutes: number, isResolved: boolean) {
  if (isResolved) {
    return { label: 'Met On-Time', color: 'emerald', percent: 100, breached: false };
  }
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) {
    return { label: formatWindowMinutes(targetMinutes), color: 'slate', percent: 100, breached: false };
  }
  const totalWindowMs = targetMinutes * 60 * 1000;
  const deadline = createdTime + totalWindowMs;
  const now = Date.now();
  const diffMs = deadline - now;
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
  const label =
    hoursRemaining > 0 ? `${hoursRemaining}h ${minsRemainder}m left` : `${minsRemaining}m left`;
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
  if (s === 'PENDING_CLIENT') return 'bg-purple-100 text-purple-800 border border-purple-200';
  return 'bg-amber-100 text-amber-800 border border-amber-200';
};

function TicketConversationThread({ ticketId }: { ticketId: string }) {
  const { data: comments = [], isLoading, isError } = useTicketComments(ticketId);
  const addTicketComment = useAddTicketComment();
  const [replyText, setReplyText] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || addTicketComment.isPending) return;
    setFeedback(null);
    try {
      await addTicketComment.mutateAsync({ ticketId, body: replyText.trim() });
      setReplyText('');
      setFeedback({ type: 'ok', text: 'Message posted to engineering thread.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setFeedback({ type: 'err', text: 'Could not send message. Please try again.' });
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" />
          Engineering Conversation Thread ({comments.length})
        </div>
        <span className="text-[11px] text-slate-400">Direct client ↔ engineer log</span>
      </div>

      {isLoading ? (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
          <span>Loading conversation…</span>
        </div>
      ) : isError ? (
        <div className="text-xs text-rose-600 py-3">Could not load ticket messages.</div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">
          No messages recorded yet. Add details or logs below for your assigned engineer.
        </p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
          {comments.map((c, idx) => {
            const role = c.author?.role ?? 'CLIENT';
            const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].includes(role);
            const authorName = c.author?.firstName
              ? `${c.author.firstName} ${c.author.lastName ?? ''}`.trim()
              : isStaff
                ? 'Systems Engineer'
                : 'You';

            return (
              <div
                key={c.id}
                className={cn(
                  'p-3.5 rounded-2xl border text-xs',
                  isStaff
                    ? 'bg-blue-50/50 border-blue-200/70 ml-0 mr-4'
                    : 'bg-slate-50 border-slate-200/80 ml-4 mr-0',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0F172A]">{authorName}</span>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                        isStaff ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700',
                      )}
                    >
                      {isStaff ? 'BazionWeb Engineer' : idx === 0 ? 'Initial Brief' : 'Client'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">{c.body}</p>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSend} className="pt-2 flex gap-2">
        <input
          type="text"
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="Reply or attach reproduction details for your engineer…"
          className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
        />
        <button
          type="submit"
          disabled={addTicketComment.isPending || !replyText.trim()}
          className="px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
        >
          {addTicketComment.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Send Reply
        </button>
      </form>

      {feedback && (
        <div
          className={cn(
            'p-2.5 rounded-xl text-xs font-medium',
            feedback.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800',
          )}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}

export default function SupportClient() {
  const {
    data: liveTickets = [],
    isLoading,
    isError,
    refetch,
  } = useClientTickets();
  const { data: liveClient } = useClientProfile();
  const createTicket = useCreateTicket();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  // New ticket modal states
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [category, setCategory] = useState('DEVELOPMENT');
  const [body, setBody] = useState('');
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  // Deep-link support (?ticket=<uuid> or ?category=DEVELOPMENT)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get('ticket');
    const catParam = params.get('category')?.toUpperCase();
    if (ticketParam) {
      setExpandedTicketId(ticketParam);
    }
    if (catParam && TICKET_CATEGORIES.includes(catParam)) {
      setCategory(catParam);
      setShowModal(true);
    }
  }, []);

  const activePlan = liveClient?.subscriptions?.[0]?.plan ?? liveClient?.plan;
  const slaTargets = useMemo(() => {
    const p1 = activePlan?.p1ResponseMinutes ?? 240;
    const p2 = activePlan?.p2ResponseMinutes ?? 480;
    const p3 = activePlan?.p3ResponseMinutes ?? 1440;
    const p4 = 4320;
    return {
      P1: { label: formatWindowMinutes(p1), minutes: p1, desc: 'Production Outage / Emergency' },
      P2: { label: formatWindowMinutes(p2), minutes: p2, desc: 'Major Feature Malfunction' },
      P3: { label: formatWindowMinutes(p3), minutes: p3, desc: 'Standard Technical Request' },
      P4: { label: formatWindowMinutes(p4), minutes: p4, desc: 'Minor Enhancement / Copy' },
    } as Record<string, { label: string; minutes: number; desc: string }>;
  }, [activePlan]);

  const openTickets = useMemo(
    () =>
      liveTickets.filter(
        t => t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'PENDING_CLIENT',
      ),
    [liveTickets],
  );
  const resolvedTickets = useMemo(
    () => liveTickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED'),
    [liveTickets],
  );

  const slaCompliancePct = useMemo(() => {
    if (liveTickets.length === 0) return '100%';
    const breached = liveTickets.filter(t => t.slaBreached).length;
    return `${Math.round(((liveTickets.length - breached) / liveTickets.length) * 100)}%`;
  }, [liveTickets]);

  const filteredOpenTickets = useMemo(() => {
    return openTickets.filter(t => {
      const matchSearch =
        !searchQuery.trim() ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory =
        selectedCategory === 'ALL' || t.category.toUpperCase() === selectedCategory;
      const matchPriority = selectedPriority === 'ALL' || t.priority === selectedPriority;
      return matchSearch && matchCategory && matchPriority;
    });
  }, [openTickets, searchQuery, selectedCategory, selectedPriority]);

  const applyTemplate = (tmpl: (typeof QUICK_TEMPLATES)[0]) => {
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
        onSuccess: res => {
          const createdId = (res?.data ?? res)?.id;
          setSubject('');
          setBody('');
          setPriority('Normal');
          setCategory('DEVELOPMENT');
          setShowModal(false);
          if (createdId) setExpandedTicketId(createdId);
          setTicketSuccess(true);
          setTimeout(() => setTicketSuccess(false), 6000);
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
          setTicketError(
            Array.isArray(msg)
              ? msg[0]
              : msg || 'Could not submit your request. Please check your connection and try again.',
          );
        },
      },
    );
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
              <span>Direct Engineering Desk • No Tier-1 Chatbots</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Technical Support &amp; Sprint Triage
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Submit sprint change requests or report technical incidents with live SLA countdowns and persistent engineering conversation threads.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setTicketError(null);
                setShowModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              New Engineering Request
            </button>
            <WhatsAppLink
              source="portal_support"
              message="Hello BazionWeb Support, I need urgent help with my project. I'm contacting you from the client portal."
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold transition-colors"
              iconClassName="h-4 w-4"
            >
              WhatsApp Escalation
            </WhatsAppLink>
          </div>
        </div>

        {/* Live Telemetry Strip */}
        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300 uppercase">Open Requests</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-white">{openTickets.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active in triage queue</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300 uppercase">P1 Emergency Window</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">{slaTargets.P1.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {liveClient?.subscriptions?.[0] ? `${activePlan?.name} SLA target` : 'Standard response target'}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300 uppercase">SLA Compliance</span>
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-black text-white">{slaCompliancePct}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {resolvedTickets.length} resolved on record
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300 uppercase">Routing Queue</span>
              <User className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-sm font-bold text-white truncate">Systems Architecture</div>
            <div className="text-[10px] text-teal-300 mt-0.5">Direct Senior Engineering</div>
          </div>
        </div>
      </div>

      {/* Ticket Success Toast Banner */}
      {ticketSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Engineering request opened and initial brief saved to your thread. Expand the ticket below to follow updates.
            </span>
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
            Response Targets by Severity
          </h2>
          <span className="text-xs text-slate-400">Maximum first-response window</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(slaTargets).map(([p, info]) => (
            <div
              key={p}
              className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between"
            >
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
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-[#0F172A] text-base flex items-center gap-2">
              <Ticket className="w-4 h-4 text-amber-500" />
              Active Engineering Requests ({filteredOpenTickets.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any row to view the full description, engineer replies, and post follow-up notes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {TICKET_CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </select>

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

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase text-slate-500 text-left">
              <tr>
                <th className="py-3 px-4 w-28">Request ID</th>
                <th className="py-3 px-4">Subject &amp; Preview</th>
                <th className="py-3 px-4 w-24">Priority</th>
                <th className="py-3 px-4 w-36">Status</th>
                <th className="py-3 px-4 w-32">Category</th>
                <th className="py-3 px-4 w-40">SLA Window</th>
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
                    <QueryError
                      message="Could not load engineering tickets. Please refresh."
                      onRetry={() => refetch()}
                    />
                  </td>
                </tr>
              ) : filteredOpenTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      title={searchQuery ? 'No matching tickets' : 'Zero Active Incidents'}
                      hint={
                        searchQuery
                          ? 'Try broadening your search term or filters.'
                          : 'No open requests in your queue. Click "New Engineering Request" above whenever you need support or sprint changes.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredOpenTickets.map(t => {
                  const isExpanded = expandedTicketId === t.id;
                  const targetMins = slaTargets[t.priority]?.minutes ?? 1440;
                  const countdown = calculateSlaCountdown(t.createdAt, targetMins, false);
                  const isCritical = t.priority === 'P1';
                  const isUrgent = t.priority === 'P2';
                  const openingBody = t.comments?.[0]?.body;

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
                          isExpanded && 'bg-blue-50/30',
                        )}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                          #{shortId(t.id, 6)}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-[#0F172A] max-w-sm">
                          <div className="font-bold flex items-center gap-1.5">
                            <span className="truncate">{t.subject}</span>
                            {countdown.breached && (
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {openingBody
                              ? openingBody
                              : t.assignee?.firstName
                                ? `Assigned to ${t.assignee.firstName} ${t.assignee.lastName ?? ''}`
                                : 'Routed to Systems Engineering'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', priorityBadge(t.priority))}>
                            {t.priority}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', statusBadge(t.status))}>
                            {t.status === 'PENDING_CLIENT' ? 'Awaiting Your Reply' : titleCase(t.status)}
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
                                <span
                                  className={cn(
                                    countdown.color === 'emerald' ? 'text-emerald-700' : 'text-amber-700',
                                    'flex items-center gap-1',
                                  )}
                                >
                                  <Clock className="w-3 h-3" />
                                  {countdown.label}
                                </span>
                              )}
                            </div>
                            <div className="w-28 h-1 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  countdown.breached
                                    ? 'bg-rose-500'
                                    : countdown.color === 'amber'
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500',
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

                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={8} className="p-6">
                            <div className="max-w-4xl space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-blue-600" />
                                    Assigned Engineer
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                                      {t.assignee?.firstName ? (
                                        t.assignee.firstName[0]
                                      ) : (
                                        <User className="w-4 h-4 text-blue-600" />
                                      )}
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-[#0F172A]">
                                        {t.assignee?.firstName
                                          ? `${t.assignee.firstName} ${t.assignee.lastName ?? ''}`
                                          : 'Systems Engineering Queue'}
                                      </div>
                                      <div className="text-[11px] text-slate-400">
                                        {t.assignee
                                          ? 'Assigned Lead Engineer'
                                          : `Target first response within ${slaTargets[t.priority]?.label ?? '24 hours'}`}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                    <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                                    Triage Metadata
                                  </div>
                                  <div className="text-xs text-slate-600 space-y-1">
                                    <div>
                                      • Reference: <strong className="font-mono">#{shortId(t.id, 8)}</strong>
                                    </div>
                                    <div>
                                      • Status: <strong>{titleCase(t.status)}</strong>
                                    </div>
                                    <div>
                                      • SLA Window: <strong>{slaTargets[t.priority]?.label ?? '24 hours'}</strong>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <TicketConversationThread ticketId={t.id} />
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
            <span className="text-xs text-slate-400">Click any row to review archive thread</span>
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
                  <th className="py-3 px-4">SLA Standing</th>
                  <th className="py-3 px-4">Resolved Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resolvedTickets.slice(0, 10).map(t => {
                  const isExpanded = expandedTicketId === t.id;
                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                        className="hover:bg-slate-50/70 cursor-pointer"
                      >
                        <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-400">
                          #{shortId(t.id, 6)}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-700 max-w-xs truncate">
                          {t.subject}
                        </td>
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
                          {t.slaBreached ? (
                            <span className="text-amber-700 font-bold text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Extended Window
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Met On-Time
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400">
                          {formatDate(t.resolvedAt || t.closedAt || t.createdAt)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={7} className="p-5">
                            <TicketConversationThread ticketId={t.id} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Engineering Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-xl font-black text-[#0F172A]">Submit Engineering Request</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Routed directly to senior cloud &amp; full-stack engineers.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {ticketError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                {ticketError}
              </div>
            )}

            <div className="mb-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#2563EB]" />
                Quick Request Templates
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
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {tmpl.priority} • {tmpl.category}
                    </div>
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
                  minLength={5}
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Add testimonials section to homepage"
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
                    <option value="Normal">Normal (P3 • {slaTargets.P3.label})</option>
                    <option value="Urgent">Urgent (P2 • {slaTargets.P2.label})</option>
                    <option value="Critical">Critical (P1 • {slaTargets.P1.label})</option>
                    <option value="Low">Low (P4 • {slaTargets.P4.label})</option>
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
                      <option key={c} value={c}>
                        {titleCase(c)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className={cn(
                  'p-3 rounded-xl border text-xs flex items-center gap-2',
                  priority === 'Critical'
                    ? 'bg-rose-50 border-rose-200 text-rose-800 font-medium'
                    : priority === 'Urgent'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800',
                )}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  {priority === 'Critical'
                    ? `P1 Critical pages our on-call infrastructure lead (${slaTargets.P1.label} target).`
                    : priority === 'Urgent'
                      ? `P2 Urgent tickets are prioritized in the active queue (${slaTargets.P2.label} target).`
                      : `P3 Normal requests are triaged within ${slaTargets.P3.label}.`}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Detailed Description</label>
                  <span
                    className={cn(
                      'text-[11px]',
                      body.trim().length < 20 ? 'text-rose-500 font-semibold' : 'text-slate-400',
                    )}
                  >
                    {body.trim().length} / 20 min characters
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Provide clear context, URLs, reproduction steps, or exact content changes required…"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTicket.isPending || !subject.trim() || body.trim().length < 20}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                >
                  {createTicket.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
