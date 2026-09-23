import type { Metadata } from 'next';

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
      {children}
    </div>
  );
}
