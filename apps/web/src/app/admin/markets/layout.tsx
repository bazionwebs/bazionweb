import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Markets & Regional Pricing',
  description: 'Manage localized regional rates, currencies, and tax rules.',
};

export default function AdminMarketsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
