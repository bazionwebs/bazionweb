'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Ticket, FileText, BarChart2,
  Settings, Shield, Bell, LogOut, Search, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Plus, X, Menu,
  Server, DollarSign, Activity, Eye, Edit2, MoreHorizontal,
  Filter, Download, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/Logo';

// ─── Mock data ────────────────────────────────────────────────────────────────

const kpis = [
  { label: 'Active Clients', value: '47', delta: '+3 this month', trend: 'up', icon: Users, color: 'text-[#2563EB]', bg: 'bg-blue-50' },
  { label: 'MRR', value: '$6,240', delta: '+$420 MoM', trend: 'up', icon: DollarSign, color: 'text-[#22C55E]', bg: 'bg-green-50' },
  { label: 'Open P1/P2 Tickets', value: '3', delta: '2 overdue SLA', trend: 'down', icon: Ticket, color: 'text-[#EF4444]', bg: 'bg-red-50' },
  { label: 'Avg Uptime (30d)', value: '99.97%', delta: 'Target: 99.95%', trend: 'up', icon: Activity, color: 'text-[#14B8A6]', bg: 'bg-teal-50' },
  { label: 'SSL Expiring <30d', value: '2', delta: 'Action needed', trend: 'down', icon: Shield, color: 'text-[#F59E0B]', bg: 'bg-yellow-50' },
  { label: 'Overdue Invoices', value: '1', delta: '$199 outstanding', trend: 'down', icon: FileText, color: 'text-[#EF4444]', bg: 'bg-red-50' },
];

const clients = [
  { id: '1', name: 'Acacia Healthcare Ltd', domain: 'acaciahealthcare.co.ke', plan: 'Business', status: 'ACTIVE', uptime: '99.98%', tickets: 1, mrr: 199, renewal: '2025-10-15' },
  { id: '2', name: 'Parkview Law Associates', domain: 'parkviewlaw.co.ke', plan: 'Growth', status: 'ACTIVE', uptime: '100%', tickets: 0, mrr: 99, renewal: '2025-08-01' },
  { id: '3', name: 'GrowAfrica Initiative', domain: 'growafrica.org', plan: 'Starter', status: 'ACTIVE', uptime: '99.9%', tickets: 0, mrr: 49, renewal: '2025-07-15' },
  { id: '4', name: 'Savanna Foods Kenya', domain: 'savannafoods.co.ke', plan: 'Growth', status: 'TRIAL', uptime: '—', tickets: 2, mrr: 0, renewal: '2025-06-30' },
  { id: '5', name: 'BlueSky Architects', domain: 'blueskyarch.co.ke', plan: 'Business', status: 'SUSPENDED', uptime: '—', tickets: 0, mrr: 0, renewal: '2025-06-01' },
];

const openTickets = [
  { id: 'TKT-0042', client: 'Acacia Healthcare', subject: 'Contact form not sending emails', priority: 'P2', status: 'IN_PROGRESS', assignee: 'Joseph M.', slaBreached: false, age: '2d' },
  { id: 'TKT-0043', client: 'Savanna Foods', subject: 'Homepage images not loading on mobile', priority: 'P2', status: 'OPEN', assignee: 'Unassigned', slaBreached: true, age: '3d' },
  { id: 'TKT-0044', client: 'Savanna Foods', subject: 'Cannot update blog posts in CMS', priority: 'P3', status: 'OPEN', assignee: 'Unassigned', slaBreached: false, age: '1d' },
];

const sslAlerts = [
  { domain: 'growafrica.org', expiry: '2025-07-02', daysLeft: 22 },
  { domain: 'parkviewlaw.co.ke', expiry: '2025-07-10', daysLeft: 30 },
];

