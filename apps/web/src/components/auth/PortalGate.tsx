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
const PUBLIC_PORTAL_PATHS = ['/portal/login', '/portal/claim', '/portal/register'];

export default function PortalGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PORTAL_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthGuard requiredRoles={['CLIENT', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT']} redirectTo="/portal/login">
      <PortalShell>{children}</PortalShell>
    </AuthGuard>
  );
}
