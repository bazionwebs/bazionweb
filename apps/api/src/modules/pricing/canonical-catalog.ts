/**
 * Shared Authoritative Canonical Catalog & Alias Registry
 *
 * Synchronized 1:1 with `apps/web/src/lib/priceBooks.ts` (`KE-2026-v1` & `GLOBAL-2026-v1`)
 * and `prisma/seed.ts`.
 *
 * - Database `Price` rows ALWAYS take precedence when present (so admin DB overrides win).
 * - `resolveCanonicalProductId()` maps every legacy, unprefixed rate-card ID (e.g. `extra-page`,
 *   `blog-news`, `booking-system`, `mpesa-integration`), naive `addon-*` prefix, and B2B `pkg-*`
 *   identifier to its canonical price-book `productId`.
 * - `CANONICAL_CATALOG_PRICES` guarantees checkout and quote generation never fail with
 *   `"is not available in the ... price book"` when a valid catalog item has not yet been
 *   re-seeded into the live PostgreSQL `prices` table.
 */

export interface CanonicalCatalogEntry {
  name: string;
  KES: number;
  USD: number;
  billingPeriod?: string;
}

export const CATALOG_PRODUCT_ALIASES: Record<string, string> = {
  // Websites & E-Commerce
  existing: 'website-existing',
  'existing-website': 'website-existing',
  byow: 'website-existing',
  'pkg-launch': 'website-launch',
  'website-starter': 'website-launch',
  'pkg-business': 'website-business',
  'website-pro': 'website-professional',
  'pkg-professional': 'website-professional',
  'website-corporate': 'website-enterprise',
  'pkg-custom-app': 'website-enterprise',
  'ecom-starter': 'ecommerce-starter',
  'pkg-ecommerce': 'ecommerce-starter',
  'ecom-business': 'ecommerce-business',
  'pkg-ecommerce-business': 'ecommerce-business',
  'ecom-pro': 'ecommerce-enterprise',
  'ecommerce-pro': 'ecommerce-enterprise',
  'pkg-ecommerce-enterprise': 'ecommerce-enterprise',
  'service-admin-hub-pro': 'service-admin-hub-corporate',

  // Add-ons & Rates (short ADD_ON_RATE_CARD IDs + naive addon-* prefixes)
  'extra-page': 'rate-extra-page',
  'addon-extra-page': 'rate-extra-page',
  'extra-landing-page': 'rate-extra-landing-page',
  'addon-landing-page': 'rate-extra-landing-page',
  'admin-dashboard': 'addon-admin-dashboard',
  'blog-news': 'addon-blog-news',
  'blog-setup': 'addon-blog-news',
  'addon-blog-setup': 'addon-blog-news',
  'advanced-form': 'addon-advanced-form',
  'booking-system': 'addon-booking',
  'addon-booking-system': 'addon-booking',
  'payment-gateway': 'addon-payment-gateway',
  'addon-card-gateway': 'addon-payment-gateway',
  'addon-multi-currency': 'addon-payment-gateway',
  'mpesa-integration': 'addon-mpesa',
  'addon-mpesa-integration': 'addon-mpesa',
  newsletter: 'addon-newsletter',
  'advanced-seo': 'addon-seo-advanced',
  'addon-advanced-seo': 'addon-seo-advanced',
  'addon-seo-audit': 'addon-seo-advanced',
  copywriting: 'addon-copywriting',
  migration: 'addon-migration',
  'extra-revision': 'addon-extra-revision',
  'custom-api': 'addon-custom-api',
  'addon-crm-erp': 'addon-custom-api',
  multilingual: 'addon-multilingual',
  'document-hub': 'addon-document-hub',
  'addon-ga4-pixel': 'addon-analytics',
  'addon-brand-refresh': 'addon-logo-brand',
};

export function resolveCanonicalProductId(rawId: string): string {
  const clean = (rawId || '').trim();
  if (!clean) return clean;
  return CATALOG_PRODUCT_ALIASES[clean] || CATALOG_PRODUCT_ALIASES[clean.toLowerCase()] || clean;
}

