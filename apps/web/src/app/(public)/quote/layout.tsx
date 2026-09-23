import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Instant Quote Calculator',
  description:
    'Calculate your instant website development, managed cloud hosting, maintenance, and security quote with BazionWeb.',
  alternates: { canonical: 'https://bazionweb.com/quote' },
};

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