const recentActivity = [
  { type: 'ticket', text: 'TKT-0044 opened by Savanna Foods', time: '1h ago', icon: Ticket, color: 'text-[#F59E0B]' },
  { type: 'payment', text: 'Invoice INV-2025-06 paid — Parkview Law ($99)', time: '3h ago', icon: DollarSign, color: 'text-[#22C55E]' },
  { type: 'security', text: 'SSL auto-renewed: acaciahealthcare.co.ke', time: '6h ago', icon: Shield, color: 'text-[#14B8A6]' },
  { type: 'client', text: 'Savanna Foods trial started (Growth plan)', time: '1d ago', icon: Users, color: 'text-[#2563EB]' },
  { type: 'alert', text: 'SSL expiry alert: growafrica.org (22 days)', time: '1d ago', icon: AlertTriangle, color: 'text-[#EF4444]' },
];

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
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

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.domain.toLowerCase().includes(clientSearch.toLowerCase())
  );

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
              {item.badge && (
                <span className={`ml-auto w-5 h-5 rounded-full ${item.badgeColor ?? 'bg-slate-600'} text-white text-xs flex items-center justify-center font-bold`}>
                  {item.badge}
                </span>
              )}
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
                    {openTickets.map(t => (
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
                    ))}
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
                      {recentActivity.slice(0, 4).map((a, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <a.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${a.color}`} />
                          <div>
                            <p className="text-xs text-slate-600 leading-snug">{a.text}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{a.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* MRR breakdown */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-6">
                <h2 className="font-bold text-[#0F172A] mb-5">MRR by plan</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { plan: 'Starter ($49)', count: 8, mrr: 392, color: 'bg-slate-200' },
                    { plan: 'Growth ($99)', count: 21, mrr: 2079, color: 'bg-blue-200' },
                    { plan: 'Business ($199)', count: 15, mrr: 2985, color: 'bg-teal-200' },
                    { plan: 'Enterprise', count: 3, mrr: 784, color: 'bg-purple-200' },
                  ].map(p => (
                    <div key={p.plan} className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className={`w-10 h-10 rounded-xl ${p.color} mx-auto mb-3`} />
                      <div className="text-xs text-slate-400 mb-1">{p.plan}</div>
                      <div className="text-xl font-black text-[#0F172A]">${p.mrr.toLocaleString()}</div>
                      <div className="text-xs text-slate-400">{p.count} clients</div>
                    </div>
                  ))}
                </div>
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
              </div>
            </div>
          )}

          {/* ── Tickets tab ─────────────────────────────────────────────────── */}
          {activeTab === 'tickets' && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Open', count: 3, color: 'bg-red-50 text-red-600' },
                  { label: 'In Progress', count: 1, color: 'bg-blue-50 text-blue-600' },
                  { label: 'Pending Client', count: 0, color: 'bg-yellow-50 text-yellow-600' },
                  { label: 'Resolved (30d)', count: 14, color: 'bg-green-50 text-green-600' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 text-center">
                    <div className={`text-2xl font-black mb-1 ${s.color.split(' ')[1]}`}>{s.count}</div>
                    <div className="text-xs text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'SSL Expiring <30d', value: '2', color: 'text-[#F59E0B]', bg: 'bg-yellow-50', icon: Shield },
                  { label: 'Failed WAF Blocks (24h)', value: '1,247', color: 'text-[#EF4444]', bg: 'bg-red-50', icon: Shield },
                  { label: 'Clean Malware Scans (7d)', value: '47/47', color: 'text-[#22C55E]', bg: 'bg-green-50', icon: CheckCircle },
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
                <button className="btn-primary text-sm py-2 px-4">
                  <Plus className="w-4 h-4" /> Generate Report
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {clients.slice(0, 3).map(c => (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-6">
                    <div className="font-bold text-[#0F172A] mb-1">{c.name}</div>
                    <div className="text-xs text-slate-400 mb-4">June 2025 · {c.plan} Plan</div>
                    <div className="space-y-2 mb-5">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Uptime</span>
                        <span className="font-semibold text-[#22C55E]">{c.uptime}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Tickets resolved</span>
                        <span className="font-semibold text-[#0F172A]">2</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Backups</span>
                        <span className="font-semibold text-[#22C55E]">30/30</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary text-xs py-1.5 flex-1 flex items-center justify-center gap-1">
                        <Download className="w-3 h-3" /> PDF
                      </button>
                      <button className="btn-ghost text-xs py-1.5 flex-1 flex items-center justify-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Regen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other tabs placeholder */}
          {!['dashboard', 'clients', 'tickets', 'security', 'reports'].includes(activeTab) && (
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
