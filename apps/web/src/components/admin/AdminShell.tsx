'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Ticket,
  FileText,
  Server,
  Globe,
  BarChart2,
  Shield,
  Wrench,
  Settings,
  Bell,
  LogOut,
  Search,
  Menu,
  X,
  Eye,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';
import { useAdminClients, useAdminTickets, useUptime } from '@/hooks/useAdminData';

export interface AdminNavItem {
  id: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'dashboard', href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', href: '/admin/clients', label: 'Clients', icon: Users },
  { id: 'tickets', href: '/admin/tickets', label: 'Tickets & SLA', icon: Ticket },
  { id: 'invoices', href: '/admin/invoices', label: 'Invoices & Billing', icon: FileText },
  { id: 'hosting', href: '/admin/hosting', label: 'Hosting & Servers', icon: Server },
  { id: 'markets', href: '/admin/markets', label: 'Markets & Pricing', icon: Globe, badge: 'SSOT', badgeColor: 'bg-teal-500' },
  { id: 'reports', href: '/admin/reports', label: 'Reports & Analytics', icon: BarChart2 },
  { id: 'security', href: '/admin/security', label: 'Security & SSL', icon: Shield },
  { id: 'troubleshooting', href: '/admin/troubleshooting', label: 'Troubleshooting', icon: Wrench, badge: 'TOOLS', badgeColor: 'bg-amber-500' },
  { id: 'settings', href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const user = useAuthStore(s => s.user);
  const clearSession = useAuthStore(s => s.clearSession);

  // Live queries for header and badge indicators
  const clientsQuery = useAdminClients();
  const ticketsQuery = useAdminTickets();
  const uptimeQuery = useUptime();

  const liveTickets = ticketsQuery.data?.items ?? [];
  const openTickets = liveTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const breachedTickets = openTickets.filter(t => t.slaBreached);
  const sslAlerts = uptimeQuery.data?.sslAlerts ?? 0;

  // Derive dynamic badges
  const getBadge = (id: string, defaultBadge?: string) => {
    if (id === 'tickets' && openTickets.length > 0) return String(openTickets.length);
    if (id === 'clients' && (clientsQuery.data?.total ?? 0) > 0) return String(clientsQuery.data?.total);
    if (id === 'security' && sslAlerts > 0) return String(sslAlerts);
    return defaultBadge;
  };

  const getBadgeColor = (id: string, defaultColor?: string) => {
    if (id === 'tickets' && breachedTickets.length > 0) return 'bg-red-500';
    if (id === 'tickets' && openTickets.length > 0) return 'bg-blue-600';
    if (id === 'security' && sslAlerts > 0) return 'bg-amber-500';
    return defaultColor ?? 'bg-slate-700';
  };

  const handleSignOut = () => {
    clearSession();
    router.replace('/portal/login');
  };

  // Determine active item from pathname
  const activeNavItem = ADMIN_NAV_ITEMS.find(item => {
    if (item.href === '/admin') return pathname === '/admin';
    return pathname.startsWith(item.href);
  }) ?? ADMIN_NAV_ITEMS[0];

  const staffName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : 'Staff Member';
  const staffRole = user?.roles?.[0] ? user.roles[0].replace('_', ' ') : 'Administrator';
  const staffInitials = user?.firstName
    ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ''}`.toUpperCase()
    : 'AD';

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 inset-y-0 left-0 z-40 w-64 bg-[#0F172A] border-r border-slate-800 flex flex-col transition-transform duration-300 h-screen',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <Logo variant="dark" markClassName="h-10 w-auto" />
            <div>
              <div className="font-black text-white text-sm tracking-tight flex items-center gap-1.5">
                BazionWeb
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30">
                  ADMIN
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Operations Center</div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Staff Identity Pill */}
        <div className="px-4 py-3 mx-3 my-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {staffInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{staffName}</div>
            <div className="text-[10px] font-medium text-teal-400 capitalize flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {staffRole}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1.5">
            Platform Operations
          </div>
          {ADMIN_NAV_ITEMS.map(item => {
            const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            const badge = getBadge(item.id, item.badge);
            const badgeColor = getBadgeColor(item.id, item.badgeColor);

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group',
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80',
                )}
              >
                <item.icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-white' : 'text-slate-400 group-hover:text-white')} />
                <span className="flex-1 truncate">{item.label}</span>
                {badge && (
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0', badgeColor)}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-800/80 shrink-0 space-y-1">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Public Website</span>
            <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors text-left"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Viewport ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Admin</span>
                <ChevronRight className="w-3 h-3" />
                <span className="font-semibold text-slate-700">{activeNavItem.label}</span>
              </div>
              <h1 className="text-base font-black text-slate-900 leading-tight">
                {activeNavItem.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Health Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Core Services: Normal</span>
            </div>

            {/* Quick Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && globalSearch.trim()) {
                    router.push(`/admin/clients?q=${encodeURIComponent(globalSearch.trim())}`);
                  }
                }}
                placeholder="Search clients, tickets… (Press Enter)"
                className="pl-8 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
              />
            </div>

            {/* Notifications Alert Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {(breachedTickets.length > 0 || sslAlerts > 0) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-ping" />
                )}
                {(breachedTickets.length > 0 || sslAlerts > 0) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">System Alerts</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
                    {breachedTickets.length === 0 && sslAlerts === 0 ? (
                      <div className="p-4 text-center">
                        <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                        <p className="text-xs font-medium text-slate-700">All systems operating within SLA</p>
                        <p className="text-[11px] text-slate-400">No overdue tickets or expiring SSL certificates.</p>
                      </div>
                    ) : (
                      <>
                        {breachedTickets.map(t => (
                          <Link
                            key={t.id}
                            href="/admin/tickets"
                            onClick={() => setShowNotifications(false)}
                            className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-red-50/60 transition-colors"
                          >
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-red-900 truncate">SLA Breached: {t.subject}</p>
                              <p className="text-[11px] text-slate-500">{t.client?.businessName ?? 'Client'} · Priority {t.priority}</p>
                            </div>
                          </Link>
                        ))}
                        {sslAlerts > 0 && (
                          <Link
                            href="/admin/security"
                            onClick={() => setShowNotifications(false)}
                            className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-amber-50/60 transition-colors"
                          >
                            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-amber-900">{sslAlerts} SSL Certificates Expiring</p>
                              <p className="text-[11px] text-slate-500">Action needed within 30 days</p>
                            </div>
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Portal Link */}
            <Link
              href="/portal"
              className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Client View
            </Link>
          </div>
        </header>

        {/* Routed Page Content */}
        <main className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
