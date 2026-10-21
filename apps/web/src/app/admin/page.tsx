'use client';

import React from 'react';
import Link from 'next/link';
import {
  Users,
  Ticket,
  FileText,
  Activity,
  Shield,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  useAdminClients,
  useAdminTickets,
  useAdminInvoices,
  useMrr,
  useUptime,
  useCanSeeBilling,
} from '@/hooks/useAdminData';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatMoney, formatDate, titleCase, timeAgo, shortId } from '@/lib/format';

export default function AdminDashboardPage() {
  const clientsQuery = useAdminClients();
  const ticketsQuery = useAdminTickets();
  const invoicesQuery = useAdminInvoices();
  const mrrQuery = useMrr();
  const uptimeQuery = useUptime();
  const canSeeBilling = useCanSeeBilling();

  const liveTickets = ticketsQuery.data?.items ?? [];

  const openTickets = liveTickets
    .filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS')
    .map(t => {
      const assigneeName =
        t.assignee && (t.assignee.firstName || t.assignee.lastName)
          ? `${t.assignee.firstName ?? ''} ${t.assignee.lastName ?? ''}`.trim()
          : 'Unassigned';

      return {
        id: `#${shortId(t.id, 4)}`,
        rawId: t.id,
        client: t.client?.businessName ?? '—',
        subject: t.subject,
        priority: t.priority,
        status: t.status,
        assignee: assigneeName,
        slaBreached: !!t.slaBreached,
        age: timeAgo(t.createdAt),
      };
    });

  const openP1P2 = openTickets.filter(t => t.priority === 'P1' || t.priority === 'P2');
  const breachedCount = openTickets.filter(t => t.slaBreached).length;

  const overdueInvoices = (invoicesQuery.data?.items ?? []).filter(i => i.status === 'OVERDUE');
  const overdueTotal = overdueInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const sslAlerts = (uptimeQuery.data?.summary ?? [])
    .filter(s => s.sslAlert)
    .map(s => ({
      domain: s.domain,
      client: s.client,
      expiry: formatDate(s.sslExpiry),
      daysLeft: s.sslDaysLeft ?? 0,
    }));

  const recentActivity = [...liveTickets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(t => ({
      text: `${t.subject} — ${t.client?.businessName ?? 'Unknown client'}`,
      time: timeAgo(t.createdAt),
      status: t.status,
      priority: t.priority,
    }));

  const kpis = [
    {
      label: 'Active Clients',
      value: clientsQuery.data ? String(clientsQuery.data.total) : '…',
      delta: 'Total registered',
      trend: 'up' as const,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/admin/clients',
    },
    {
      label: 'Monthly Recurring (MRR)',
      value: !canSeeBilling ? 'Restricted' : mrrQuery.data ? `$${Math.round(mrrQuery.data.totalMrr).toLocaleString()}` : '…',
      delta: !canSeeBilling ? 'Admins only' : mrrQuery.data ? `ARR $${Math.round(mrrQuery.data.arr).toLocaleString()}` : 'Live billing',
      trend: 'up' as const,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      href: '/admin/invoices',
    },
    {
      label: 'Critical / P1 Tickets',
      value: String(openP1P2.length),
      delta: breachedCount > 0 ? `${breachedCount} SLA breached` : 'Within SLA target',
      trend: breachedCount > 0 ? ('down' as const) : ('up' as const),
      icon: Ticket,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      href: '/admin/tickets',
    },
    {
      label: 'Monitored Sites',
      value: uptimeQuery.data ? String(uptimeQuery.data.totalSites) : '…',
      delta: 'Active infrastructure',
      trend: 'up' as const,
      icon: Activity,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      href: '/admin/hosting',
    },
    {
      label: 'SSL Expiring <30d',
      value: uptimeQuery.data ? String(uptimeQuery.data.sslAlerts) : '…',
      delta: (uptimeQuery.data?.sslAlerts ?? 0) > 0 ? 'Action required' : 'All certificates valid',
      trend: (uptimeQuery.data?.sslAlerts ?? 0) > 0 ? ('down' as const) : ('up' as const),
      icon: Shield,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/admin/security',
    },
    {
      label: 'Overdue Invoices',
      value: !canSeeBilling ? 'Restricted' : String(overdueInvoices.length),
      delta: !canSeeBilling ? 'Admins only' : formatMoney(overdueTotal) + ' total',
      trend: overdueInvoices.length > 0 ? ('down' as const) : ('up' as const),
      icon: FileText,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      href: '/admin/invoices',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Top Executive KPI Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => (
          <Link
            key={k.label}
            href={k.href}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-[#2563EB]/40 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-xl ${k.bg} flex items-center justify-center`}>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-xl font-black text-slate-900">{k.value}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5 truncate">{k.label}</div>
            <div
              className={`text-[11px] font-semibold mt-1.5 flex items-center gap-1 ${
                k.trend === 'up' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {k.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span className="truncate">{k.delta}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Main Operations Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open Action Tickets (2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Open Tickets Requiring Action</h2>
              <p className="text-xs text-slate-400 mt-0.5">Prioritized customer support queue and SLA thresholds</p>
            </div>
            <Link
              href="/admin/tickets"
              className="text-xs font-semibold text-[#2563EB] hover:text-blue-700 flex items-center gap-1"
            >
              View Queue ({openTickets.length}) →
            </Link>
          </div>

          <div className="space-y-2.5">
            {ticketsQuery.isLoading ? (
              [0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-slate-50 animate-pulse" />)
            ) : openTickets.length === 0 ? (
              <EmptyState title="Queue is Clear" hint="No tickets currently require admin triage." />
            ) : (
              openTickets.slice(0, 5).map(t => (
                <div
                  key={t.rawId}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                        t.priority === 'P1'
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : t.priority === 'P2'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {t.priority}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{t.subject}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{t.client}</span>
                        <span>•</span>
                        <span className="font-mono">{t.id}</span>
                        <span>•</span>
                        <span>{t.age}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {t.slaBreached && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold">
                        <AlertTriangle className="w-3 h-3" /> SLA BREACH
                      </span>
                    )}
                    <div className="text-right">
                      <div className={`text-xs font-medium ${t.assignee === 'Unassigned' ? 'text-rose-600' : 'text-slate-600'}`}>
                        {t.assignee}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">{t.status.replace('_', ' ').toLowerCase()}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Stack: SSL Alerts & Recent Activity */}
        <div className="space-y-6">
          {/* SSL Expiry Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                SSL Certificate Expirations
              </h3>
              <Link href="/admin/security" className="text-[11px] font-semibold text-[#2563EB] hover:underline">
                Details →
              </Link>
            </div>

            <div className="space-y-2">
              {sslAlerts.length === 0 ? (
                <div className="p-3 text-center bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="text-xs font-semibold text-emerald-800">All SSL certificates valid &gt; 30 days</span>
                </div>
              ) : (
                sslAlerts.slice(0, 3).map(s => (
                  <div key={s.domain} className="flex items-center justify-between p-2.5 bg-amber-50/80 rounded-xl border border-amber-100">
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-slate-900 truncate">{s.domain}</div>
                      <div className="text-[10px] text-slate-500">{s.client}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px] shrink-0">
                      {s.daysLeft}d left
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <h3 className="font-bold text-slate-900 text-xs mb-3">Recent Ticket Activity</h3>
            <div className="space-y-3">
              {ticketsQuery.isLoading ? (
                <div className="h-20 bg-slate-50 rounded-xl animate-pulse" />
              ) : recentActivity.length === 0 ? (
                <p className="text-xs text-slate-400">No recent activity recorded.</p>
              ) : (
                recentActivity.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 leading-snug truncate">{a.text}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Revenue by Plan Tier ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Monthly Recurring Revenue (MRR) by Tier</h2>
            <p className="text-xs text-slate-400 mt-0.5">Live active subscriptions aggregated from production database</p>
          </div>
          <Link href="/admin/invoices" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Manage Billing →
          </Link>
        </div>

        {!canSeeBilling ? (
          <p className="text-xs text-slate-400">Restricted to administrator roles.</p>
        ) : mrrQuery.isLoading ? (
          <SectionLoading label="Calculating live revenue…" />
        ) : mrrQuery.isError ? (
          <QueryError message="Revenue data could not be retrieved." onRetry={() => mrrQuery.refetch()} />
        ) : !mrrQuery.data || Object.keys(mrrQuery.data.byTier).length === 0 ? (
          <EmptyState title="No Active Subscriptions" hint="MRR metrics display as soon as invoices are paid." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(mrrQuery.data.byTier).map(([tier, t], i) => (
              <div key={tier} className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div
                  className={`w-9 h-9 rounded-xl ${
                    ['bg-slate-200 text-slate-700', 'bg-blue-100 text-blue-700', 'bg-teal-100 text-teal-700', 'bg-purple-100 text-purple-700'][
                      i % 4
                    ]
                  } mx-auto mb-2.5 flex items-center justify-center font-bold text-xs`}
                >
                  {tier[0]}
                </div>
                <div className="text-xs font-semibold text-slate-500 mb-0.5">{titleCase(tier)}</div>
                <div className="text-xl font-black text-slate-900">${Math.round(t.mrr).toLocaleString()}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{t.count} active clients</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
