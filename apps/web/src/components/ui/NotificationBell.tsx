'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, Ticket, DollarSign, Shield, AlertTriangle, Info } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  TICKET_UPDATE:    Ticket,
  INVOICE_DUE:      DollarSign,
  SSL_EXPIRY:       Shield,
  DOWNTIME_ALERT:   AlertTriangle,
  BACKUP_FAILURE:   AlertTriangle,
  RENEWAL_REMINDER: Info,
  SECURITY_ALERT:   Shield,
  SYSTEM:           Info,
};

export default function NotificationBell() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
      >
        <Bell className="w-5 h-5 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-[var(--shadow-card-xl)] border border-slate-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-bold text-[#0F172A] text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-[#2563EB] hover:underline flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-400">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = ICON_MAP[n.type] ?? Info;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors',
                      !n.read && 'bg-blue-50/30',
                    )}
                    onClick={() => { markRead(n.id); if (n.actionUrl) window.location.href = n.actionUrl; }}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      n.type === 'DOWNTIME_ALERT' || n.type === 'BACKUP_FAILURE' || n.type === 'SECURITY_ALERT'
                        ? 'bg-red-50' : n.type === 'SSL_EXPIRY' ? 'bg-yellow-50' : 'bg-blue-50',
                    )}>
                      <Icon className={cn(
                        'w-4 h-4',
                        n.type === 'DOWNTIME_ALERT' || n.type === 'BACKUP_FAILURE' || n.type === 'SECURITY_ALERT'
                          ? 'text-red-500' : n.type === 'SSL_EXPIRY' ? 'text-yellow-500' : 'text-[#2563EB]',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-xs font-semibold', !n.read ? 'text-[#0F172A]' : 'text-slate-500')}>
                          {n.title}
                        </p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-slate-400 leading-snug mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-slate-300 mt-1">
                        {new Date(n.createdAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-center">
              <button className="text-xs text-[#2563EB] hover:underline">View all notifications</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
