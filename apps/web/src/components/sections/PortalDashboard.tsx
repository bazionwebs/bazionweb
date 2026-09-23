'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Globe, Server, Ticket, FileText,
  Bell, LogOut, Settings, TrendingUp, Shield, Wrench,
  CheckCircle, BarChart2, ExternalLink,
  ChevronRight, Zap, Download, Plus, X, Menu, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/Logo';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockClient = {
  name: 'Acacia Healthcare Ltd',
  plan: 'Business',
  contactName: 'Sarah Kamau',
  domain: 'acaciahealthcare.com',
  renewalDate: '2025-10-15',
};

const stats = [
  { label: 'Uptime (30d)', value: '99.98%', delta: '+0.03%', icon: TrendingUp, color: 'text-[#22C55E]', bg: 'bg-green-50' },
  { label: 'Avg Load Time', value: '1.24s', delta: '-0.3s', icon: Zap, color: 'text-[#2563EB]', bg: 'bg-blue-50' },
  { label: 'Lighthouse Score', value: '97', delta: '+2', icon: BarChart2, color: 'text-[#14B8A6]', bg: 'bg-teal-50' },
  { label: 'Open Tickets', value: '1', delta: '', icon: Ticket, color: 'text-[#F59E0B]', bg: 'bg-yellow-50' },
];

const tickets = [
  {
    id: 'TKT-0042',
    subject: 'Contact form not sending emails',
    status: 'In Progress',
    priority: 'P2',
    created: '2025-06-08',
    statusColor: 'badge-yellow',
  },
  {
    id: 'TKT-0039',
    subject: 'Add new team member to About page',
    status: 'Resolved',
    priority: 'P4',
    created: '2025-06-02',
    statusColor: 'badge-green',
  },
  {
    id: 'TKT-0035',
    subject: 'Monthly performance optimization — May',
    status: 'Resolved',
    priority: 'P3',
    created: '2025-05-28',
    statusColor: 'badge-green',
  },
];

const invoices = [
  { id: 'INV-2025-06', period: 'June 2025', amount: '$199.00', status: 'Paid', date: '2025-06-01' },
  { id: 'INV-2025-05', period: 'May 2025', amount: '$199.00', status: 'Paid', date: '2025-05-01' },
  { id: 'INV-2025-04', period: 'April 2025', amount: '$199.00', status: 'Paid', date: '2025-04-01' },
];

const hostingStatus = {
  domain: 'acaciahealthcare.com',
  server: 'Oracle Cloud (Frankfurt)',
  sslExpiry: '2026-03-12',
  lastBackup: '2025-06-09 02:14 UTC',
  backupSize: '840 MB',
  cdnStatus: 'Active',
  uptime: '99.98%',
};

