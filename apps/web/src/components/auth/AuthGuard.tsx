'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  redirectTo?: string;
}

export default function AuthGuard({ children, requiredRoles = [], redirectTo = '/portal/login' }: AuthGuardProps) {
  const { isAuthenticated, hasRole, isTokenExpired, refresh } = useAuth();
  const user = useAuthStore(s => s.user);
  const refreshToken = useAuthStore(s => s.refreshToken);
  const storeHydrated = useAuthStore(s => s._hasHydrated);
  const hasHydrated = storeHydrated || (typeof window !== 'undefined' && !!useAuthStore.persist?.hasHydrated?.());
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const isRedirectingRef = useRef(false);

  // Safety valve: prevent any infinite deadlock
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setChecking(false);
    }, 2500);

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
        // Release checking after transition delay so we never deadlock
        setTimeout(() => {
          if (active) setChecking(false);
        }, 500);
        return true;
      };

      if (!isAuthenticated()) {
        if (redirectUnlessHere(redirectTo)) return;
        if (active) setChecking(false);
        return;
      }

      // Role check
      if (requiredRoles.length > 0) {
        const permitted = requiredRoles.some(r => hasRole(r));
        if (!permitted) {
          if (redirectUnlessHere('/portal')) return;
          if (active) setChecking(false);
          return;
        }
      }

      // ── Subscription gate ───────────────────────────────────────────────────
      // Non-admin clients with PENDING or missing subscriptionStatus must
      // complete onboarding (payment) before accessing the dashboard. Never
      // redirect when already on /portal/onboarding.
      const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].some(r => hasRole(r));
      const onOnboarding = normalizedPath === '/portal/onboarding' || normalizedPath.startsWith('/portal/onboarding/');
      if (!isAdminRole && !onOnboarding) {
        const subStatus = user?.subscriptionStatus;
        if (!subStatus || subStatus === 'PENDING' || subStatus === 'NONE') {
          if (redirectUnlessHere('/portal/onboarding')) return;
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      if (active) setChecking(false);
    }

    check();

    return () => {
      active = false;
    };
  }, [pathname, hasHydrated, refreshToken, user?.subscriptionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    const isOnboarding = pathname === '/portal/onboarding' || pathname.startsWith('/portal/onboarding/');
    return (
      <div className={`min-h-screen ${isOnboarding ? 'bg-[#0A0F1D]' : 'bg-[#F8FAFC]'} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
          <span className={`text-sm ${isOnboarding ? 'text-slate-400' : 'text-slate-500'}`}>Authenticating…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
