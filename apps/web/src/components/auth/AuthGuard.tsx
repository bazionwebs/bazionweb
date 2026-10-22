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

      if (!isAuthenticated()) {
        router.replace(redirectTo);
        return;
      }

      // Role check
      if (requiredRoles.length > 0) {
        const permitted = requiredRoles.some(r => hasRole(r));
        if (!permitted) {
          router.replace('/portal');
          return;
        }
      }

      // ── Subscription gate ───────────────────────────────────────────────────
      // Non-admin clients with PENDING or missing subscriptionStatus must
      // complete onboarding (payment) before accessing the dashboard. Never
      // redirect when already on /portal/onboarding — that caused an infinite
      // "Authenticating…" loop (redirect target === current page).
      const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].some(r => hasRole(r));
      const onOnboarding = pathname === '/portal/onboarding' || pathname.startsWith('/portal/onboarding/');
      if (!isAdminRole && !onOnboarding) {
        const subStatus = user?.subscriptionStatus;
        if (!subStatus || subStatus === 'PENDING' || subStatus === 'NONE') {
          router.replace('/portal/onboarding');
          return;
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
