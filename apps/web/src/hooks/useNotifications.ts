'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const accessToken = useAuthStore(s => s.accessToken);

  // Initial fetch
  useEffect(() => {
    if (!accessToken) return;

    async function fetchInitial() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications?limit=20`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        setNotifications(json.data ?? []);
        setUnreadCount(json.meta?.unread ?? 0);
      } catch {
        // Silently fail — portal works without notifications
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();
  }, [accessToken]);

  // SSE stream for real-time updates
  useEffect(() => {
    if (!accessToken) return;

    const url = `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream`;
    const es  = new EventSource(`${url}?token=${accessToken}`);

    es.onmessage = (event) => {
      try {
        const notif: Notification = JSON.parse(event.data);
        setNotifications(prev => [{ ...notif, read: false }, ...prev]);
        setUnreadCount(prev => prev + 1);
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      // SSE connection dropped — browser will auto-reconnect
    };

    return () => es.close();
  }, [accessToken]);

  const markRead = useCallback(async (id: string) => {
    if (!accessToken) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/read`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  }, [accessToken]);

  const markAllRead = useCallback(async () => {
    if (!accessToken) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/mark-all-read`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }, [accessToken]);

  return { notifications, unreadCount, loading, markRead, markAllRead };
}
