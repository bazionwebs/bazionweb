'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Ticket, FileText, BarChart2,
  Settings, Shield, Bell, LogOut, Search, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Plus, X, Menu, Globe,
  Server, DollarSign, Activity, Eye, Edit2, MoreHorizontal,
  Filter, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/Logo';
import AdminMarketsTab from '@/components/admin/AdminMarketsTab';
import {
  useAdminClients,
  useAdminTickets,
  useAdminHosting,
  useAdminInvoices,
  useMrr,
  useUptime,
  useSla,
  useCanSeeBilling,
} from '@/hooks/useAdminData';
import { QueryError, EmptyState, SectionLoading } from '@/components/ui/QueryState';
import { formatMoney, formatDate, titleCase, timeAgo, shortId } from '@/lib/format';

// ─── Live data is derived inside the component below (no mock rows) ──────────

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Globe, label: 'Markets & Pricing', id: 'markets', badge: 'SSOT', badgeColor: 'bg-teal-500' },
  { icon: Users, label: 'Clients', id: 'clients', badge: '47' },
  { icon: Ticket, label: 'Tickets', id: 'tickets', badge: '3', badgeColor: 'bg-red-500' },
  { icon: FileText, label: 'Invoices', id: 'invoices' },
  { icon: Server, label: 'Hosting', id: 'hosting' },
  { icon: BarChart2, label: 'Reports', id: 'reports' },
  { icon: Shield, label: 'Security', id: 'security', badge: '2', badgeColor: 'bg-yellow-500' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboardClient() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && navItems.some(item => item.id === tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  // ─── Live data (API-backed) ─────────────────────────────────────────────
  const clientsQuery = useAdminClients();
  const ticketsQuery = useAdminTickets();
  const hostingQuery = useAdminHosting();
  const mrrQuery = useMrr();
  const uptimeQuery = useUptime();
  const slaQuery = useSla();
  const invoicesQuery = useAdminInvoices();
  const canSeeBilling = useCanSeeBilling();

  const liveClients = clientsQuery.data?.items ?? [];
  const liveTickets = ticketsQuery.data?.items ?? [];

  const domainByClient: Record<string, string> = {};
  (hostingQuery.data?.items ?? []).forEach(h => {
    if (h.clientId && !domainByClient[h.clientId]) domainByClient[h.clientId] = h.domain;
  });

  const clients = liveClients.map(c => {
    const hasActiveSub = (c.subscriptions?.length ?? 0) > 0;
    const price = Number(c.plan?.priceMonthly ?? 0);
    return {
      id: c.id,
      name: c.businessName,
      domain: domainByClient[c.id] ?? '—',
      plan: c.plan?.name ?? '—',
      status: c.status,
      uptime: '—',
      tickets: c._count?.tickets ?? 0,
      mrr: hasActiveSub ? price : 0,
      renewal: c.subscriptions?.[0]?.renewalDate ? formatDate(c.subscriptions[0].renewalDate) : '—',
    };
  });

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.domain.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const assigneeName = (t: { assignee?: { firstName: string | null; lastName: string | null } | null }) =>
    t.assignee && (t.assignee.firstName || t.assignee.lastName)
      ? `${t.assignee.firstName ?? ''} ${t.assignee.lastName ?? ''}`.trim()
      : 'Unassigned';

  const openTickets = liveTickets
    .filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS')
    .map(t => ({
      id: `#${shortId(t.id, 4)}`,
      client: t.client?.businessName ?? '—',
      subject: t.subject,
      priority: t.priority,
      status: t.status,
      assignee: assigneeName(t),
      slaBreached: !!t.slaBreached,
      age: timeAgo(t.createdAt),
    }));

  const openP1P2 = openTickets.filter(t => t.priority === 'P1' || t.priority === 'P2');
  const breachedCount = openTickets.filter(t => t.slaBreached).length;

  const sslAlerts = (uptimeQuery.data?.summary ?? [])
    .filter(s => s.sslAlert)
    .map(s => ({
      domain: s.domain,
      expiry: formatDate(s.sslExpiry),
      daysLeft: s.sslDaysLeft ?? 0,
    }));

  const recentActivity = [...liveTickets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)
    .map(t => ({
      text: `${t.subject} — ${t.client?.businessName ?? 'Unknown client'}`,
      time: timeAgo(t.createdAt),
      icon: Ticket,
      color: t.status === 'OPEN' ? 'text-[#F59E0B]' : 'text-[#2563EB]',
    }));

  const overdueInvoices = (invoicesQuery.data?.items ?? []).filter(i => i.status === 'OVERDUE');
  const overdueTotal = overdueInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const kpis = [
    { label: 'Active Clients', value: clientsQuery.data ? String(clientsQuery.data.total) : '…', delta: 'Live total', trend: 'up', icon: Users, color: 'text-[#2563EB]', bg: 'bg-blue-50' },
    {
      label: 'MRR', value: !canSeeBilling ? 'Restricted' : mrrQuery.data ? `$${Math.round(mrrQuery.data.totalMrr).toLocaleString()}` : '…',
      delta: !canSeeBilling ? 'Admins only' : mrrQuery.data ? `ARR $${Math.round(mrrQuery.data.arr).toLocaleString()}` : 'Live total',
      trend: 'up', icon: DollarSign, color: 'text-[#22C55E]', bg: 'bg-green-50',
    },
    { label: 'Open P1/P2 Tickets', value: String(openP1P2.length), delta: breachedCount > 0 ? `${breachedCount} past SLA` : 'Within SLA', trend: breachedCount > 0 ? 'down' : 'up', icon: Ticket, color: 'text-[#EF4444]', bg: 'bg-red-50' },
    { label: 'Monitored Sites', value: uptimeQuery.data ? String(uptimeQuery.data.totalSites) : '…', delta: 'Across all clients', trend: 'up', icon: Activity, color: 'text-[#14B8A6]', bg: 'bg-teal-50' },
    { label: 'SSL Expiring <30d', value: uptimeQuery.data ? String(uptimeQuery.data.sslAlerts) : '…', delta: (uptimeQuery.data?.sslAlerts ?? 0) > 0 ? 'Action needed' : 'All clear', trend: (uptimeQuery.data?.sslAlerts ?? 0) > 0 ? 'down' : 'up', icon: Shield, color: 'text-[#F59E0B]', bg: 'bg-yellow-50' },
    {
      label: 'Overdue Invoices', value: !canSeeBilling ? 'Restricted' : String(overdueInvoices.length),
      delta: !canSeeBilling ? 'Admins only' : formatMoney(overdueTotal) + ' outstanding',
      trend: 'down', icon: FileText, color: 'text-[#EF4444]', bg: 'bg-red-50',
    },
  ];

  const navBadge = (id: string): string | undefined => {
    if (id === 'clients') return clientsQuery.data && clientsQuery.data.total > 0 ? String(clientsQuery.data.total) : undefined;
    if (id === 'tickets') return openTickets.length > 0 ? String(openTickets.length) : undefined;
    return undefined;
  };

  return (
    <div className="min-h-screen flex bg-[#F1F5F9]">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0F172A] flex flex-col transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* Logo + badge */}
        <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo variant="dark" markClassName="h-14 w-auto" />
            <div>
              <div className="font-bold text-white text-sm">BazionWeb</div>
              <div className="text-xs text-[#EF4444] font-semibold">Admin Portal</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Staff info */}
        <div className="px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white text-xs font-bold">
              JM
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Joseph M.</div>
              <div className="text-xs text-[#14B8A6]">Super Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={cn(
                activeTab === item.id ? 'sidebar-item-active' : 'sidebar-item',
                'w-full text-left',
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {(() => {
                const b = navBadge(item.id) ?? (item as { badge?: string }).badge;
                return b ? (
                  <span className={`ml-auto w-5 h-5 rounded-full ${item.badgeColor ?? 'bg-slate-600'} text-white text-xs flex items-center justify-center font-bold`}>
                    {b}
                  </span>
                ) : null;
              })()}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/5 space-y-1">
          <Link href="/" className="sidebar-item block w-full text-left">
            <Eye className="w-4 h-4" />
            View Site
          </Link>
          <button className="sidebar-item w-full text-left">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-sm font-bold text-[#0F172A] capitalize">
              {navItems.find(n => n.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients, tickets…"
                className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-60 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>
            <button className="relative p-2 rounded-xl hover:bg-slate-100">
              <Bell className="w-5 h-5 text-slate-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">

          {/* ── Dashboard ──────────────────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* KPI grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {kpis.map(k => (
                  <div key={k.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                    <div className={`w-8 h-8 rounded-xl ${k.bg} flex items-center justify-center mb-3`}>
                      <k.icon className={`w-4 h-4 ${k.color}`} />
                    </div>
                    <div className="text-xl font-black text-[#0F172A]">{k.value}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{k.label}</div>
                    <div className={`text-xs font-medium mt-1 flex items-center gap-1 ${k.trend === 'up' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {k.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {k.delta}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Open tickets */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-bold text-[#0F172A]">Open tickets requiring action</h2>
                    <button onClick={() => setActiveTab('tickets')} className="text-xs text-[#2563EB] font-semibold hover:underline">
                      View all →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {ticketsQuery.isLoading ? (
                      [0, 1, 2].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-slate-50 animate-pulse" />
                      ))
                    ) : (
                    openTickets.map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`badge text-xs ${t.priority === 'P1' ? 'badge-red' : t.priority === 'P2' ? 'badge-yellow' : 'badge-blue'}`}>
                            {t.priority}
                          </span>
                          {t.slaBreached && <span className="text-[9px] font-bold text-red-500 uppercase">SLA!</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#0F172A] truncate">{t.subject}</div>
                          <div className="text-xs text-slate-400">{t.client} · {t.id} · {t.age}</div>
                        </div>
                        <div className="text-xs text-slate-400 text-right">
                          <div className={t.assignee === 'Unassigned' ? 'text-[#EF4444] font-medium' : ''}>{t.assignee}</div>
                          <span className={`badge text-xs mt-0.5 inline-block ${t.status === 'IN_PROGRESS' ? 'badge-blue' : 'badge-yellow'}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))
                    )}
                  </div>
                </div>

                {/* Alerts + activity */}
                <div className="space-y-4">
                  {/* SSL alerts */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-5">
                    <h3 className="font-bold text-[#0F172A] text-sm mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#F59E0B]" />
                      SSL Expiry Alerts
                    </h3>
                    <div className="space-y-2">
                      {sslAlerts.map(s => (
                        <div key={s.domain} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                          <div>
                            <div className="text-xs font-semibold text-[#0F172A]">{s.domain}</div>
                            <div className="text-xs text-slate-400">{s.expiry}</div>
                          </div>
                          <span className="badge-yellow text-xs">{s.daysLeft}d</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent activity */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-5">
                    <h3 className="font-bold text-[#0F172A] text-sm mb-3">Recent activity</h3>
                    <div className="space-y-3">
                      {ticketsQuery.isLoading ? (
                        <div className="h-12 rounded-xl bg-slate-50 animate-pulse" />
                      ) : recentActivity.length === 0 ? (
                        <p className="text-xs text-slate-400">No recent activity yet.</p>
                      ) : (
                      recentActivity.slice(0, 4).map((a, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <a.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${a.color}`} />
                          <div>
                            <p className="text-xs text-slate-600 leading-snug">{a.text}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{a.time}</p>
                          </div>
                        </div>
                      ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* MRR breakdown */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-6">
                <h2 className="font-bold text-[#0F172A] mb-5">MRR by plan</h2>
                {!canSeeBilling ? (
                  <p className="text-xs text-slate-400">Restricted to admin roles.</p>
                ) : mrrQuery.isLoading ? (
                  <SectionLoading label="Loading revenue…" />
                ) : mrrQuery.isError ? (
                  <QueryError message="Revenue data couldn't be loaded." onRetry={() => mrrQuery.refetch()} />
                ) : !mrrQuery.data || Object.keys(mrrQuery.data.byTier).length === 0 ? (
                  <EmptyState title="No active subscriptions" hint="MRR appears here once subscriptions are active." />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(mrrQuery.data.byTier).map(([tier, t], i) => (
                      <div key={tier} className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <div className={`w-10 h-10 rounded-xl ${['bg-slate-200', 'bg-blue-200', 'bg-teal-200', 'bg-purple-200'][i % 4]} mx-auto mb-3`} />
                        <div className="text-xs text-slate-400 mb-1">{titleCase(tier)}</div>
                        <div className="text-xl font-black text-[#0F172A]">${Math.round(t.mrr).toLocaleString()}</div>
                        <div className="text-xs text-slate-400">{t.count} clients</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Clients tab ─────────────────────────────────────────────────── */}
          {activeTab === 'clients' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search clients…"
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 bg-white rounded-xl hover:bg-slate-50">
                    <Filter className="w-4 h-4 text-slate-400" /> Filter
                  </button>
                </div>
                <button className="btn-primary text-sm py-2 px-4">
                  <Plus className="w-4 h-4" /> Add Client
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                {clientsQuery.isLoading ? (
                  <div className="p-6"><SectionLoading label="Loading clients…" /></div>
                ) : clientsQuery.isError ? (
                  <div className="p-6"><QueryError message="Clients couldn't be loaded." onRetry={() => clientsQuery.refetch()} /></div>
                ) : filteredClients.length === 0 ? (
                  <div className="p-6"><EmptyState title="No clients found" hint="Try a different search, or add your first client." /></div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="table-header">Client</th>
                        <th className="table-header">Domain</th>
                        <th className="table-header">Plan</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Uptime</th>
                        <th className="table-header">Tickets</th>
                        <th className="table-header">MRR</th>
                        <th className="table-header">Renewal</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredClients.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="table-cell font-semibold text-[#0F172A]">{c.name}</td>
                          <td className="table-cell">
                            <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer"
                              className="text-[#2563EB] hover:underline text-xs font-mono">
                              {c.domain}
                            </a>
                          </td>
                          <td className="table-cell">
                            <span className={`badge ${c.plan === 'Business' ? 'badge-teal' : c.plan === 'Growth' ? 'badge-blue' : 'badge-slate'}`}>
                              {c.plan}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className={`badge ${c.status === 'ACTIVE' ? 'badge-green' : c.status === 'TRIAL' ? 'badge-yellow' : 'badge-red'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="table-cell font-mono text-sm">
                            <span className={c.uptime === '100%' || c.uptime.startsWith('99.9') ? 'text-[#22C55E]' : 'text-slate-400'}>
                              {c.uptime}
                            </span>
                          </td>
                          <td className="table-cell text-center">
                            {c.tickets > 0 ? (
                              <span className="badge-red">{c.tickets}</span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="table-cell font-semibold text-[#0F172A]">
                            {c.mrr > 0 ? `$${c.mrr}` : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="table-cell text-xs text-slate-400">{c.renewal}</td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1">
                              <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#2563EB]">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#2563EB]">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#EF4444]">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tickets tab ─────────────────────────────────────────────────── */}
          {activeTab === 'tickets' && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Open', count: liveTickets.filter(t => t.status === 'OPEN').length, color: 'bg-red-50 text-red-600' },
                  { label: 'In Progress', count: liveTickets.filter(t => t.status === 'IN_PROGRESS').length, color: 'bg-blue-50 text-blue-600' },
                  { label: 'Pending Client', count: liveTickets.filter(t => t.status === 'PENDING_CLIENT').length, color: 'bg-yellow-50 text-yellow-600' },
                  { label: 'Resolved', count: liveTickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length, color: 'bg-green-50 text-green-600' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 text-center">
                    <div className={`text-2xl font-black mb-1 ${s.color.split(' ')[1]}`}>{s.count}</div>
                    <div className="text-xs text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>

              {ticketsQuery.isLoading && <SectionLoading label="Loading tickets…" />}
              {ticketsQuery.isError && !ticketsQuery.isLoading && (
                <QueryError message="Tickets couldn't be loaded." onRetry={() => ticketsQuery.refetch()} />
              )}
              {!ticketsQuery.isLoading && !ticketsQuery.isError && liveTickets.length === 0 && (
                <EmptyState title="No tickets" hint="New support requests will appear here." />
              )}

              <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                  <h2 className="font-bold text-[#0F172A]">All open tickets</h2>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">
                      <Filter className="w-3.5 h-3.5" /> Filter
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">
                      <Download className="w-3.5 h-3.5" /> Export
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="table-header">ID</th>
                        <th className="table-header">Client</th>
                        <th className="table-header">Subject</th>
                        <th className="table-header">Priority</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Assignee</th>
                        <th className="table-header">Age</th>
                        <th className="table-header">SLA</th>
                        <th className="table-header">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {openTickets.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50">
                          <td className="table-cell font-mono text-xs text-slate-400">{t.id}</td>
                          <td className="table-cell text-sm font-medium text-[#0F172A]">{t.client}</td>
                          <td className="table-cell max-w-xs truncate text-sm">{t.subject}</td>
                          <td className="table-cell">
                            <span className={`badge ${t.priority === 'P1' ? 'badge-red' : t.priority === 'P2' ? 'badge-yellow' : 'badge-blue'}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className={`badge ${t.status === 'IN_PROGRESS' ? 'badge-blue' : 'badge-yellow'}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className={`table-cell text-xs ${t.assignee === 'Unassigned' ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                            {t.assignee}
                          </td>
                          <td className="table-cell text-xs text-slate-400">{t.age}</td>
                          <td className="table-cell">
                            {t.slaBreached ? (
                              <span className="badge-red text-xs flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Breached
                              </span>
                            ) : (
                              <span className="badge-green text-xs">OK</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <button className="btn-secondary text-xs py-1 px-3">Assign</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Security tab ────────────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {uptimeQuery.isLoading ? (
                <SectionLoading label="Loading security status…" />
              ) : uptimeQuery.isError ? (
                <QueryError message="Security status couldn't be loaded." onRetry={() => uptimeQuery.refetch()} />
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'SSL Expiring <30d', value: String(uptimeQuery.data?.sslAlerts ?? 0), color: 'text-[#F59E0B]', bg: 'bg-yellow-50', icon: Shield },
                  { label: 'Monitored Sites', value: String(uptimeQuery.data?.totalSites ?? 0), color: 'text-[#2563EB]', bg: 'bg-blue-50', icon: Globe },
                  { label: 'SSL-Healthy Domains', value: String((uptimeQuery.data?.summary ?? []).filter(s => !s.sslAlert).length), color: 'text-[#22C55E]', bg: 'bg-green-50', icon: CheckCircle },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5">
                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    <div className={`text-2xl font-black ${s.color} mb-1`}>{s.value}</div>
                    <div className="text-xs text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="font-bold text-[#0F172A] mb-4">SSL Certificate Status — All Clients</h2>
                <div className="space-y-2">
                  {clients.filter(c => c.status === 'ACTIVE').map(c => {
                    const alert = sslAlerts.find(s => s.domain === c.domain);
                    return (
                      <div key={c.domain} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          {alert ? (
                            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-[#0F172A]">{c.domain}</div>
                            <div className="text-xs text-slate-400">{c.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          {alert ? (
                            <span className="badge-yellow text-xs">{alert.daysLeft} days left</span>
                          ) : (
                            <span className="badge-green text-xs">Valid</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Reports tab ─────────────────────────────────────────────────── */}
          {activeTab === 'reports' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[#0F172A]">Monthly reports</h2>
              </div>

              {/* SLA compliance (admin only) */}
              {!canSeeBilling ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <p className="text-xs text-slate-400">SLA and revenue reports are restricted to admin roles.</p>
                </div>
              ) : slaQuery.isLoading ? (
                <SectionLoading label="Loading SLA compliance…" />
              ) : slaQuery.isError ? (
                <QueryError message="SLA data couldn't be loaded." onRetry={() => slaQuery.refetch()} />
              ) : slaQuery.data ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-6">
                  <div className="text-xs text-slate-400 mb-1">SLA compliance · {slaQuery.data.period}</div>
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <div className="text-2xl font-black text-[#0F172A]">{slaQuery.data.complianceRate}%</div>
                      <div className="text-xs text-slate-400">Compliance rate</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-[#0F172A]">{slaQuery.data.resolvedTickets}/{slaQuery.data.totalTickets}</div>
                      <div className="text-xs text-slate-400">Resolved tickets</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-[#0F172A]">{slaQuery.data.avgResolutionMinutes}m</div>
                      <div className="text-xs text-slate-400">Avg resolution</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-black ${slaQuery.data.slaBreaches > 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}>{slaQuery.data.slaBreaches}</div>
                      <div className="text-xs text-slate-400">SLA breaches</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Per-domain uptime (all staff) */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="font-bold text-[#0F172A]">Uptime by domain · {uptimeQuery.data?.period ?? 'Last 30 days'}</h3>
                </div>
                {uptimeQuery.isLoading ? (
                  <div className="p-6"><SectionLoading label="Loading uptime…" /></div>
                ) : uptimeQuery.isError ? (
                  <div className="p-6"><QueryError message="Uptime data couldn't be loaded." onRetry={() => uptimeQuery.refetch()} /></div>
                ) : !uptimeQuery.data || uptimeQuery.data.summary.length === 0 ? (
                  <div className="p-6"><EmptyState title="No monitored sites" hint="Hosting accounts appear here once provisioned." /></div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="table-header">Domain</th>
                        <th className="table-header">Client</th>
                        <th className="table-header">SSL</th>
                        <th className="table-header">Backups (30d)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {uptimeQuery.data.summary.map(s => (
                        <tr key={s.domain} className="hover:bg-slate-50/50">
                          <td className="table-cell font-mono text-xs text-slate-500">{s.domain}</td>
                          <td className="table-cell text-sm font-medium text-[#0F172A]">{s.client}</td>
                          <td className="table-cell">
                            {s.sslAlert ? (
                              <span className="badge-yellow text-xs">{s.sslDaysLeft ?? '?'}d left</span>
                            ) : (
                              <span className="badge-green text-xs">Valid</span>
                            )}
                          </td>
                          <td className="table-cell text-xs text-slate-500">
                            {s.backups.total} total · {s.backups.failed} failed ({s.backups.successRate}%)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>

              {/* MRR summary (admin only) */}
              {canSeeBilling && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-6">
                  <h3 className="font-bold text-[#0F172A] mb-4">Revenue summary</h3>
                  {mrrQuery.isLoading ? (
                    <SectionLoading label="Loading revenue…" />
                  ) : mrrQuery.isError ? (
                    <QueryError message="Revenue data couldn't be loaded." onRetry={() => mrrQuery.refetch()} />
                  ) : mrrQuery.data ? (
                    <div className="flex flex-wrap gap-6">
                      <div>
                        <div className="text-2xl font-black text-[#0F172A]">${Math.round(mrrQuery.data.totalMrr).toLocaleString()}</div>
                        <div className="text-xs text-slate-400">MRR · {mrrQuery.data.period}</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-[#0F172A]">${Math.round(mrrQuery.data.arr).toLocaleString()}</div>
                        <div className="text-xs text-slate-400">ARR</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-[#0F172A]">{mrrQuery.data.totalClients}</div>
                        <div className="text-xs text-slate-400">Active subscriptions</div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState title="No revenue data" hint="Figures appear once subscriptions are active." />
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: MARKETS & PRICING */}
          {activeTab === 'markets' && <AdminMarketsTab />}

          {/* Other tabs placeholder */}
          {!['dashboard', 'clients', 'tickets', 'security', 'reports', 'markets'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-2xl border border-slate-100">
              <div className="text-4xl mb-4">🚧</div>
              <h3 className="font-bold text-[#0F172A] mb-2 capitalize">{activeTab}</h3>
              <p className="text-sm text-slate-400">This section is ready for implementation.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
