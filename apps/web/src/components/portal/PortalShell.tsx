'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  ShieldAlert,
  Clock,
  Menu,
  X,
  LogOut,
  ChevronRight,
  ChevronDown,
  Sparkles,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import {
  useClientTickets,
  useClientProfile,
  useClientProjects,
  useClientInvoices,
} from '@/hooks/usePortalData';
import NotificationBell from './NotificationBell';
import WhatsAppFloatingChat from '@/components/ui/WhatsAppChat';

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
  { id: 'packages', href: '/portal/packages', label: 'Packages & Upgrades', icon: Sparkles },
  { id: 'account', href: '/portal/account', label: 'Account & Profile', icon: UserCog },
];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore(s => s.user);
  const expiresAt = useAuthStore(s => s.expiresAt);
  const isSandboxStore = useAuthStore(s => s.isSandbox);
  const sandboxMeta = useAuthStore(s => s.sandboxMeta);
  const clearSession = useAuthStore(s => s.clearSession);

  const { data: liveClient } = useClientProfile();
  const { data: liveTickets = [] } = useClientTickets();
  const { data: projects = [] } = useClientProjects();
  const { data: invoices = [] } = useClientInvoices();

  const [isSandboxActiveSession, setIsSandboxActiveSession] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSandboxActiveSession(window.sessionStorage.getItem('bazionweb_sandbox_active') === 'true');
    }
  }, []);

  const isSandbox = Boolean(
    isSandboxStore ||
    user?.isSandbox ||
    user?.impersonatedBy ||
    isSandboxActiveSession
  );

  useEffect(() => {
    if (!isSandbox) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isSandbox]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  const openTicketCount = liveTickets.filter(
    t => t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'PENDING_CLIENT',
  ).length;

  const unpaidInvoiceCount = invoices.filter(
    i => i.status === 'SENT' || i.status === 'PENDING' || i.status === 'OVERDUE',
  ).length;

  const activeSub = liveClient?.subscriptions?.[0];
  const activeProject = projects[0];

  const whatsappMessage =
    "Hello BazionWeb Support, I'm a client and need help with my workspace. I'm contacting you from the client portal.";

  const slaBadgeLabel = (() => {
    const p1 = activeSub?.plan?.p1ResponseMinutes;
    if (typeof p1 === 'number' && p1 > 0) {
      return p1 < 60 ? `${p1}m P1 Active` : `${Math.round(p1 / 60)}h P1 Active`;
    }
    if (activeProject) return 'Build Sprint Active';
    if (liveClient?.status === 'ACTIVE') return 'Workspace Active';
    return 'Standard Desk';
  })();

  const headerPill = (() => {
    if (activeProject) {
      const shortName = activeProject.name.split('—')[0].trim();
      return {
        href: '/portal/milestones',
        label: `${shortName} · ${activeProject.completionPct ?? 0}%`,
      };
    }
    if (activeSub?.plan?.name) {
      return {
        href: '/portal/invoices',
        label: `${activeSub.plan.name} Care Active`,
      };
    }
    return {
      href: '/portal/account',
      label: 'Client Workspace Active',
    };
  })();

  const clientName = liveClient?.businessName ?? user?.email ?? 'Your Organization';
  const contactName =
    liveClient?.contactName ??
    (`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Client');
  const initials =
    contactName
      .split(' ')
      .filter(Boolean)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'CL';

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await authApi.logout().catch(() => undefined);
    clearSession();
    router.replace('/portal/login');
  };

  const sandboxClientName = liveClient?.businessName || sandboxMeta?.clientBusinessName || clientName;
  const sandboxClientEmail = liveClient?.email || user?.email || 'N/A';
  const sandboxClientId = liveClient?.id || sandboxMeta?.clientId || 'N/A';
  const auditorEmail = user?.impersonatedBy || sandboxMeta?.impersonatedBy || 'Staff Auditor';

  const remainingMs = Math.max(0, (expiresAt || (now + 15 * 60 * 1000)) - now);
  const remainingMins = Math.floor(remainingMs / 60000);
  const remainingSecs = Math.floor((remainingMs % 60000) / 1000);
  const countdownText =
    remainingMs <= 0
      ? 'Session Expired'
      : `${remainingMins}m ${remainingSecs < 10 ? '0' : ''}${remainingSecs}s`;

  const handleExitSandbox = () => {
    if (typeof window !== 'undefined') {
      clearSession();
      window.sessionStorage.removeItem('bazionweb_sandbox_active');
      window.sessionStorage.removeItem('bazionweb_sandbox_token');
      window.sessionStorage.removeItem('bazionweb-auth');
      window.close();
      setTimeout(() => {
        window.location.href = '/admin/troubleshooting';
      }, 150);
    }
  };

  const activeNavItem =
    PORTAL_NAV_ITEMS.find(item => {
      if (item.href === '/portal') return pathname === '/portal';
      return pathname.startsWith(item.href);
    }) ?? PORTAL_NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 inset-y-0 left-0 z-40 w-72 bg-[#0F172A] flex flex-col transition-transform duration-300 h-[100dvh] border-r border-white/5',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <Link href="/portal" className="flex items-center gap-2.5">
            <Logo variant="dark" markClassName="h-10 w-auto" href={null} wordmark={false} />
            <div>
              <div className="font-black text-white text-sm tracking-tight">BazionWeb</div>
              <div className="text-[11px] text-slate-400 font-medium">Client Portal</div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
            aria-label="Close sidebar"
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
            <span className="text-slate-400 font-medium">Service Tier:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {slaBadgeLabel}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1.5">
            Your Workspace
          </div>
          {PORTAL_NAV_ITEMS.map(item => {
            const isActive =
              item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
            const badgeCount =
              item.id === 'support'
                ? openTicketCount
                : item.id === 'invoices'
                  ? unpaidInvoiceCount
                  : 0;

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
                <item.icon
                  className={cn(
                    'w-4 h-4 shrink-0',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-white',
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0',
                      item.id === 'invoices' ? 'bg-amber-500' : 'bg-blue-500',
                    )}
                  >
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
          <span className="text-[10px] text-slate-500 font-mono">v2.5.0</span>
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
        {/* Audited Sandbox Banner */}
        {isSandbox && (
          <div
            role="alert"
            aria-label="View-As Sandbox Active"
            className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0 border-b border-amber-600 z-30"
          >
            <div className="flex items-center flex-wrap gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 text-amber-400 font-bold text-[10px] tracking-wide uppercase shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                VIEW-AS SANDBOX (AUDITED SESSION)
              </span>
              <span className="text-slate-950 font-medium">
                Client: <strong className="font-bold">{sandboxClientName}</strong> ({sandboxClientEmail} · <span className="font-mono text-[11px]">ID: {sandboxClientId}</span>)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/80 text-slate-950 text-[11px] font-semibold border border-amber-600/40">
                Audited by: <strong className="font-bold">{auditorEmail}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-950 font-bold">
                <Clock className="w-3.5 h-3.5 text-slate-900" />
                <span>Expires: {countdownText}</span>
              </div>
              <button
                type="button"
                onClick={handleExitSandbox}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-950 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span>Exit Sandbox</span>
              </button>
            </div>
          </div>
        )}

        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0 sticky top-0 z-20 print:hidden">
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
            {/* Live Workspace / Sprint Pill */}
            <Link
              href={headerPill.href}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-blue-700 text-xs font-semibold transition-colors max-w-[260px]"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{headerPill.label}</span>
            </Link>

            {/* Notifications — live unread count + dropdown from the API */}
            <NotificationBell />

            {/* Interactive User Menu */}
            <div className="relative pl-3 border-l border-slate-200" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(o => !o)}
                aria-expanded={userMenuOpen}
                aria-label="Account menu"
                className="flex items-center gap-1.5 rounded-xl p-1 hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {initials}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden py-1.5">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <div className="text-xs font-bold text-[#0F172A] truncate">{contactName}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {liveClient?.email ?? user?.email}
                    </div>
                  </div>
                  <Link
                    href="/portal/account"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <UserCog className="w-3.5 h-3.5 text-slate-400" />
                    Account &amp; Security
                  </Link>
                  <Link
                    href="/portal/vault"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    Encrypted Vault
                  </Link>
                  <Link
                    href="/portal/invoices"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Billing &amp; Statements
                  </Link>
                  <Link
                    href="/portal/packages"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                    Packages &amp; Upgrades
                  </Link>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto custom-scrollbar">{children}</main>
      </div>

      <WhatsAppFloatingChat source="portal_widget" message={whatsappMessage} label="WhatsApp Support" />
    </div>
  );
}
