import type { Metadata } from 'next';
import QueryProvider from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin — BazionWeb' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <QueryProvider>{children}</QueryProvider>
    </div>
  );
}
