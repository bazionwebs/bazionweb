/**
 * BazionWeb Versioned Commercial Price Books
 *
 * Implements architectural requirement:
 * - Two completely separate price books: KE-2026-v1 (KES) and GLOBAL-2026-v1 (USD)
 * - Versioned IDs (e.g. KE-2026-v1, GLOBAL-2026-v1)
 * - Structured query engine: getPrice(productId, marketCode)
 * - Locked proposal snapshot data structure
 */

import { MarketCode, MARKETS } from './marketEngine';

export interface CommercialPriceItem {
  productId: string;
  category: 'website' | 'ecommerce' | 'custom' | 'care' | 'hosting' | 'addon' | 'rate';
  name: string;
  amount: number;
  currency: 'KES' | 'USD' | 'EUR' | 'GBP';
  formatted: string;
  billingPeriod?: 'one-time' | 'month' | 'year' | 'starting';
  description?: string;
  deliverables?: string[];
  features?: string[];
  pages?: string;
  timeline?: string;
  supportWarranty?: string;
  badge?: string;
  popular?: boolean;
}

export interface PriceBook {
  id: string; // e.g. "KE-2026-v1" or "GLOBAL-2026-v1"
  marketCode: MarketCode;
  marketName: string;
  version: string;
  currency: 'KES' | 'USD' | 'EUR' | 'GBP';
  currencySymbol: string;
  effectiveFrom: string;
  effectiveUntil: string;
  status: 'active' | 'archived' | 'draft';
  paymentRails: string[];
  items: Record<string, CommercialPriceItem>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🇰🇪 KENYA PRICE BOOK (KE-2026-v1)
// ─────────────────────────────────────────────────────────────────────────────
export const PRICE_BOOK_KE_2026_V1: PriceBook = {
  id: 'KE-2026-v1',
  marketCode: 'KE',
  marketName: 'Kenya',
  version: '2026-v1',
  currency: 'KES',
  currencySymbol: 'KSh',
  effectiveFrom: '2026-01-01',
  effectiveUntil: '2026-12-31',
  status: 'active',
  paymentRails: ['M-Pesa STK Push', 'Local Visa / Mastercard'],
  items: {
    // Websites
    'website-launch': {
      productId: 'website-launch',
      category: 'website',
      name: 'Launch Website',
      amount: 25000,
      currency: 'KES',
      formatted: 'KSh 25,000',
      billingPeriod: 'one-time',
      pages: 'Up to 5 pages',
      timeline: '5–10 working days',
      supportWarranty: '14-day warranty',
      badge: 'Starter',
      description: 'Polished digital storefront with mobile optimization, WhatsApp chat, and basic SEO.',
    },
    'website-business': {
      productId: 'website-business',
      category: 'website',
      name: 'Business Website',
      amount: 90000,
      currency: 'KES',
      formatted: 'KSh 90,000',
      billingPeriod: 'one-time',
      pages: 'Up to 10 pages',
      timeline: '10–18 working days',
      supportWarranty: '30-day warranty',
      badge: 'Most Popular',
      popular: true,
      description: 'Engineered corporate site with headless CMS, analytics, lead funnels, and verified speed.',
    },
    'website-professional': {
      productId: 'website-professional',
      category: 'website',
      name: 'Professional Website',
      amount: 160000,
      currency: 'KES',
      formatted: 'KSh 160,000',
      billingPeriod: 'one-time',
      pages: 'Up to 15 pages',
      timeline: '15–25 working days',
      supportWarranty: '60-day warranty',
      badge: 'Advanced UX',
      description: 'High-growth multi-service portal with custom interactive calculators, animations, and CRM sync.',
    },
    'website-enterprise': {
      productId: 'website-enterprise',
      category: 'website',
      name: 'Enterprise Architecture',
      amount: 320000,
      currency: 'KES',
      formatted: 'From KSh 320,000',
      billingPeriod: 'starting',
      pages: 'Bespoke scope',
      timeline: '4–8 weeks',
      supportWarranty: '90-day warranty',
      badge: 'Tailored',
      description: 'Multi-brand digital ecosystem with custom backend integrations and dedicated SLA.',
    },

    // E-Commerce
    'ecommerce-starter': {
      productId: 'ecommerce-starter',
      category: 'ecommerce',
      name: 'E-Commerce Starter',
      amount: 90000,
      currency: 'KES',
      formatted: 'KSh 90,000',
      billingPeriod: 'one-time',
      timeline: '10–18 working days',
      supportWarranty: '30-day warranty',
      description: 'Online store with up to 50 products, automated M-Pesa STK push & order notifications.',
    },
    'ecommerce-business': {
      productId: 'ecommerce-business',
      category: 'ecommerce',
      name: 'E-Commerce Business',
      amount: 175000,
      currency: 'KES',
      formatted: 'KSh 175,000',
      billingPeriod: 'one-time',
      popular: true,
      timeline: '3–5 weeks',
      supportWarranty: '60-day warranty',
      description: 'Full merchant setup with inventory sync, discount engines, courier integration, and card rails.',
    },
    'ecommerce-enterprise': {
      productId: 'ecommerce-enterprise',
      category: 'ecommerce',
      name: 'E-Commerce Enterprise',
      amount: 320000,
      currency: 'KES',
      formatted: 'From KSh 320,000',
      billingPeriod: 'starting',
      timeline: '6–10 weeks',
      supportWarranty: '90-day warranty',
      description: 'High-volume marketplace or multi-warehouse digital storefront with ERP connectors.',
    },

    // Custom Systems
    'custom-tier-1': {
      productId: 'custom-tier-1',
      category: 'custom',
      name: 'Client Portals & API Gateways',
      amount: 180000,
      currency: 'KES',
      formatted: 'From KSh 180,000',
      billingPeriod: 'starting',
      description: 'Secure self-service client dashboard, booking engine, or API data integration.',
    },
    'custom-tier-2': {
      productId: 'custom-tier-2',
      category: 'custom',
      name: 'SaaS MVP & Internal Tools',
      amount: 350000,
      currency: 'KES',
      formatted: 'From KSh 350,000',
      billingPeriod: 'starting',
      description: 'Custom subscription application, multi-tenant database, role-based access, and workflows.',
    },
    'custom-tier-3': {
      productId: 'custom-tier-3',
      category: 'custom',
      name: 'Enterprise Core Platforms',
      amount: 750000,
      currency: 'KES',
      formatted: 'From KSh 750,000',
      billingPeriod: 'starting',
      description: 'Microservices, real-time analytics pipelines, high-availability architecture with dedicated engineering.',
    },

    // Care Plans
    'care-essential': {
      productId: 'care-essential',
      category: 'care',
      name: 'Care Essential',
      amount: 5000,
      currency: 'KES',
      formatted: 'KSh 5,000/mo',
      billingPeriod: 'month',
      description: 'Offsite backups, security monitoring, CMS core updates, and 1 hour reserved maintenance.',
    },
    'care-business': {
      productId: 'care-business',
      category: 'care',
      name: 'Care Business',
      amount: 10000,
      currency: 'KES',
      formatted: 'KSh 10,000/mo',
      billingPeriod: 'month',
      popular: true,
      description: 'Daily backups, Web Vitals monitoring, SEO health checks, and 2 hours priority development.',
    },
    'care-professional': {
      productId: 'care-professional',
      category: 'care',
      name: 'Care Professional',
      amount: 20000,
      currency: 'KES',
      formatted: 'KSh 20,000/mo',
      billingPeriod: 'month',
      description: 'Active sprint development, 5 hours included engineering, quarterly strategy, and emergency response.',
    },

    // Hosting Plans
    'host-essential': {
      productId: 'host-essential',
      category: 'hosting',
      name: 'Essential Hosting',
      amount: 4500,
      currency: 'KES',
      formatted: 'KSh 4,500/yr',
      billingPeriod: 'year',
      description: 'Managed NVMe cloud container, automated SSL, weekly backups.',
    },
    'host-business': {
      productId: 'host-business',
      category: 'hosting',
      name: 'Business Hosting',
      amount: 8500,
      currency: 'KES',
      formatted: 'KSh 8,500/yr',
      billingPeriod: 'year',
      popular: true,
      description: 'High-performance Edge CDN, automated daily snapshots, staging slot, and WAF protection.',
    },
    'host-pro': {
      productId: 'host-pro',
      category: 'hosting',
      name: 'Pro Cloud Node',
      amount: 15000,
      currency: 'KES',
      formatted: 'KSh 15,000/yr',
      billingPeriod: 'year',
      description: 'Dedicated resources, Redis caching, real-time APM telemetry, and 99.95% uptime SLA.',
    },

    // Units / Rates
    'rate-extra-page': {
      productId: 'rate-extra-page',
      category: 'rate',
      name: 'Additional Page Build',
      amount: 2000,
      currency: 'KES',
      formatted: 'KSh 2,000 / page',
      billingPeriod: 'one-time',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 🌍 INTERNATIONAL PRICE BOOK (GLOBAL-2026-v1)
// ─────────────────────────────────────────────────────────────────────────────
export const PRICE_BOOK_GLOBAL_2026_V1: PriceBook = {
  id: 'GLOBAL-2026-v1',
  marketCode: 'GLOBAL',
  marketName: 'International',
  version: '2026-v1',
  currency: 'USD',
  currencySymbol: '$',
  effectiveFrom: '2026-01-01',
  effectiveUntil: '2026-12-31',
  status: 'active',
  paymentRails: ['International Visa / Mastercard / Amex (Paystack)'],
  items: {
    // Websites (Aggressive Market-Penetration Tier)
    'website-launch': {
      productId: 'website-launch',
      category: 'website',
      name: 'Launch Website',
      amount: 450,
      currency: 'USD',
      formatted: '$450',
      billingPeriod: 'one-time',
      pages: 'Up to 5 pages',
      timeline: '5–10 working days',
      supportWarranty: '14-day warranty',
      badge: 'Starter',
      description: 'Sleek global digital storefront with mobile optimization, lead funnel, and technical SEO.',
    },
    'website-business': {
      productId: 'website-business',
      category: 'website',
      name: 'Business Website',
      amount: 950,
      currency: 'USD',
      formatted: '$950',
      billingPeriod: 'one-time',
      pages: 'Up to 10 pages',
      timeline: '10–18 working days',
      supportWarranty: '30-day warranty',
      badge: 'Most Popular',
      popular: true,
      description: 'Engineered corporate site with headless CMS, telemetry, multi-region CDN, and verified Lighthouse 95+.',
    },
    'website-professional': {
      productId: 'website-professional',
      category: 'website',
      name: 'Professional Website',
      amount: 1750,
      currency: 'USD',
      formatted: '$1,750',
      billingPeriod: 'one-time',
      pages: 'Up to 15 pages',
      timeline: '15–25 working days',
      supportWarranty: '60-day warranty',
      badge: 'Advanced UX',
      description: 'High-converting international portal with interactive tools, custom calculators, and CRM pipeline sync.',
    },
    'website-enterprise': {
      productId: 'website-enterprise',
      category: 'website',
      name: 'Enterprise Architecture',
      amount: 3600,
      currency: 'USD',
      formatted: 'From $3,600',
      billingPeriod: 'starting',
      pages: 'Bespoke scope',
      timeline: '4–8 weeks',
      supportWarranty: '90-day warranty',
      badge: 'Tailored',
      description: 'Multi-regional corporate web ecosystem with custom backend architecture and enterprise SLA.',
    },

    // E-Commerce
    'ecommerce-starter': {
      productId: 'ecommerce-starter',
      category: 'ecommerce',
      name: 'E-Commerce Starter',
      amount: 890,
      currency: 'USD',
      formatted: '$890',
      billingPeriod: 'one-time',
      timeline: '10–18 working days',
      supportWarranty: '30-day warranty',
      description: 'International store setup with up to 30 products, Stripe checkout & automated notifications.',
    },
    'ecommerce-business': {
      productId: 'ecommerce-business',
      category: 'ecommerce',
      name: 'E-Commerce Business',
      amount: 1650,
      currency: 'USD',
      formatted: '$1,650',
      billingPeriod: 'one-time',
      popular: true,
      timeline: '3–5 weeks',
      supportWarranty: '60-day warranty',
      description: 'Global commerce engine with multi-currency checkout, dynamic tax rules, courier API, and customer portal.',
    },
    'ecommerce-enterprise': {
      productId: 'ecommerce-enterprise',
      category: 'ecommerce',
      name: 'E-Commerce Enterprise',
      amount: 3600,
      currency: 'USD',
      formatted: 'From $3,600',
      billingPeriod: 'starting',
      timeline: '6–10 weeks',
      supportWarranty: '90-day warranty',
      description: 'High-scale headless Shopify / Medusa / Next.js architecture with international localization.',
    },

    // Custom Systems
    'custom-tier-1': {
      productId: 'custom-tier-1',
      category: 'custom',
      name: 'Client Portals & API Gateways',
      amount: 2200,
      currency: 'USD',
      formatted: 'From $2,200',
      billingPeriod: 'starting',
      description: 'Secure customer self-service dashboard, booking engines, or external API integration.',
    },
    'custom-tier-2': {
      productId: 'custom-tier-2',
      category: 'custom',
      name: 'SaaS MVP & Internal Tools',
      amount: 3900,
      currency: 'USD',
      formatted: 'From $3,900',
      billingPeriod: 'starting',
      description: 'Custom multi-tenant SaaS application, subscription billing, RBAC security, and operational workflows.',
    },
    'custom-tier-3': {
      productId: 'custom-tier-3',
      category: 'custom',
      name: 'Enterprise Core Platforms',
      amount: 8500,
      currency: 'USD',
      formatted: 'From $8,500',
      billingPeriod: 'starting',
      description: 'Cloud microservices, distributed data pipelines, enterprise security compliance, and dedicated engineering sprints.',
    },

    // Care Plans
    'care-essential': {
      productId: 'care-essential',
      category: 'care',
      name: 'Care Essential',
      amount: 75,
      currency: 'USD',
      formatted: '$75/mo',
      billingPeriod: 'month',
      description: 'Cloud backups, automated security patch management, uptime telemetry, and 1 hour developer support.',
    },
    'care-business': {
      productId: 'care-business',
      category: 'care',
      name: 'Care Business',
      amount: 150,
      currency: 'USD',
      formatted: '$150/mo',
      billingPeriod: 'month',
      popular: true,
      description: 'Daily backups, Core Web Vitals maintenance, SEO health audits, and 2 hours priority development.',
    },
    'care-professional': {
      productId: 'care-professional',
      category: 'care',
      name: 'Care Professional',
      amount: 300,
      currency: 'USD',
      formatted: '$300/mo',
      billingPeriod: 'month',
      description: 'Active continuous engineering, 5 hours included development, quarterly architectural roadmap, and emergency SLA.',
    },

    // Hosting Plans
    'host-essential': {
      productId: 'host-essential',
      category: 'hosting',
      name: 'Essential Hosting',
      amount: 49,
      currency: 'USD',
      formatted: '$49/yr',
      billingPeriod: 'year',
      description: 'High-speed cloud container, automated SSL, weekly backups.',
    },
    'host-business': {
      productId: 'host-business',
      category: 'hosting',
      name: 'Business Hosting',
      amount: 99,
      currency: 'USD',
      formatted: '$99/yr',
      billingPeriod: 'year',
      popular: true,
      description: 'Global Edge CDN, automated daily snapshots, staging slot, and WAF protection.',
    },
    'host-pro': {
      productId: 'host-pro',
      category: 'hosting',
      name: 'Pro Cloud Node',
      amount: 189,
      currency: 'USD',
      formatted: '$189/yr',
      billingPeriod: 'year',
      description: 'Dedicated isolated compute, Redis acceleration, real-time APM telemetry, and 99.95% uptime SLA.',
    },

    // Units / Rates
    'rate-extra-page': {
      productId: 'rate-extra-page',
      category: 'rate',
      name: 'Additional Page Build',
      amount: 40,
      currency: 'USD',
      formatted: '$40 / page',
      billingPeriod: 'one-time',
    },
  },
};

/**
 * Registry of all price books
 */
export const PRICE_BOOKS: Record<string, PriceBook> = {
  'KE-2026-v1': PRICE_BOOK_KE_2026_V1,
  'GLOBAL-2026-v1': PRICE_BOOK_GLOBAL_2026_V1,
};

/**
 * Returns the active price book for a given market code.
 */
export function getPriceBookForMarket(marketCode: MarketCode): PriceBook {
  const market = MARKETS[marketCode] || MARKETS.GLOBAL;
  return PRICE_BOOKS[market.activePriceBookId] || PRICE_BOOK_GLOBAL_2026_V1;
}

/**
 * Queries a price item for a given product and market.
 */
export function getProductPrice(productId: string, marketCode: MarketCode): CommercialPriceItem | null {
  const book = getPriceBookForMarket(marketCode);
  return book.items[productId] || null;
}

/**
 * Formats an amount with the market's standard currency formatting.
 */
export function formatCurrency(amount: number, currency: 'KES' | 'USD' | 'EUR' | 'GBP'): string {
  if (currency === 'KES') {
    return `KSh ${amount.toLocaleString('en-KE')}`;
  }
  if (currency === 'EUR') {
    return `€${amount.toLocaleString('en-IE')}`;
  }
  if (currency === 'GBP') {
    return `£${amount.toLocaleString('en-GB')}`;
  }
  return `$${amount.toLocaleString('en-US')}`;
}
