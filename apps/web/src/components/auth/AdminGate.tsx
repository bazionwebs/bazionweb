'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import AuthGuard from './AuthGuard';
import AdminShell from '@/components/admin/AdminShell';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'];

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login' || pathname.startsWith('/admin/login/');

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <AuthGuard
      requiredRoles={ADMIN_ROLES}
      redirectTo="/admin/login"
    >
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}