const BASE_CATALOG_PRICES: Record<string, CanonicalCatalogEntry> = {
  // Step 1: Websites & E-Commerce Builds
  'website-existing': { name: 'Existing Website / App Onboarding', KES: 0, USD: 0, billingPeriod: 'one-time' },
  'website-launch': { name: 'Launch Website', KES: 25000, USD: 450, billingPeriod: 'one-time' },
  'website-business': { name: 'Business Website', KES: 90000, USD: 950, billingPeriod: 'one-time' },
  'website-professional': { name: 'Professional Website', KES: 160000, USD: 1750, billingPeriod: 'one-time' },
  'website-enterprise': { name: 'Enterprise Architecture', KES: 320000, USD: 3600, billingPeriod: 'starting' },
  'ecommerce-starter': { name: 'E-Commerce Starter', KES: 90000, USD: 890, billingPeriod: 'one-time' },
  'ecommerce-business': { name: 'E-Commerce Business', KES: 175000, USD: 1650, billingPeriod: 'one-time' },
  'ecommerce-enterprise': { name: 'E-Commerce Enterprise', KES: 320000, USD: 3600, billingPeriod: 'starting' },

  // Step 1: Custom Digital Systems & Admin Hubs
  'service-admin-hub-starter': { name: 'Standalone Admin Media Hub (Retrofit)', KES: 45000, USD: 490, billingPeriod: 'starting' },
  'service-admin-hub-corporate': { name: 'Corporate Operations Desk & Multi-User Admin', KES: 85000, USD: 890, billingPeriod: 'starting' },
  'custom-tier-1': { name: 'Client Portals & API Gateways', KES: 180000, USD: 2200, billingPeriod: 'starting' },
  'custom-tier-2': { name: 'SaaS MVP & Internal Tools', KES: 350000, USD: 3900, billingPeriod: 'starting' },
  'custom-tier-3': { name: 'Enterprise Core Platforms', KES: 750000, USD: 8500, billingPeriod: 'starting' },

  // Step 1B: Add-Ons & Rate Card Items
  'rate-extra-page': { name: 'Additional Page Build', KES: 2000, USD: 40, billingPeriod: 'one-time' },
  'rate-extra-landing-page': { name: 'Standalone Landing Page / Funnel', KES: 15000, USD: 149, billingPeriod: 'one-time' },
  'addon-admin-dashboard': { name: 'Bespoke Client Admin & Media Upload Hub', KES: 25000, USD: 299, billingPeriod: 'one-time' },
  'addon-blog-news': { name: 'Blog / News Engine', KES: 7500, USD: 120, billingPeriod: 'one-time' },
  'addon-advanced-form': { name: 'Advanced Form / Survey', KES: 5000, USD: 80, billingPeriod: 'one-time' },
  'addon-booking': { name: 'Online Booking System', KES: 15000, USD: 220, billingPeriod: 'one-time' },
  'addon-payment-gateway': { name: 'Card Payment Gateway', KES: 10000, USD: 150, billingPeriod: 'one-time' },
  'addon-mpesa': { name: 'M-Pesa STK Push Integration', KES: 10000, USD: 150, billingPeriod: 'one-time' },
  'addon-newsletter': { name: 'Newsletter Integration', KES: 5000, USD: 80, billingPeriod: 'one-time' },
  'addon-seo-advanced': { name: 'Advanced SEO Foundation', KES: 15000, USD: 220, billingPeriod: 'one-time' },
  'addon-copywriting': { name: 'Professional Copywriting', KES: 10000, USD: 180, billingPeriod: 'one-time' },
  'addon-migration': { name: 'Website Migration', KES: 5000, USD: 80, billingPeriod: 'one-time' },
  'addon-extra-revision': { name: 'Additional Revision Round', KES: 3000, USD: 50, billingPeriod: 'one-time' },
  'addon-custom-api': { name: 'Custom API Integration', KES: 15000, USD: 240, billingPeriod: 'one-time' },
  'addon-multilingual': { name: 'Multilingual Support (i18n)', KES: 15000, USD: 240, billingPeriod: 'one-time' },
  'addon-document-hub': { name: 'Document Download Hub', KES: 6000, USD: 120, billingPeriod: 'one-time' },

  // Legacy add-on / rate SKUs retained for backwards compatibility
  'rate-copywriting-page': { name: 'Professional Copywriting (per page)', KES: 2500, USD: 30, billingPeriod: 'one-time' },
  'addon-chat-whatsapp': { name: 'Live Chat & WhatsApp Automation', KES: 6500, USD: 65, billingPeriod: 'one-time' },
  'addon-analytics': { name: 'Google Analytics 4, Tag Manager & Meta Pixel', KES: 8500, USD: 85, billingPeriod: 'one-time' },
  'addon-logo-brand': { name: 'Logo & Brand Identity Kit', KES: 15000, USD: 150, billingPeriod: 'one-time' },
  'rate-product-upload-25': { name: 'E-Commerce Product Upload (per 25 items)', KES: 5000, USD: 50, billingPeriod: 'one-time' },

  // Step 2: Domains
  'domain-existing': { name: 'Connect Existing Domain (DNS & SSL)', KES: 0, USD: 0, billingPeriod: 'one-time' },
  'domain-co-ke': { name: 'Register .co.ke / .or.ke Domain', KES: 1500, USD: 15, billingPeriod: 'year' },
  'domain-com': { name: 'Register .com / .net Domain', KES: 2500, USD: 20, billingPeriod: 'year' },
  'domain-org': { name: 'Register .org / .africa / .io Domain', KES: 3500, USD: 28, billingPeriod: 'year' },

  // Step 3: Managed Hosting (Base Annual + Explicit Cloud Cycles)
  'host-essential': { name: 'Essential Hosting', KES: 4500, USD: 49, billingPeriod: 'year' },
  'host-business': { name: 'Business Hosting', KES: 8500, USD: 99, billingPeriod: 'year' },
  'host-pro': { name: 'Host Professional', KES: 15000, USD: 189, billingPeriod: 'year' },
  'host-professional': { name: 'Host Professional', KES: 15000, USD: 189, billingPeriod: 'year' },
  'host-cloud': { name: 'Managed Cloud Cluster', KES: 30000, USD: 300, billingPeriod: 'year' },
  'host-cloud-monthly': { name: 'Managed Cloud (Monthly)', KES: 3200, USD: 32, billingPeriod: 'month' },
  'host-cloud-quarterly': { name: 'Managed Cloud (3 Months / Quarterly)', KES: 9120, USD: 91, billingPeriod: 'quarter' },
  'host-cloud-semiannual': { name: 'Managed Cloud (6 Months / Semi-Annual)', KES: 17280, USD: 172, billingPeriod: 'half-year' },
  'host-cloud-annual': { name: 'Managed Cloud (Annual / 12 Months)', KES: 30000, USD: 290, billingPeriod: 'year' },

  // Step 4: Care Plans (for quote fallback parity)
  'care-essential': { name: 'Care Essential', KES: 5000, USD: 75, billingPeriod: 'month' },
  'care-business': { name: 'Care Business', KES: 10000, USD: 150, billingPeriod: 'month' },
  'care-professional': { name: 'Care Professional', KES: 20000, USD: 300, billingPeriod: 'month' },
  'care-enterprise': { name: 'Care Enterprise', KES: 40000, USD: 400, billingPeriod: 'month' },
};

