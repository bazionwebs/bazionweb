import type { Metadata } from 'next';
import QueryProvider from '@/components/providers/QueryProvider';
import AuthGuard from '@/components/auth/AuthGuard';
import PortalShell from '@/components/portal/PortalShell';

export const metadata: Metadata = {
  title: {
    default: 'Client Portal | BazionWeb',
    template: '%s | Portal — BazionWeb',
  },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthGuard
        requiredRoles={['CLIENT', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT']}
        redirectTo="/portal/login"
      >
        <PortalShell>{children}</PortalShell>
      </AuthGuard>
    </QueryProvider>
  );
}
