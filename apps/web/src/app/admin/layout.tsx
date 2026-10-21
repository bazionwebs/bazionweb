import type { Metadata } from 'next';
import QueryProvider from '@/components/providers/QueryProvider';
import AuthGuard from '@/components/auth/AuthGuard';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  title: { default: 'Admin Operations', template: '%s | Admin — BazionWeb' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthGuard
        requiredRoles={['ADMIN', 'SUPER_ADMIN', 'SUPPORT']}
        redirectTo="/portal/login"
      >
        <AdminShell>{children}</AdminShell>
      </AuthGuard>
    </QueryProvider>
  );
}