function computeCycleAmount(baseMonthly: number, durationMonths: number, discountPct: number, isKes: boolean): number {
  const monthlyEq = isKes
    ? Math.round(baseMonthly * (1 - discountPct / 100))
    : Math.round(baseMonthly * (1 - discountPct / 100) * 100) / 100;
  return isKes
    ? Math.round(monthlyEq * durationMonths)
    : Math.round(monthlyEq * durationMonths * 100) / 100;
}

const HOSTING_MULTI_CYCLE_SPECS: Array<{
  slug: string;
  name: string;
  baseMonthlyKes: number;
  baseMonthlyUsd: number;
  canonicalAnnualKes: number;
  canonicalAnnualUsd: number;
}> = [
  { slug: 'host-essential', name: 'Essential Hosting', baseMonthlyKes: 500, baseMonthlyUsd: 5.5, canonicalAnnualKes: 4500, canonicalAnnualUsd: 49 },
  { slug: 'host-business', name: 'Business Hosting', baseMonthlyKes: 950, baseMonthlyUsd: 11, canonicalAnnualKes: 8500, canonicalAnnualUsd: 99 },
  { slug: 'host-pro', name: 'Host Professional', baseMonthlyKes: 1667, baseMonthlyUsd: 21, canonicalAnnualKes: 15000, canonicalAnnualUsd: 189 },
  { slug: 'host-professional', name: 'Host Professional', baseMonthlyKes: 1667, baseMonthlyUsd: 21, canonicalAnnualKes: 15000, canonicalAnnualUsd: 189 },
  { slug: 'host-cloud', name: 'Managed Cloud Cluster', baseMonthlyKes: 3200, baseMonthlyUsd: 32, canonicalAnnualKes: 30000, canonicalAnnualUsd: 300 },
];

const CYCLE_DEFS: Array<{ suffix: string; label: string; months: number; discountPct: number; billingPeriod: string }> = [
  { suffix: 'monthly', label: 'Monthly', months: 1, discountPct: 0, billingPeriod: 'month' },
  { suffix: 'quarterly', label: 'Quarterly', months: 3, discountPct: 5, billingPeriod: 'quarter' },
  { suffix: 'semiannual', label: 'Semi-Annual', months: 6, discountPct: 10, billingPeriod: 'half-year' },
  { suffix: 'annual', label: 'Annual', months: 12, discountPct: 25, billingPeriod: 'year' },
  { suffix: 'biennial', label: '2 Years', months: 24, discountPct: 32, billingPeriod: '2-years' },
  { suffix: 'triennial', label: '3 Years', months: 36, discountPct: 40, billingPeriod: '3-years' },
];

for (const host of HOSTING_MULTI_CYCLE_SPECS) {
  for (const cycle of CYCLE_DEFS) {
    const key = `${host.slug}-${cycle.suffix}`;
    if (!BASE_CATALOG_PRICES[key]) {
      BASE_CATALOG_PRICES[key] = {
        name: `${host.name} (${cycle.label})`,
        KES:
          cycle.suffix === 'annual'
            ? host.canonicalAnnualKes
            : computeCycleAmount(host.baseMonthlyKes, cycle.months, cycle.discountPct, true),
        USD:
          cycle.suffix === 'annual'
            ? host.canonicalAnnualUsd
            : computeCycleAmount(host.baseMonthlyUsd, cycle.months, cycle.discountPct, false),
        billingPeriod: cycle.billingPeriod,
      };
    }
  }
}

export const CANONICAL_CATALOG_PRICES: Readonly<Record<string, CanonicalCatalogEntry>> = BASE_CATALOG_PRICES;
