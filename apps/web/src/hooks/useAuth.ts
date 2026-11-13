'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { sanitizeRedirectPath } from '@/lib/utils';

function parseJwt(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export function useAuth() {
  const router = useRouter();
  const { user, accessToken, refreshToken, setSession, clearSession, isAuthenticated, hasRole, isTokenExpired } = useAuthStore();

  const login = useCallback(async (email: string, password: string, redirectTo?: string | null) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken: at, refreshToken: rt, expiresIn } = res.data.data;

    const decoded = parseJwt(at);
    if (!decoded) throw new Error('Invalid token');

    setSession(
      {
        id:         decoded.sub,
        email:      decoded.email ?? email,
        firstName:  decoded.given_name  ?? '',
        lastName:   decoded.family_name ?? '',
        roles:      decoded.realm_access?.roles ?? [],
        keycloakId: decoded.sub,
        subscriptionStatus: decoded.subscriptionStatus,
      },
      at,
      rt,
      expiresIn,
    );

    if (typeof window !== 'undefined') {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: at }),
        credentials: 'include',
      }).catch(() => undefined);
    }

    const safeRedirect = sanitizeRedirectPath(redirectTo);
    if (safeRedirect) {
      router.push(safeRedirect);
      return;
    }

    // Route based on role
    const roles: string[] = decoded.realm_access?.roles ?? [];
    if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN') || roles.includes('SUPPORT')) {
      router.push('/admin');
    } else {
      router.push('/portal');
    }
  }, [setSession, router]);

  const logout = useCallback(async (customRedirect?: string) => {
    try {
      if (accessToken) await api.post('/auth/logout');
    } catch { /* ignore */ }
    if (typeof window !== 'undefined') {
      await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
      await fetch('/api/auth/oidc/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    }
    clearSession();
    const target =
      customRedirect ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
        ? '/admin/login'
        : '/portal/login');
    router.push(target);
  }, [accessToken, clearSession, router]);

  const refresh = useCallback(async () => {
    if (!refreshToken) { clearSession(); return; }
    try {
      const res = await api.post('/auth/refresh', { refreshToken });
      const { accessToken: at, refreshToken: rt, expiresIn } = res.data.data;
      const decoded = parseJwt(at);
      if (!decoded || !user) { clearSession(); return; }
      setSession(user, at, rt, expiresIn);
      if (typeof window !== 'undefined') {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: at }),
          credentials: 'include',
        }).catch(() => undefined);
      }
    } catch {
      clearSession();
    }
  }, [refreshToken, user, setSession, clearSession]);

  return { user, accessToken, isAuthenticated, hasRole, isTokenExpired, login, logout, refresh };
}
