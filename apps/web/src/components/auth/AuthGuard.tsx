'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { resolveApiV1Base } from '@/lib/api-base';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  redirectTo?: string;
}

export default function AuthGuard({ children, requiredRoles = [], redirectTo = '/portal/login' }: AuthGuardProps) {
  const { isAuthenticated, hasRole, isTokenExpired, refresh, logout } = useAuth();
  const user = useAuthStore(s => s.user);
  const refreshToken = useAuthStore(s => s.refreshToken);
  const setSubscriptionStatus = useAuthStore(s => s.setSubscriptionStatus);
  const storeHydrated = useAuthStore(s => s._hasHydrated);
  const hasHydrated = storeHydrated || (typeof window !== 'undefined' && !!useAuthStore.persist?.hasHydrated?.());
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'verifying' | 'authorized' | 'unauthorized' | 'timeout'>('verifying');
  const isRedirectingRef = useRef(false);

  // Safety valve: if authentication verification takes > 10 seconds, do NOT fail open;
  // transition to timeout state so protected children are never leaked to unauthenticated users.
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setStatus(current => (current === 'verifying' ? 'timeout' : current));
    }, 10000);

    return () => clearTimeout(safetyTimer);
  }, [pathname]);

  useEffect(() => {
    // Wait until hydration completes
    if (!hasHydrated) {
      return;
    }

    let active = true;

    async function check() {
      // If token expired and a refresh token is present, try refresh first
      if (isTokenExpired() && refreshToken) {
        await refresh();
        if (!active) return;
      }

      const normalizedPath = pathname.replace(/\/+$/, '') || '/';
      const redirectUnlessHere = (target: string): boolean => {
        const normTarget = target.replace(/\/+$/, '') || '/';
        if (normTarget === normalizedPath) return false;
        isRedirectingRef.current = true;
        router.replace(target);
        return true;
      };

      if (!isAuthenticated()) {
        if (redirectUnlessHere(redirectTo)) return;
        if (active) setStatus('unauthorized');
        return;
      }

      // Role check
      if (requiredRoles.length > 0) {
        const permitted = requiredRoles.some(r => hasRole(r));
        if (!permitted) {
          if (redirectUnlessHere('/portal')) return;
          if (active) setStatus('unauthorized');
          return;
        }
      }

      // ── Subscription gate ───────────────────────────────────────────────────
      const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].some(r => hasRole(r));
      const onOnboarding = normalizedPath === '/portal/onboarding' || normalizedPath.startsWith('/portal/onboarding/');
      const sessionUser = useAuthStore.getState().user;
      let subStatus = sessionUser?.subscriptionStatus;

      if (!isAdminRole) {
        const liveToken = useAuthStore.getState().accessToken;
        if (liveToken) {
          try {
            const res = await fetch(`${resolveApiV1Base()}/clients/me`, {
              headers: { Authorization: `Bearer ${liveToken}` },
              signal: AbortSignal.timeout(6000),
            });

            if (res.status === 401) {
              await logout();
              if (active) setStatus('unauthorized');
              return;
            }

            if (res.ok) {
              const body = await res.json().catch(() => ({}));
              const client = body?.data ?? body;
              const entitled =
                client?.status === 'ACTIVE' ||
                (Array.isArray(client?.subscriptions) && client.subscriptions.length > 0);
              subStatus = entitled ? 'ACTIVE' : 'PENDING';
              setSubscriptionStatus(subStatus);
            }
          } catch {
            // Network failure: fall back to the cached status. Server-side
            // SubscriptionGuard remains the authority on every API call.
          }
        }

        if (!onOnboarding && (!subStatus || subStatus === 'PENDING' || subStatus === 'NONE')) {
          if (redirectUnlessHere('/portal/onboarding')) return;
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      if (active) setStatus('authorized');
    }

    check();

    return () => {
      active = false;
    };
  }, [pathname, hasHydrated, refreshToken, user?.subscriptionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnboarding = pathname === '/portal/onboarding' || pathname.startsWith('/portal/onboarding/');

  if (status === 'verifying') {
    return (
      <div className={`min-h-screen ${isOnboarding ? 'bg-[#0A0F1D]' : 'bg-[#F8FAFC]'} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
          <span className={`text-sm ${isOnboarding ? 'text-slate-400' : 'text-slate-500'}`}>Authenticating…</span>
        </div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className={`min-h-screen ${isOnboarding ? 'bg-[#0A0F1D]' : 'bg-[#F8FAFC]'} flex items-center justify-center p-4`}>
        <div className="max-w-md w-full bg-white rounded-2xl p-6 text-center shadow-xl border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-2">Connection Timeout</h3>
          <p className="text-sm text-slate-500 mb-5">
            Unable to verify session in time. Please check your network connection and retry.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 bg-[#2563EB] text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (status !== 'authorized') {
    return null;
  }

  return <>{children}</>;
}
