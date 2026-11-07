'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import AuthGuard from './AuthGuard';
import PortalShell from '@/components/portal/PortalShell';

/**
 * Public routes under /portal must not sit behind the auth guard: the guard
 * redirects unauthenticated users to /portal/login, and parking the login
 * page inside the guard created an infinite "Authenticating…" loop (redirect
 * target === guarded page). Claim is public by design (pay-first checkout;
 * no session exists yet). Register is a server redirect to /checkout.
 */
const PUBLIC_PORTAL_PATHS = [
  '/portal/login',
  '/portal/claim',
  '/portal/register',
  '/portal/reset-password',
];
const PORTAL_ROLES = ['CLIENT', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT'];

export default function PortalGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PORTAL_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isPublic) {
    return <>{children}</>;
  }

  // Onboarding has its own standalone full-screen layout.
  // It requires authentication, but must NOT be nested inside PortalShell.
  const isOnboarding = pathname === '/portal/onboarding' || pathname.startsWith('/portal/onboarding/');
  if (isOnboarding) {
    return (
      <AuthGuard key="onboarding-guard" requiredRoles={PORTAL_ROLES} redirectTo="/portal/login">
        {children}
      </AuthGuard>
    );
  }

  return (
    <AuthGuard key="portal-shell-guard" requiredRoles={PORTAL_ROLES} redirectTo="/portal/login">
      <PortalShell>{children}</PortalShell>
    </AuthGuard>
  );
}
