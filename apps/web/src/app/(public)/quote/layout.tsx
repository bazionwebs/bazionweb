import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Instant Website & Systems Quote Calculator | BazionWeb Kenya',
  description:
    'Calculate your instant website development, e-commerce store, custom software, and monthly care plan estimate with BazionWeb. Transparent 2026 pricing in KES and USD.',
  alternates: { canonical: 'https://bazionweb.com/quote' },
  keywords: [
    'website cost calculator Kenya',
    'web design quote Nairobi',
    'ecommerce price estimator',
    'website pricing calculator',
  ],
  openGraph: {
    title: 'Instant Website & Systems Quote Calculator | BazionWeb',
    description:
      'Calculate your instant website development, e-commerce store, custom software, and monthly care plan estimate with BazionWeb.',
    url: 'https://bazionweb.com/quote',
    siteName: 'BazionWeb',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BazionWeb Quote Calculator' }],
    locale: 'en_US',
    type: 'website',
  },
};

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
