import { Suspense } from 'react';
import type { Metadata } from 'next';
import PricingView from '@/components/pricing/PricingView';
import JsonLd from '@/components/seo/JsonLd';
import { getServerMarket } from '@/lib/geoDetection';
import { MarketCode } from '@/lib/marketEngine';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { market } = await getServerMarket();
  const isKe = market === 'KE';

  return {
    title: 'Transparent Pricing — Websites, E-Commerce & Systems | BazionWeb',
    description: isKe
      ? 'Clear 2026 pricing for websites, e-commerce, custom digital systems, and website care in Kenya (KES + M-Pesa). Transparent fixed deliverables, no hidden fees.'
      : 'Clear 2026 pricing for websites, e-commerce, custom digital systems, and website care worldwide (USD). Transparent fixed deliverables, no hidden fees.',
    alternates: { canonical: 'https://bazionweb.com/pricing' },
    keywords: isKe
      ? [
          'web design pricing Kenya',
          'website development cost Kenya',
          'website price KES',
          'website maintenance pricing Kenya',
          'e-commerce website cost Kenya',
          'custom web app pricing',
          'BazionWeb pricing',
        ]
      : [
          'web design pricing USD',
          'website development cost USD',
          'website price USD',
          'web development cost USD',
          'website maintenance pricing',
          'e-commerce website cost USD',
          'custom web app pricing',
          'BazionWeb pricing',
        ],
  };
}

function getPricingSchema(market: MarketCode) {
  const isKe = market === 'KE';
  const areaServed = isKe ? 'Kenya' : 'Worldwide';

  const offers = isKe
    ? [
        // ── Website Design & Development (KE / KES) ───────────────────────────
        {
          '@type': 'Offer',
          name: 'Launch Website Package',
          price: '25000',
          priceCurrency: 'KES',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Business Website Package',
          price: '90000',
          priceCurrency: 'KES',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Professional Website Package',
          price: '160000',
          priceCurrency: 'KES',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        // ── E-Commerce (KE / KES) ─────────────────────────────────────────────
        {
          '@type': 'Offer',
          name: 'E-Commerce Store (Starter)',
          price: '90000',
          priceCurrency: 'KES',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'E-Commerce Store (Business)',
          price: '175000',
          priceCurrency: 'KES',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        // ── Website Care & Maintenance (KE / KES) ─────────────────────────────
        {
          '@type': 'Offer',
          name: 'Care Essential Plan — Monthly',
          price: '5000',
          priceCurrency: 'KES',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Care Business Plan — Monthly',
          price: '10000',
          priceCurrency: 'KES',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        // ── Custom Systems & Portals (KE / KES) ───────────────────────────────
        {
          '@type': 'Offer',
          name: 'Custom Digital System — Discovery & Architecture',
          price: '25000',
          priceCurrency: 'KES',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Custom Digital System — Minimum Build',
          price: '180000',
          priceCurrency: 'KES',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
      ]
    : [
        // ── Website Design & Development (GLOBAL / USD) ───────────────────────
        {
          '@type': 'Offer',
          name: 'Launch Website Package',
          price: '450',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Business Website Package',
          price: '950',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Professional Website Package',
          price: '1750',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        // ── E-Commerce (GLOBAL / USD) ─────────────────────────────────────────
        {
          '@type': 'Offer',
          name: 'E-Commerce Store (Starter)',
          price: '890',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'E-Commerce Store (Business)',
          price: '1650',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        // ── Website Care & Maintenance (GLOBAL / USD) ─────────────────────────
        {
          '@type': 'Offer',
          name: 'Care Essential Plan — Monthly',
          price: '75',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Care Business Plan — Monthly',
          price: '150',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        // ── Custom Systems & Portals (GLOBAL / USD) ───────────────────────────
        {
          '@type': 'Offer',
          name: 'Custom Digital System — Discovery & Architecture',
          price: '500',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Custom Digital System — Minimum Build',
          price: '2200',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
          url: 'https://bazionweb.com/pricing',
        },
      ];

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'BazionWeb Digital Engineering & Website Care Plans',
    description: isKe
      ? 'Professional websites, e-commerce stores, custom systems, and ongoing website care & maintenance. Transparent pricing for Kenyan businesses.'
      : 'Professional websites, e-commerce stores, custom systems, and ongoing website care & maintenance. Transparent pricing for international clients.',
    brand: { '@type': 'Brand', name: 'BazionWeb' },
    areaServed,
    offers,
  };
}

export default async function PricingPage() {
  const { market } = await getServerMarket();
  const pricingSchema = getPricingSchema(market);

  return (
    <>
      <JsonLd data={pricingSchema} />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0F172A] pt-40 flex items-center justify-center text-white">
            Loading 2026 pricing schedule...
          </div>
        }
      >
        <PricingView initialMarket={market} />
      </Suspense>
    </>
  );
}
