import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Instant Website & Systems Quote Calculator',
  description:
    'Calculate your instant website development, e-commerce store, custom software, and monthly care plan estimate with BazionWeb.',
  alternates: { canonical: 'https://bazionwebs.com/quote' },
};

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
