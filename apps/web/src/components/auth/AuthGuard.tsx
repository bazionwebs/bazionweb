'use client';

import { useEffect, useState } from 'react';
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
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      // If token expired, try refresh first
      if (isTokenExpired()) {
        await refresh();
      }

      // Redirecting to the page we're already on is a no-op in the App Router:
      // `checking` would stay true forever ("Authenticating…" deadlock). Guard
      // every redirect; when the target is the current path, render instead.
      const normalizedPath = pathname.replace(/\/+$/, '') || '/';
      const redirectUnlessHere = (target: string): boolean => {
        if (target.replace(/\/+$/, '') === normalizedPath) return false;
        router.replace(target);
        return true;
      };

      if (!isAuthenticated()) {
        if (redirectUnlessHere(redirectTo)) return;
        setChecking(false);
        return;
      }

      // Role check
      if (requiredRoles.length > 0) {
        const permitted = requiredRoles.some(r => hasRole(r));
        if (!permitted) {
          if (redirectUnlessHere('/portal')) return;
          // Signed in but the persisted session lacks a usable role while
          // already on /portal — don't deadlock; let the page render and the
          // API enforce authorization on each call.
          setChecking(false);
          return;
        }
      }

      // ── Subscription gate ───────────────────────────────────────────────────
      // Non-admin clients with PENDING or missing subscriptionStatus must
      // complete onboarding (payment) before accessing the dashboard. Never
      // redirect when already on /portal/onboarding — that caused an infinite
      // "Authenticating…" loop (redirect target === current page).
      const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].some(r => hasRole(r));
      const onOnboarding = normalizedPath === '/portal/onboarding' || normalizedPath.startsWith('/portal/onboarding/');
      if (!isAdminRole && !onOnboarding) {
        const subStatus = user?.subscriptionStatus;
        if (!subStatus || subStatus === 'PENDING' || subStatus === 'NONE') {
          if (redirectUnlessHere('/portal/onboarding')) return;
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      setChecking(false);
    }
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
          <span className="text-sm text-slate-400">Authenticating…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