const recentActivity = [
  { icon: Shield, text: 'Security scan completed — 0 threats found', time: '2h ago', color: 'text-[#22C55E]' },
  { icon: Wrench, text: 'CMS updated to v4.11.2', time: '1d ago', color: 'text-[#2563EB]' },
  { icon: CheckCircle, text: 'Monthly backup verified successfully', time: '2d ago', color: 'text-[#14B8A6]' },
  { icon: TrendingUp, text: 'Performance report for May delivered', time: '5d ago', color: 'text-[#F59E0B]' },
];

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Globe, label: 'My Website', id: 'website' },
  { icon: Server, label: 'Hosting', id: 'hosting' },
  { icon: Ticket, label: 'Support', id: 'tickets' },
  { icon: FileText, label: 'Invoices', id: 'invoices' },
  { icon: BarChart2, label: 'Reports', id: 'reports' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0F172A] flex flex-col transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between">
          <Logo variant="dark" markClassName="h-14 w-auto" />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Client info */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="text-xs text-slate-500 mb-0.5 uppercase tracking-widest">Client</div>
          <div className="text-sm font-semibold text-white truncate">{mockClient.name}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            <span className="text-xs text-slate-400">{mockClient.plan} Plan · Active</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
              {item.id === 'tickets' && (
                <span className="ml-auto w-5 h-5 rounded-full bg-[#F59E0B] text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-white/5 space-y-1">
          <button className="sidebar-item w-full text-left">
            <Bell className="w-4 h-4" />
            Notifications
          </button>
          <Link href="/" className="sidebar-item block">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-[#0F172A] capitalize">
                {navItems.find(n => n.id === activeTab)?.label}
              </h1>
              <p className="text-xs text-slate-400">
                {mockClient.domain} · Last updated: just now
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-xs font-semibold text-green-700">All systems operational</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white text-xs font-bold">
              SK
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Welcome */}
              <div className="bg-gradient-to-r from-[#0F172A] to-[#1e3a5f] rounded-2xl p-6 text-white">
                <p className="text-slate-400 text-sm mb-1">Welcome back,</p>
                <h2 className="text-xl font-bold mb-1">{mockClient.contactName}</h2>
                <p className="text-slate-400 text-sm">Your website is healthy. Next renewal: {mockClient.renewalDate}.</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map(s => (
                  <div key={s.label} className="card p-5">
                    <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <div className="text-2xl font-black text-[#0F172A] mb-0.5">{s.value}</div>
                    <div className="text-xs text-slate-400">{s.label}</div>
                    {s.delta && (
                      <div className={`text-xs font-semibold mt-1 ${s.delta.startsWith('+') || s.delta.startsWith('-0') ? 'text-[#22C55E]' : 'text-slate-400'}`}>
                        {s.delta} this month
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent activity */}
                <div className="card p-6">
                  <h3 className="font-bold text-[#0F172A] mb-4">Recent activity</h3>
                  <div className="space-y-4">
                    {recentActivity.map((a, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                          <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-600 leading-snug">{a.text}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{a.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hosting quick status */}
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#0F172A]">Hosting status</h3>
                    <button onClick={() => setActiveTab('hosting')} className="text-xs text-[#2563EB] font-semibold hover:underline flex items-center gap-1">
                      Full details <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {[
                      ['Domain', hostingStatus.domain],
                      ['Server', hostingStatus.server],
                      ['SSL Expires', hostingStatus.sslExpiry],
                      ['Last Backup', hostingStatus.lastBackup],
                      ['CDN', hostingStatus.cdnStatus],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">{k}</span>
                        <span className="font-medium text-[#0F172A] text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Open tickets */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#0F172A]">Recent tickets</h3>
                  <button
                    onClick={() => setShowNewTicket(true)}
                    className="btn-primary text-xs px-4 py-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Ticket
                  </button>
                </div>
                <div className="table-wrapper">
                  <table className="table-default">
                    <thead>
                      <tr>
                        <th className="table-header">Ticket</th>
                        <th className="table-header">Subject</th>
                        <th className="table-header">Priority</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {tickets.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50 cursor-pointer">
                          <td className="table-cell font-mono text-xs text-slate-400">{t.id}</td>
                          <td className="table-cell font-medium text-[#0F172A]">{t.subject}</td>
                          <td className="table-cell">
                            <span className={`badge ${
                              t.priority === 'P1' ? 'badge-red' :
                              t.priority === 'P2' ? 'badge-yellow' :
                              t.priority === 'P3' ? 'badge-blue' : 'badge-slate'
                            }`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className={`badge ${t.statusColor}`}>{t.status}</span>
                          </td>
                          <td className="table-cell text-slate-400">{t.created}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── Hosting Tab ─────────────────────────────────────────────── */}
          {activeTab === 'hosting' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-5 text-center">
                  <div className="text-3xl font-black text-[#22C55E] mb-1">{hostingStatus.uptime}</div>
                  <div className="text-xs text-slate-400">30-day uptime</div>
                </div>
                <div className="card p-5 text-center">
                  <div className="text-3xl font-black text-[#2563EB] mb-1">{hostingStatus.backupSize}</div>
                  <div className="text-xs text-slate-400">Last backup size</div>
                </div>
                <div className="card p-5 text-center">
                  <div className="text-3xl font-black text-[#14B8A6] mb-1">Active</div>
                  <div className="text-xs text-slate-400">CDN status</div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="font-bold text-[#0F172A] mb-5">Infrastructure details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(hostingStatus).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <div>
                        <div className="text-xs text-slate-400 capitalize mb-0.5">{k.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <div className="text-sm font-semibold text-[#0F172A]">{v}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Tickets Tab ─────────────────────────────────────────────── */}
          {activeTab === 'tickets' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{tickets.length} total tickets</p>
                <button onClick={() => setShowNewTicket(true)} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" />
                  New Ticket
                </button>
              </div>
              <div className="card">
                <div className="table-wrapper">
                  <table className="table-default">
                    <thead>
                      <tr>
                        <th className="table-header">Ticket ID</th>
                        <th className="table-header">Subject</th>
                        <th className="table-header">Priority</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Created</th>
                        <th className="table-header">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {tickets.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50">
                          <td className="table-cell font-mono text-xs text-slate-400">{t.id}</td>
                          <td className="table-cell font-medium text-[#0F172A] max-w-xs">{t.subject}</td>
                          <td className="table-cell">
                            <span className={`badge ${
                              t.priority === 'P2' ? 'badge-yellow' : 'badge-slate'
                            }`}>{t.priority}</span>
                          </td>
                          <td className="table-cell">
                            <span className={`badge ${t.statusColor}`}>{t.status}</span>
                          </td>
                          <td className="table-cell text-slate-400">{t.created}</td>
                          <td className="table-cell">
                            <button className="text-xs text-[#2563EB] font-semibold hover:underline flex items-center gap-1">
                              View <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── Invoices Tab ────────────────────────────────────────────── */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="card">
                <div className="table-wrapper">
                  <table className="table-default">
                    <thead>
                      <tr>
                        <th className="table-header">Invoice</th>
                        <th className="table-header">Period</th>
                        <th className="table-header">Amount</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Date</th>
                        <th className="table-header">Download</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {invoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50/50">
                          <td className="table-cell font-mono text-xs text-slate-400">{inv.id}</td>
                          <td className="table-cell font-medium text-[#0F172A]">{inv.period}</td>
                          <td className="table-cell font-bold text-[#0F172A]">{inv.amount}</td>
                          <td className="table-cell">
                            <span className="badge badge-green">{inv.status}</span>
                          </td>
                          <td className="table-cell text-slate-400">{inv.date}</td>
                          <td className="table-cell">
                            <button className="text-xs text-[#2563EB] font-semibold hover:underline flex items-center gap-1">
                              <Download className="w-3 h-3" />
                              PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── Reports Tab ─────────────────────────────────────────────── */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['May 2025', 'April 2025', 'March 2025'].map(month => (
                  <div key={month} className="card p-6 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#0F172A]">{month}</div>
                        <div className="text-xs text-slate-400">Monthly Report</div>
                      </div>
                      <FileText className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="flex gap-2 text-xs flex-wrap">
                      <span className="badge-green">Uptime: 99.97%</span>
                      <span className="badge-blue">Score: 96</span>
                      <span className="badge-teal">0 incidents</span>
                    </div>
                    <button className="btn-secondary text-xs py-2 flex items-center justify-center gap-1">
                      <Download className="w-3 h-3" />
                      Download PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Website Tab ──────────────────────────────────────────────────── */}
          {activeTab === 'website' && (
            <div className="space-y-6">
              {/* Site health banner */}
              <div className="bg-gradient-to-r from-[#0F172A] to-[#1e3a5f] rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-slate-400 text-xs mb-1 uppercase tracking-widest">Live site</p>
                  <a href={`https://${mockClient.domain}`} target="_blank" rel="noopener noreferrer"
                    className="text-xl font-bold hover:text-[#14B8A6] transition-colors flex items-center gap-2">
                    {mockClient.domain}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                  <span className="text-sm text-slate-300">Site is online</span>
                </div>
              </div>

              {/* Lighthouse scores */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Performance', score: 97, color: 'text-[#22C55E]' },
                  { label: 'Accessibility', score: 94, color: 'text-[#22C55E]' },
                  { label: 'Best Practices', score: 100, color: 'text-[#22C55E]' },
                  { label: 'SEO', score: 98, color: 'text-[#22C55E]' },
                ].map(s => (
                  <div key={s.label} className="card p-5 text-center">
                    <div className={`text-3xl font-black ${s.color} mb-1`}>{s.score}</div>
                    <div className="text-xs text-slate-400">{s.label}</div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Active project */}
              <div className="card p-6">
                <h3 className="font-bold text-[#0F172A] mb-4">Active project</h3>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold text-[#0F172A]">Homepage redesign — Q3 2025</div>
                    <div className="text-xs text-slate-400 mt-0.5">Staging: staging.acaciahealthcare.com</div>
                  </div>
                  <span className="badge-blue">In Progress</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-[#2563EB]" style={{ width: '65%' }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>65% complete</span>
                  <span>Due: Aug 15, 2025</span>
                </div>
                {/* Task list */}
                <div className="mt-5 space-y-2">
                  {[
                    { task: 'Figma design approved', done: true },
                    { task: 'Homepage component build', done: true },
                    { task: 'Services page build', done: true },
                    { task: 'CMS content migration', done: false },
                    { task: 'QA & performance testing', done: false },
                    { task: 'Production deploy', done: false },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${t.done ? 'bg-[#22C55E] border-[#22C55E]' : 'border-slate-200'}`}>
                        {t.done && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={t.done ? 'text-slate-400 line-through' : 'text-slate-700'}>{t.task}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Web Vitals */}
              <div className="card p-6">
                <h3 className="font-bold text-[#0F172A] mb-4">Core Web Vitals</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'LCP (Largest Contentful Paint)', value: '1.2s', status: 'Good', threshold: '< 2.5s', color: 'text-[#22C55E]', bg: 'bg-green-50' },
                    { label: 'INP (Interaction to Next Paint)', value: '48ms', status: 'Good', threshold: '< 200ms', color: 'text-[#22C55E]', bg: 'bg-green-50' },
                    { label: 'CLS (Cumulative Layout Shift)', value: '0.02', status: 'Good', threshold: '< 0.1', color: 'text-[#22C55E]', bg: 'bg-green-50' },
                  ].map(v => (
                    <div key={v.label} className={`${v.bg} rounded-xl p-4 border border-slate-100`}>
                      <div className={`text-xl font-black ${v.color} mb-1`}>{v.value}</div>
                      <div className="text-xs font-semibold text-[#0F172A] mb-0.5">{v.status}</div>
                      <div className="text-xs text-slate-400">{v.label}</div>
                      <div className="text-xs text-slate-300 mt-1">Threshold: {v.threshold}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Settings Tab ──────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-2xl">
              {/* Contact details */}
              <div className="card p-6">
                <h3 className="font-bold text-[#0F172A] mb-5">Account details</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Business name', value: mockClient.name, type: 'text' },
                    { label: 'Contact name', value: 'Sarah Kamau', type: 'text' },
                    { label: 'Email address', value: 'sarah@acaciahealthcare.com', type: 'email' },
                    { label: 'Phone number', value: '+1 555 011 1234', type: 'tel' },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="label">{f.label}</label>
                      <input type={f.type} defaultValue={f.value} className="input" />
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex justify-end">
                  <button className="btn-primary text-sm py-2.5">Save changes</button>
                </div>
              </div>

              {/* Notification preferences */}
              <div className="card p-6">
                <h3 className="font-bold text-[#0F172A] mb-5">Notification preferences</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Ticket updates', desc: 'When a ticket is updated or resolved', enabled: true },
                    { label: 'Monthly reports', desc: 'Receive your monthly performance report', enabled: true },
                    { label: 'Invoice reminders', desc: 'Before invoice due dates', enabled: true },
                    { label: 'SSL expiry alerts', desc: 'When your SSL certificate is expiring', enabled: true },
                    { label: 'Downtime alerts', desc: 'Immediate notification when site goes down', enabled: true },
                    { label: 'Marketing emails', desc: 'Product updates and feature announcements', enabled: false },
                  ].map(n => (
                    <div key={n.label} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-[#0F172A]">{n.label}</div>
                        <div className="text-xs text-slate-400">{n.desc}</div>
                      </div>
                      <button className={`w-10 h-6 rounded-full transition-colors relative ${n.enabled ? 'bg-[#2563EB]' : 'bg-slate-200'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${n.enabled ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security */}
              <div className="card p-6">
                <h3 className="font-bold text-[#0F172A] mb-5">Security</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-[#0F172A]">Password</div>
                      <div className="text-xs text-slate-400">Last changed 3 months ago</div>
                    </div>
                    <a href="https://auth.bazionweb.com/realms/bazionweb/account/password"
                       target="_blank" rel="noopener noreferrer"
                       className="btn-secondary text-xs py-1.5 px-4">
                      Change
                    </a>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-[#0F172A]">Two-factor authentication</div>
                      <div className="text-xs text-slate-400">Strongly recommended</div>
                    </div>
                    <a href="https://auth.bazionweb.com/realms/bazionweb/account/totp"
                       target="_blank" rel="noopener noreferrer"
                       className="btn-primary text-xs py-1.5 px-4">
                      Enable 2FA
                    </a>
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div className="card p-6 border border-red-100">
                <h3 className="font-bold text-[#EF4444] mb-3">Danger zone</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Account cancellation removes all data after a 30-day grace period.
                  Please contact support before proceeding.
                </p>
                <button className="btn-danger text-sm py-2">Request account cancellation</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#0F172A]">Submit a support ticket</h3>
              <button onClick={() => setShowNewTicket(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Subject</label>
                <input type="text" className="input" placeholder="Brief description of the issue" />
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input">
                  <option value="P4">P4 — Low (cosmetic, enhancement)</option>
                  <option value="P3">P3 — Normal (minor issue)</option>
                  <option value="P2">P2 — High (feature broken)</option>
                  <option value="P1">P1 — Critical (site down)</option>
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={4} className="input" placeholder="Describe the issue in detail…" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewTicket(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button onClick={() => setShowNewTicket(false)} className="btn-primary flex-1">
                  Submit Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
