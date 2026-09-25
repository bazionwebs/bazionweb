import type { Metadata } from 'next';
import QueryProvider from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: {
    default: 'Client Portal | BazionWeb',
    template: '%s | Portal — BazionWeb',
  },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <QueryProvider>{children}</QueryProvider>
    </div>
  );
}
