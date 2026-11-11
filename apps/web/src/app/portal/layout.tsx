import type { Metadata } from 'next';
import QueryProvider from '@/components/providers/QueryProvider';
import PortalGate from '@/components/auth/PortalGate';

export const metadata: Metadata = {
  title: {
    default: 'Client Portal Dashboard',
    template: '%s | Portal — BazionWeb',
  },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <PortalGate>{children}</PortalGate>
    </QueryProvider>
  );
}
