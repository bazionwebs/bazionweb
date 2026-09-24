import type { Metadata } from 'next';
import PricingView from '@/components/pricing/PricingView';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Pricing Architecture — Websites, E-Commerce & Managed Technology | BazionWeb',
  description:
    'Transparent 2026 pricing for websites, e-commerce, custom software, managed cloud hosting, and ongoing care. Dual-market structure for Kenya (KES) and International (USD) clients.',
  alternates: { canonical: 'https://bazionweb.com/pricing' },
};

const pricingSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'BazionWeb Managed Website & Digital Engineering Services',
  description: 'Professional websites, e-commerce stores, custom systems, and managed hosting & care.',
  brand: {
    '@type': 'Brand',
    name: 'BazionWeb',
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Launch Website Package (Kenya)',
      price: '25000',
      priceCurrency: 'KES',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Business Website Package (Kenya)',
      price: '50000',
      priceCurrency: 'KES',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Launch Website Package (International)',
      price: '495',
      priceCurrency: 'USD',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Business Website Package (International)',
      price: '1250',
      priceCurrency: 'USD',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
  ],
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={pricingSchema} />
      <PricingView />
    </>
  );
}
