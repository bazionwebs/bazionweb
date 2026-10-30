import type { Metadata } from 'next';
import QueryProvider from '@/components/providers/QueryProvider';
import AdminGate from '@/components/auth/AdminGate';

export const metadata: Metadata = {
  title: { default: 'Admin Operations', template: '%s | Admin — BazionWeb' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AdminGate>{children}</AdminGate>
    </QueryProvider>
  );
}
