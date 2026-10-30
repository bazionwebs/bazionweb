import type { Metadata } from 'next';
import QueryProvider from '@/components/providers/QueryProvider';
import AuthGuard from '@/components/auth/AuthGuard';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  title: { default: 'Admin Operations', template: '%s | Admin — BazionWeb' },
  robots: { index: false, follow: false },
};

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthGuard
        requiredRoles={ADMIN_ROLES}
        redirectTo="/portal/login"
      >
        <AdminShell>{children}</AdminShell>
      </AuthGuard>
    </QueryProvider>
  );
}
