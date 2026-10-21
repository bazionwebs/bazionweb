import type { Metadata } from 'next';
import PricingView from '@/components/pricing/PricingView';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Transparent Pricing — Websites, E-Commerce & Systems | BazionWeb',
  description:
    'Clear 2026 pricing for websites, e-commerce, custom digital systems, and website care. Kenya market (KES + M-Pesa) and International (USD). No hidden fees.',
  alternates: { canonical: 'https://bazionweb.com/pricing' },
  keywords: [
    'web design pricing Kenya', 'website development cost Kenya', 'website price KES',
    'web development cost USD', 'website maintenance pricing', 'e-commerce website cost',
    'custom web app pricing', 'BazionWeb pricing',
  ],
};

const pricingSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'BazionWeb Digital Engineering & Website Care Plans',
  description:
    'Professional websites, e-commerce stores, custom systems, and ongoing website care & maintenance. Transparent dual-market pricing for Kenya (KES) and International (USD) clients.',
  brand: { '@type': 'Brand', name: 'BazionWeb' },
  offers: [
    // ── Website Design & Development ─────────────────────────────────────────
    {
      '@type': 'Offer',
      name: 'Launch Website Package (Kenya)',
      price: '25000', priceCurrency: 'KES',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Business Website Package (Kenya)',
      price: '90000', priceCurrency: 'KES',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Launch Website Package (International)',
      price: '495', priceCurrency: 'USD',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Business Website Package (International)',
      price: '1500', priceCurrency: 'USD',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    // ── E-Commerce ───────────────────────────────────────────────────────────
    {
      '@type': 'Offer',
      name: 'E-Commerce Store (Kenya)',
      price: '90000', priceCurrency: 'KES',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'E-Commerce Store (International)',
      price: '1500', priceCurrency: 'USD',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    // ── Website Care & Maintenance ────────────────────────────────────────────
    {
      '@type': 'Offer',
      name: 'Starter Care Plan (Kenya) — Monthly',
      price: '5000', priceCurrency: 'KES',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Starter Care Plan (International) — Monthly',
      price: '75', priceCurrency: 'USD',  // ← corrected: was $49, canonical is $75
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    // ── Custom Systems & Portals ─────────────────────────────────────────────
    {
      '@type': 'Offer',
      name: 'Custom Digital System (Kenya) — From',
      price: '150000', priceCurrency: 'KES',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://bazionweb.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Custom Digital System (International) — From',
      price: '2500', priceCurrency: 'USD',
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

