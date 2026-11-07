'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/hooks/usePortalData';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const TYPE_STYLES: Record<string, { dot: string; label: string }> = {
  TICKET_UPDATE: { dot: 'bg-blue-500', label: 'Support' },
  TICKET_CREATED: { dot: 'bg-blue-500', label: 'Support' },
  TICKET_UPDATED: { dot: 'bg-blue-500', label: 'Support' },
  TICKET_RESOLVED: { dot: 'bg-emerald-500', label: 'Support' },
  INVOICE_DUE: { dot: 'bg-amber-500', label: 'Billing' },
  INVOICE_ISSUED: { dot: 'bg-amber-500', label: 'Billing' },
  INVOICE_PAID: { dot: 'bg-emerald-500', label: 'Billing' },
  PAYMENT_RECEIVED: { dot: 'bg-emerald-500', label: 'Billing' },
  PAYMENT_FAILED: { dot: 'bg-rose-500', label: 'Billing' },
  RENEWAL_REMINDER: { dot: 'bg-amber-500', label: 'Plan' },
  SUBSCRIPTION_ACTIVATED: { dot: 'bg-emerald-500', label: 'Plan' },
  SUBSCRIPTION_RENEWED: { dot: 'bg-emerald-500', label: 'Plan' },
  SUBSCRIPTION_CANCELLED: { dot: 'bg-rose-500', label: 'Plan' },
  SSL_EXPIRY: { dot: 'bg-amber-500', label: 'DNS & SSL' },
  BACKUP_FAILURE: { dot: 'bg-rose-500', label: 'Hosting' },
  DOWNTIME_ALERT: { dot: 'bg-rose-500', label: 'Uptime' },
  PROJECT_MILESTONE: { dot: 'bg-teal-500', label: 'Delivery' },
  DEPLOYMENT: { dot: 'bg-teal-500', label: 'Delivery' },
  SECURITY_ALERT: { dot: 'bg-rose-500', label: 'Security' },
  SYSTEM: { dot: 'bg-slate-400', label: 'System' },
};

/**
 * Ensures every notification action link stays inside the authenticated
 * `/portal` workspace rather than bouncing logged-in clients out to public
 * marketing/store pages or legacy `/dashboard` paths.
 */
function resolveInPortalUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '/portal';

  let pathname = trimmed;
  let search = '';
  try {
    const parsed = new URL(trimmed, 'http://portal.local');
    if (/^https?:\/\//i.test(trimmed) && !/localhost|bazionweb/i.test(parsed.hostname)) {
      return trimmed;
    }
    pathname = parsed.pathname;
    search = parsed.search;
  } catch {
    pathname = trimmed;
  }

  if (pathname.startsWith('/portal')) {
    return `${pathname}${search}`;
  }

  if (
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/store') ||
    pathname.startsWith('/quote') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/services')
  ) {
    if (pathname.includes('hosting') || search.includes('host')) return '/portal/packages?tab=hosting';
    if (pathname.includes('quote') || search.includes('package=')) return '/portal/packages?tab=builds';
    return '/portal/packages?tab=care';
  }

  if (pathname.startsWith('/dashboard/tickets')) {
    const ticketMatch = pathname.match(/^\/dashboard\/tickets\/([^/]+)/);
    return ticketMatch ? `/portal/support?ticket=${encodeURIComponent(ticketMatch[1])}` : '/portal/support';
  }
  if (pathname.startsWith('/dashboard/invoices') || pathname.startsWith('/billing')) {
    return '/portal/invoices';
  }
  if (pathname.startsWith('/dashboard/hosting')) {
    return '/portal/assets';
  }
  if (pathname.startsWith('/dashboard/projects')) {
    return '/portal/milestones';
  }
  if (pathname.startsWith('/contact')) {
    return '/portal/support';
  }

  return '/portal';
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: rawNotifications = [], isLoading } = useNotifications();
  const notifications = Array.isArray(rawNotifications) ? rawNotifications : [];
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Notifications</h3>
              <p className="text-[11px] text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2563EB] hover:underline disabled:opacity-50"
              >
                {markAllRead.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-50">
            {isLoading ? (
              <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs">Loading notifications…</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Ticket, billing and delivery updates land here.</p>
              </div>
            ) : (
              notifications.map(n => {
                const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.SYSTEM;
                const content = (
                  <div className={cn('px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors', !n.read && 'bg-blue-50/40')}>
                    <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', style.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#0F172A] truncate">{n.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{formatDate(n.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                      <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {style.label}
                      </span>
                    </div>
                  </div>
                );

                return n.actionUrl ? (
                  <Link
                    key={n.id}
                    href={resolveInPortalUrl(n.actionUrl)}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      setOpen(false);
                    }}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                    }}
                    className="w-full text-left"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
