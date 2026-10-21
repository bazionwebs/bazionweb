'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Globe,
  Layers,
  KeyRound,
  Ticket,
  FileText,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  Bell,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';
import { useClientTickets, useClientProfile } from '@/hooks/usePortalData';

export interface PortalNavItem {
  id: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { id: 'dashboard', href: '/portal', label: 'Mission Control', icon: LayoutDashboard },
  { id: 'milestones', href: '/portal/milestones', label: 'Delivery Roadmap', icon: Layers },
  { id: 'assets', href: '/portal/assets', label: 'Asset Sovereignty & DNS', icon: Globe },
  { id: 'vault', href: '/portal/vault', label: 'Encrypted Vault', icon: KeyRound },
  { id: 'support', href: '/portal/support', label: 'Engineering Support', icon: Ticket },
  { id: 'invoices', href: '/portal/invoices', label: 'Invoices & Cloud Care', icon: FileText },
];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const user = useAuthStore(s => s.user);
  const clearSession = useAuthStore(s => s.clearSession);

  const { data: liveClient } = useClientProfile();
  const { data: liveTickets = [] } = useClientTickets();

  const openTicketCount = liveTickets.filter(
    t => t.status === 'OPEN' || t.status === 'IN_PROGRESS',
  ).length;

  const clientName = liveClient?.businessName ?? user?.email ?? 'Your Organization';
  const contactName = liveClient?.contactName ?? (`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Client');
  const initials = contactName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CL';

  const handleSignOut = () => {
    clearSession();
    router.replace('/portal/login');
  };

  const activeNavItem = PORTAL_NAV_ITEMS.find(item => {
    if (item.href === '/portal') return pathname === '/portal';
    return pathname.startsWith(item.href);
  }) ?? PORTAL_NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 inset-y-0 left-0 z-40 w-72 bg-[#0F172A] flex flex-col transition-transform duration-300 h-screen border-r border-white/5',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <Link href="/portal" className="flex items-center gap-2.5">
            <Logo variant="dark" markClassName="h-10 w-auto" />
            <div>
              <div className="font-black text-white text-sm tracking-tight">BazionWeb</div>
              <div className="text-[11px] text-slate-400 font-medium">Client Portal</div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Client Identity Card */}
        <div className="px-5 py-4 mx-3 my-3 rounded-xl bg-white/5 border border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate">{clientName}</div>
              <div className="text-xs text-slate-400 truncate">{contactName}</div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">SLA Status:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              4-Hour Active
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1.5">
            Your Workspace
          </div>
          {PORTAL_NAV_ITEMS.map(item => {
            const isActive = item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
            const badgeCount = item.id === 'support' ? openTicketCount : 0;

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group',
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-white/5',
                )}
              >
                <item.icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-white')} />
                <span className="flex-1 truncate">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white bg-amber-500 shrink-0">
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Asset Sovereignty Badge */}
        <div className="p-4 mx-3 mb-3 rounded-xl bg-white/5 border border-white/10 shrink-0">
          <div className="flex items-center gap-2 font-semibold text-white mb-1 text-xs">
            <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
            <span>Asset Sovereignty Guarantee</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            100% client ownership of domain, code &amp; databases guaranteed by commercial SLA.
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between shrink-0">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
          <span className="text-[10px] text-slate-500 font-mono">v2.4.0</span>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Viewport ────────────────────────────────────────────────── */}
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
                <span>Client Portal</span>
                <ChevronRight className="w-3 h-3" />
                <span className="font-semibold text-slate-700">{activeNavItem.label}</span>
              </div>
              <h1 className="text-base font-black text-slate-900 leading-tight">
                {activeNavItem.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Sprint Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phase 3: Active Sprint</span>
            </div>

            {/* Notifications bell */}
            {openTicketCount > 0 && (
              <Link
                href="/portal/support"
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" />
              </Link>
            )}

            {/* User Avatar */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
