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

export type CommitmentCycle =
  | 'monthly'
  | 'quarterly'
  | 'semi-annually'
  | 'annually'
  | 'biennially'
  | 'triennially';

export interface BillingCycleMeta {
  cycle: CommitmentCycle;
  enumValue: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUAL' | 'BIENNIAL' | 'TRIENNIAL';
  label: string;
  pillLabel: string;
  durationMonths: number;
  discountPct: number;
  popular?: boolean;
}

export const BILLING_CYCLES_META: BillingCycleMeta[] = [
  { cycle: 'monthly', enumValue: 'MONTHLY', label: 'Monthly', pillLabel: 'Monthly', durationMonths: 1, discountPct: 0 },
  { cycle: 'quarterly', enumValue: 'QUARTERLY', label: 'Quarterly', pillLabel: '3 Months (-5%)', durationMonths: 3, discountPct: 5 },
  { cycle: 'semi-annually', enumValue: 'SEMI_ANNUALLY', label: 'Bi-Annual', pillLabel: '6 Months (-10%)', durationMonths: 6, discountPct: 10 },
  { cycle: 'annually', enumValue: 'ANNUAL', label: '1 Year', pillLabel: '1 Year (-25%)', durationMonths: 12, discountPct: 25, popular: true },
  { cycle: 'biennially', enumValue: 'BIENNIAL', label: '2 Years', pillLabel: '2 Years (-32%)', durationMonths: 24, discountPct: 32 },
  { cycle: 'triennially', enumValue: 'TRIENNIAL', label: '3 Years', pillLabel: '3 Years (-40%)', durationMonths: 36, discountPct: 40 },
];

export interface BillingOption {
  cycle: CommitmentCycle;
  enumValue?: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUAL' | 'BIENNIAL' | 'TRIENNIAL';
  label: string;
  periodMonths: number;
  amount: number;
  monthlyEquivalent: number;
  discountPct: number;
  savingsText?: string;
  popular?: boolean;
  formatted: string;
  formattedMonthly: string;
}

export function generateBillingCycles(
  baseMonthlyAmount: number,
  currency: 'KES' | 'USD' | 'EUR' | 'GBP',
  options?: {
    annualDiscountPct?: number;
    canonicalAnnualAmount?: number;
  }
): BillingOption[] {
  const isKes = currency === 'KES';
  const annualDiscount = options?.annualDiscountPct ?? (options?.canonicalAnnualAmount ? 25 : 20);

  return BILLING_CYCLES_META.map((meta) => {
    const discount = meta.cycle === 'annually' ? annualDiscount : meta.discountPct;
    let amount: number;
    let monthlyEquivalent: number;

    if (meta.cycle === 'annually' && options?.canonicalAnnualAmount != null) {
      amount = options.canonicalAnnualAmount;
      monthlyEquivalent = Math.round(amount / 12);
    } else {
      monthlyEquivalent = isKes
        ? Math.round(baseMonthlyAmount * (1 - discount / 100))
        : Math.round(baseMonthlyAmount * (1 - discount / 100) * 100) / 100;
      amount = isKes
        ? Math.round(monthlyEquivalent * meta.durationMonths)
        : Math.round(monthlyEquivalent * meta.durationMonths * 100) / 100;
    }

    const formattedMonthly = `${formatCurrency(monthlyEquivalent, currency)}/mo`;
    const formatted = meta.durationMonths === 1
      ? formattedMonthly
      : `${formatCurrency(amount, currency)} / ${meta.durationMonths} mos`;

    return {
      cycle: meta.cycle,
      enumValue: meta.enumValue,
      label: `${meta.label} (${meta.durationMonths} ${meta.durationMonths === 1 ? 'Month' : 'Months'})`,
      periodMonths: meta.durationMonths,
      amount,
      monthlyEquivalent,
      discountPct: discount,
      savingsText: discount > 0 ? `Save ${discount}%` : 'Standard rate',
      popular: meta.popular,
      formatted,
      formattedMonthly,
    };
  });
}

export function getBillingCycleMeta(
  cycle: CommitmentCycle | BillingCycleMeta['enumValue'] | string
): BillingCycleMeta {
  const norm = String(cycle || '').toLowerCase().replace(/_/g, '-');
  return (
    BILLING_CYCLES_META.find(
      (m) => m.cycle === norm || m.enumValue.toLowerCase() === norm.replace(/-/g, '_')
    ) || BILLING_CYCLES_META[0]
  );
}

export function calculatePlanCyclePrice(
  baseMonthlyAmount: number,
  cycle: CommitmentCycle | BillingCycleMeta['enumValue'] | string,
  options?: {
    annualDiscountPct?: number;
    canonicalAnnualAmount?: number;
    isKes?: boolean;
    currency?: 'KES' | 'USD' | 'EUR' | 'GBP';
  }
): {
  amount: number;
  monthlyEquivalent: number;
  discountPct: number;
  durationMonths: number;
  label: string;
  pillLabel: string;
  enumValue: BillingCycleMeta['enumValue'];
} {
  const meta = getBillingCycleMeta(cycle);
  const annualDiscount = options?.annualDiscountPct ?? (options?.canonicalAnnualAmount ? 25 : 20);
  const discount = meta.cycle === 'annually' ? annualDiscount : meta.discountPct;
  const isKes = options?.isKes ?? (options?.currency ? options.currency === 'KES' : true);

  let amount: number;
  let monthlyEquivalent: number;

  if (meta.cycle === 'annually' && options?.canonicalAnnualAmount != null) {
    amount = options.canonicalAnnualAmount;
    monthlyEquivalent = Math.round(amount / 12);
  } else {
    monthlyEquivalent = isKes
      ? Math.round(baseMonthlyAmount * (1 - discount / 100))
      : Math.round(baseMonthlyAmount * (1 - discount / 100) * 100) / 100;
    amount = isKes
      ? Math.round(monthlyEquivalent * meta.durationMonths)
      : Math.round(monthlyEquivalent * meta.durationMonths * 100) / 100;
  }

  return {
    amount,
    monthlyEquivalent,
    discountPct: discount,
    durationMonths: meta.durationMonths,
    label: meta.label,
    pillLabel: meta.pillLabel,
    enumValue: meta.enumValue,
  };
}

export interface CommercialPriceItem {
  productId: string;
  category: 'website' | 'ecommerce' | 'custom' | 'care' | 'hosting' | 'addon' | 'rate';
  name: string;
  amount: number;
  currency: 'KES' | 'USD' | 'EUR' | 'GBP';
  formatted: string;
  billingPeriod?: 'one-time' | 'month' | 'quarter' | 'half-year' | 'year' | 'starting';
  description?: string;
  deliverables?: string[];
  features?: string[];
  pages?: string;
  timeline?: string;
  supportWarranty?: string;
  badge?: string;
  popular?: boolean;
  billingOptions?: BillingOption[];
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
    'service-admin-hub-starter': {
      productId: 'service-admin-hub-starter',
      category: 'custom',
      name: 'Standalone Admin Media Hub (Retrofit)',
      amount: 45000,
      currency: 'KES',
      formatted: 'From KSh 45,000',
      billingPeriod: 'starting',
      badge: 'Retrofit Hub',
      deliverables: [
        'Dedicated Next.js admin portal on client subdomain',
        'Direct Cloudflare R2 / AWS S3 media asset engine',
        'Drag-and-drop banner, photo & document uploads',
        'Automatic WebP conversion & CDN asset delivery',
        'Live website webhook / cache sync',
        '1-on-1 staff handover & video walkthrough',
      ],
      description: 'Standalone administrative control panel engineered to connect to your existing website. Drag-and-drop media vault, banner controls, and secure cloud storage.',
    },
    'service-admin-hub-corporate': {
      productId: 'service-admin-hub-corporate',
      category: 'custom',
      name: 'Corporate Operations Desk & Multi-User Admin',
      amount: 85000,
      currency: 'KES',
      formatted: 'From KSh 85,000',
      billingPeriod: 'starting',
      badge: 'Multi-User RBAC',
      deliverables: [
        'Everything in Starter Hub, plus:',
        'Role-based access control (Admin, Editor, Contributor)',
        'Dynamic content collections (Team, Testimonials, Projects)',
        'Desktop & mobile live visual split-screen preview',
        'Audit log with revision rollback history',
        'Automated daily backup of uploaded assets',
      ],
      description: 'Multi-user role-based admin workstation with content collections, live preview, audit logs, webhook deployment, and dedicated R2 asset engine.',
    },
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
      billingOptions: generateBillingCycles(5000, 'KES', { annualDiscountPct: 20 }),
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
      billingOptions: generateBillingCycles(10000, 'KES', { annualDiscountPct: 20 }),
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
      billingOptions: generateBillingCycles(20000, 'KES', { annualDiscountPct: 20 }),
    },
    'care-enterprise': {
      productId: 'care-enterprise',
      category: 'care',
      name: 'Care Enterprise',
      amount: 40000,
      currency: 'KES',
      formatted: 'KSh 40,000/mo',
      billingPeriod: 'month',
      description: 'Dedicated engineering pod, 24/7 SLA, and full-lifecycle cloud management.',
      billingOptions: generateBillingCycles(40000, 'KES', { annualDiscountPct: 20 }),
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
      billingOptions: generateBillingCycles(500, 'KES', { canonicalAnnualAmount: 4500, annualDiscountPct: 25 }),
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
      billingOptions: generateBillingCycles(950, 'KES', { canonicalAnnualAmount: 8500, annualDiscountPct: 25 }),
    },
    'host-pro': {
      productId: 'host-pro',
      category: 'hosting',
      name: 'Host Professional',
      amount: 15000,
      currency: 'KES',
      formatted: 'KSh 15,000/yr',
      billingPeriod: 'year',
      description: 'Dedicated compute allocation, Redis object caching, 30-day snapshot backups.',
      billingOptions: generateBillingCycles(1667, 'KES', { canonicalAnnualAmount: 15000, annualDiscountPct: 25 }),
    },
    'host-professional': {
      productId: 'host-professional',
      category: 'hosting',
      name: 'Host Professional',
      amount: 15000,
      currency: 'KES',
      formatted: 'KSh 15,000/yr',
      billingPeriod: 'year',
      description: 'Dedicated compute allocation, Redis object caching, 30-day snapshot backups.',
      billingOptions: generateBillingCycles(1667, 'KES', { canonicalAnnualAmount: 15000, annualDiscountPct: 25 }),
    },
    'host-cloud': {
      productId: 'host-cloud',
      category: 'hosting',
      name: 'Managed Cloud Cluster',
      amount: 30000,
      currency: 'KES',
      formatted: 'From KSh 3,200/mo (KSh 30,000/yr)',
      billingPeriod: 'year',
      popular: true,
      badge: 'Multi-Cycle',
      description: 'Isolated Docker container orchestration, dedicated PostgreSQL 16 database, Redis cluster. Available on Monthly, 3-Month, 6-Month, or Annual billing with progressive commitment discounts.',
      billingOptions: generateBillingCycles(3200, 'KES', { canonicalAnnualAmount: 30000, annualDiscountPct: 22 }),
    },
    'host-cloud-monthly': {
      productId: 'host-cloud-monthly',
      category: 'hosting',
      name: 'Managed Cloud (Monthly)',
      amount: 3200,
      currency: 'KES',
      formatted: 'KSh 3,200/mo',
      billingPeriod: 'month',
      description: 'Dedicated Docker container cluster with PostgreSQL 16 & Redis (Monthly rolling term).',
    },
    'host-cloud-quarterly': {
      productId: 'host-cloud-quarterly',
      category: 'hosting',
      name: 'Managed Cloud (3 Months / Quarterly)',
      amount: 9120,
      currency: 'KES',
      formatted: 'KSh 9,120 / 3 mos (KSh 3,040/mo)',
      billingPeriod: 'quarter',
      badge: 'Save 5%',
      description: 'Dedicated Docker container cluster (Billed every 3 months with 5% discount).',
    },
    'host-cloud-semiannual': {
      productId: 'host-cloud-semiannual',
      category: 'hosting',
      name: 'Managed Cloud (6 Months / Semi-Annual)',
      amount: 17280,
      currency: 'KES',
      formatted: 'KSh 17,280 / 6 mos (KSh 2,880/mo)',
      billingPeriod: 'half-year',
      badge: 'Save 10%',
      description: 'Dedicated Docker container cluster (Billed every 6 months with 10% discount).',
    },
    'host-cloud-annual': {
      productId: 'host-cloud-annual',
      category: 'hosting',
      name: 'Managed Cloud (Annual / 12 Months)',
      amount: 30000,
      currency: 'KES',
      formatted: 'KSh 30,000/yr (KSh 2,500/mo)',
      billingPeriod: 'year',
      popular: true,
      badge: 'Save 22%',
      description: 'Dedicated Docker container cluster (Billed annually with 22% discount / ~2.6 months free).',
    },

    // Add-ons
    'addon-blog-news': {
      productId: 'addon-blog-news',
      category: 'addon',
      name: 'Blog / News Engine',
      amount: 7500,
      currency: 'KES',
      formatted: 'KSh 7,500',
      billingPeriod: 'one-time',
    },
    'addon-advanced-form': {
      productId: 'addon-advanced-form',
      category: 'addon',
      name: 'Advanced Form / Survey',
      amount: 5000,
      currency: 'KES',
      formatted: 'KSh 5,000',
      billingPeriod: 'one-time',
    },
    'addon-booking': {
      productId: 'addon-booking',
      category: 'addon',
      name: 'Online Booking System',
      amount: 15000,
      currency: 'KES',
      formatted: 'KSh 15,000',
      billingPeriod: 'one-time',
    },
    'addon-payment-gateway': {
      productId: 'addon-payment-gateway',
      category: 'addon',
      name: 'Card Payment Gateway',
      amount: 10000,
      currency: 'KES',
      formatted: 'KSh 10,000',
      billingPeriod: 'one-time',
    },
    'addon-mpesa': {
      productId: 'addon-mpesa',
      category: 'addon',
      name: 'M-Pesa STK Push Integration',
      amount: 10000,
      currency: 'KES',
      formatted: 'KSh 10,000',
      billingPeriod: 'one-time',
    },
    'addon-newsletter': {
      productId: 'addon-newsletter',
      category: 'addon',
      name: 'Newsletter Integration',
      amount: 5000,
      currency: 'KES',
      formatted: 'KSh 5,000',
      billingPeriod: 'one-time',
    },
    'addon-seo-advanced': {
      productId: 'addon-seo-advanced',
      category: 'addon',
      name: 'Advanced SEO Foundation',
      amount: 15000,
      currency: 'KES',
      formatted: 'KSh 15,000',
      billingPeriod: 'one-time',
    },
    'addon-copywriting': {
      productId: 'addon-copywriting',
      category: 'addon',
      name: 'Professional Copywriting',
      amount: 10000,
      currency: 'KES',
      formatted: 'KSh 10,000',
      billingPeriod: 'one-time',
    },
    'addon-migration': {
      productId: 'addon-migration',
      category: 'addon',
      name: 'Website Migration',
      amount: 5000,
      currency: 'KES',
      formatted: 'KSh 5,000',
      billingPeriod: 'one-time',
    },
    'addon-extra-revision': {
      productId: 'addon-extra-revision',
      category: 'addon',
      name: 'Additional Revision Round',
      amount: 3000,
      currency: 'KES',
      formatted: 'KSh 3,000',
      billingPeriod: 'one-time',
    },
    'addon-custom-api': {
      productId: 'addon-custom-api',
      category: 'addon',
      name: 'Custom API Integration',
      amount: 15000,
      currency: 'KES',
      formatted: 'KSh 15,000',
      billingPeriod: 'one-time',
    },
    'addon-multilingual': {
      productId: 'addon-multilingual',
      category: 'addon',
      name: 'Multilingual Support (i18n)',
      amount: 15000,
      currency: 'KES',
      formatted: 'KSh 15,000',
      billingPeriod: 'one-time',
    },
    'addon-document-hub': {
      productId: 'addon-document-hub',
      category: 'addon',
      name: 'Document Download Hub',
      amount: 6000,
      currency: 'KES',
      formatted: 'KSh 6,000',
      billingPeriod: 'one-time',
    },
    'addon-admin-dashboard': {
      productId: 'addon-admin-dashboard',
      category: 'addon',
      name: 'Bespoke Client Admin & Media Upload Hub',
      amount: 25000,
      currency: 'KES',
      formatted: 'KSh 25,000',
      billingPeriod: 'one-time',
      badge: 'Client Autonomy',
      deliverables: [
        'Custom-branded admin portal (/admin or subdomain)',
        'Homepage banner & hero CTA editor',
        'Media & project gallery drag-and-drop uploader',
        'PDF brochures, menus & downloads hub',
        'Announcement bar & emergency notice toggle',
        'Recorded video walkthrough & admin guide',
      ],
      description: 'Custom-branded client admin portal to upload project photos, swap hero banners, publish PDF brochures, and toggle announcement notices with zero code.',
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
    'service-admin-hub-starter': {
      productId: 'service-admin-hub-starter',
      category: 'custom',
      name: 'Standalone Admin Media Hub (Retrofit)',
      amount: 490,
      currency: 'USD',
      formatted: 'From $490',
      billingPeriod: 'starting',
      badge: 'Retrofit Hub',
      deliverables: [
        'Dedicated Next.js admin portal on client subdomain',
        'Direct Cloudflare R2 / AWS S3 media asset engine',
        'Drag-and-drop banner, photo & document uploads',
        'Automatic WebP conversion & CDN asset delivery',
        'Live website webhook / cache sync',
        '1-on-1 staff handover & video walkthrough',
      ],
      description: 'Standalone administrative control panel engineered to connect to your existing website. Drag-and-drop media vault, banner controls, and secure cloud storage.',
    },
    'service-admin-hub-corporate': {
      productId: 'service-admin-hub-corporate',
      category: 'custom',
      name: 'Corporate Operations Desk & Multi-User Admin',
      amount: 890,
      currency: 'USD',
      formatted: 'From $890',
      billingPeriod: 'starting',
      badge: 'Multi-User RBAC',
      deliverables: [
        'Everything in Starter Hub, plus:',
        'Role-based access control (Admin, Editor, Contributor)',
        'Dynamic content collections (Team, Testimonials, Projects)',
        'Desktop & mobile live visual split-screen preview',
        'Audit log with revision rollback history',
        'Automated daily backup of uploaded assets',
      ],
      description: 'Multi-user role-based admin workstation with content collections, live preview, audit logs, webhook deployment, and dedicated R2 asset engine.',
    },
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
      billingOptions: generateBillingCycles(75, 'USD', { annualDiscountPct: 20 }),
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
      billingOptions: generateBillingCycles(150, 'USD', { annualDiscountPct: 20 }),
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
      billingOptions: generateBillingCycles(300, 'USD', { annualDiscountPct: 20 }),
    },
    'care-enterprise': {
      productId: 'care-enterprise',
      category: 'care',
      name: 'Care Enterprise',
      amount: 400,
      currency: 'USD',
      formatted: '$400/mo',
      billingPeriod: 'month',
      description: 'Dedicated engineering pod, 24/7 SLA, and full-lifecycle cloud management.',
      billingOptions: generateBillingCycles(400, 'USD', { annualDiscountPct: 20 }),
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
      billingOptions: generateBillingCycles(5.5, 'USD', { canonicalAnnualAmount: 49, annualDiscountPct: 25 }),
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
      billingOptions: generateBillingCycles(11, 'USD', { canonicalAnnualAmount: 99, annualDiscountPct: 25 }),
    },
    'host-pro': {
      productId: 'host-pro',
      category: 'hosting',
      name: 'Host Professional',
      amount: 189,
      currency: 'USD',
      formatted: '$189/yr',
      billingPeriod: 'year',
      description: 'Dedicated isolated compute, Redis acceleration, real-time APM telemetry, and 99.95% uptime SLA.',
      billingOptions: generateBillingCycles(21, 'USD', { canonicalAnnualAmount: 189, annualDiscountPct: 25 }),
    },
    'host-professional': {
      productId: 'host-professional',
      category: 'hosting',
      name: 'Host Professional',
      amount: 189,
      currency: 'USD',
      formatted: '$189/yr',
      billingPeriod: 'year',
      description: 'Dedicated isolated compute, Redis acceleration, real-time APM telemetry, and 99.95% uptime SLA.',
      billingOptions: generateBillingCycles(21, 'USD', { canonicalAnnualAmount: 189, annualDiscountPct: 25 }),
    },
    'host-cloud': {
      productId: 'host-cloud',
      category: 'hosting',
      name: 'Managed Cloud Cluster',
      amount: 300,
      currency: 'USD',
      formatted: 'From $32/mo ($300/yr)',
      billingPeriod: 'year',
      popular: true,
      badge: 'Multi-Cycle',
      description: 'Isolated Docker container orchestration, dedicated PostgreSQL database, Redis cluster. Available on Monthly, 3-Month, 6-Month, or Annual billing with progressive commitment discounts.',
      billingOptions: generateBillingCycles(32, 'USD', { canonicalAnnualAmount: 300, annualDiscountPct: 22 }),
    },
    'host-cloud-monthly': {
      productId: 'host-cloud-monthly',
      category: 'hosting',
      name: 'Managed Cloud (Monthly)',
      amount: 32,
      currency: 'USD',
      formatted: '$32/mo',
      billingPeriod: 'month',
      description: 'Dedicated Docker container cluster with PostgreSQL 16 & Redis (Monthly rolling term).',
    },
    'host-cloud-quarterly': {
      productId: 'host-cloud-quarterly',
      category: 'hosting',
      name: 'Managed Cloud (3 Months / Quarterly)',
      amount: 91,
      currency: 'USD',
      formatted: '$91 / 3 mos ($30.33/mo)',
      billingPeriod: 'quarter',
      badge: 'Save 5%',
      description: 'Dedicated Docker container cluster (Billed every 3 months with 5% discount).',
    },
    'host-cloud-semiannual': {
      productId: 'host-cloud-semiannual',
      category: 'hosting',
      name: 'Managed Cloud (6 Months / Semi-Annual)',
      amount: 172,
      currency: 'USD',
      formatted: '$172 / 6 mos ($28.67/mo)',
      billingPeriod: 'half-year',
      badge: 'Save 10%',
      description: 'Dedicated Docker container cluster (Billed every 6 months with 10% discount).',
    },
    'host-cloud-annual': {
      productId: 'host-cloud-annual',
      category: 'hosting',
      name: 'Managed Cloud (Annual / 12 Months)',
      amount: 290,
      currency: 'USD',
      formatted: '$290/yr ($24.16/mo)',
      billingPeriod: 'year',
      popular: true,
      badge: 'Save 25%',
      description: 'Dedicated Docker container cluster (Billed annually with 25% discount / ~3 months free).',
    },

    // Add-ons
    'addon-blog-news': {
      productId: 'addon-blog-news',
      category: 'addon',
      name: 'Blog / News Engine',
      amount: 120,
      currency: 'USD',
      formatted: '$120',
      billingPeriod: 'one-time',
    },
    'addon-advanced-form': {
      productId: 'addon-advanced-form',
      category: 'addon',
      name: 'Advanced Form / Survey',
      amount: 80,
      currency: 'USD',
      formatted: '$80',
      billingPeriod: 'one-time',
    },
    'addon-booking': {
      productId: 'addon-booking',
      category: 'addon',
      name: 'Online Booking System',
      amount: 220,
      currency: 'USD',
      formatted: '$220',
      billingPeriod: 'one-time',
    },
    'addon-payment-gateway': {
      productId: 'addon-payment-gateway',
      category: 'addon',
      name: 'Card Payment Gateway',
      amount: 150,
      currency: 'USD',
      formatted: '$150',
      billingPeriod: 'one-time',
    },
    'addon-mpesa': {
      productId: 'addon-mpesa',
      category: 'addon',
      name: 'M-Pesa STK Push Integration',
      amount: 150,
      currency: 'USD',
      formatted: '$150',
      billingPeriod: 'one-time',
    },
    'addon-newsletter': {
      productId: 'addon-newsletter',
      category: 'addon',
      name: 'Newsletter Integration',
      amount: 80,
      currency: 'USD',
      formatted: '$80',
      billingPeriod: 'one-time',
    },
    'addon-seo-advanced': {
      productId: 'addon-seo-advanced',
      category: 'addon',
      name: 'Advanced SEO Foundation',
      amount: 220,
      currency: 'USD',
      formatted: '$220',
      billingPeriod: 'one-time',
    },
    'addon-copywriting': {
      productId: 'addon-copywriting',
      category: 'addon',
      name: 'Professional Copywriting',
      amount: 180,
      currency: 'USD',
      formatted: '$180',
      billingPeriod: 'one-time',
    },
    'addon-migration': {
      productId: 'addon-migration',
      category: 'addon',
      name: 'Website Migration',
      amount: 80,
      currency: 'USD',
      formatted: '$80',
      billingPeriod: 'one-time',
    },
    'addon-extra-revision': {
      productId: 'addon-extra-revision',
      category: 'addon',
      name: 'Additional Revision Round',
      amount: 50,
      currency: 'USD',
      formatted: '$50',
      billingPeriod: 'one-time',
    },
    'addon-custom-api': {
      productId: 'addon-custom-api',
      category: 'addon',
      name: 'Custom API Integration',
      amount: 240,
      currency: 'USD',
      formatted: '$240',
      billingPeriod: 'one-time',
    },
    'addon-multilingual': {
      productId: 'addon-multilingual',
      category: 'addon',
      name: 'Multilingual Support (i18n)',
      amount: 240,
      currency: 'USD',
      formatted: '$240',
      billingPeriod: 'one-time',
    },
    'addon-document-hub': {
      productId: 'addon-document-hub',
      category: 'addon',
      name: 'Document Download Hub',
      amount: 120,
      currency: 'USD',
      formatted: '$120',
      billingPeriod: 'one-time',
    },
    'addon-admin-dashboard': {
      productId: 'addon-admin-dashboard',
      category: 'addon',
      name: 'Bespoke Client Admin & Media Upload Hub',
      amount: 299,
      currency: 'USD',
      formatted: '$299',
      billingPeriod: 'one-time',
      badge: 'Client Autonomy',
      deliverables: [
        'Custom-branded admin portal (/admin or subdomain)',
        'Homepage banner & hero CTA editor',
        'Media & project gallery drag-and-drop uploader',
        'PDF brochures, menus & downloads hub',
        'Announcement bar & emergency notice toggle',
        'Recorded video walkthrough & admin guide',
      ],
      description: 'Custom-branded client admin portal to upload project photos, swap hero banners, publish PDF brochures, and toggle announcement notices with zero code.',
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

/**
 * Single Source of Truth Service Catalog for B2B Invoice Generation and Admin Suite
 */
export interface ServiceCatalogItem {
  id: string;
  category: 'websites' | 'care' | 'hosting' | 'addons';
  name: string;
  tagline: string;
  priceKes: number;
  priceUsd: number;
  period: 'one-time' | 'month' | 'quarter' | 'half-year' | 'year' | 'biennial' | 'triennial';
  badge?: string;
  billingOptions?: BillingOption[];
}

export const CANONICAL_SERVICE_CATALOG: ServiceCatalogItem[] = [
  // ── Web Development Packages ──
  {
    id: 'pkg-launch',
    category: 'websites',
    name: 'Launch Website Package',
    tagline: 'Up to 5 pages, WhatsApp chat, responsive UI, basic SEO foundation',
    priceKes: 25000,
    priceUsd: 450,
    period: 'one-time',
    badge: 'Starter',
  },
  {
    id: 'pkg-business',
    category: 'websites',
    name: 'Business Website Package',
    tagline: 'Up to 10 pages, headless CMS, analytics & lead funnel, 30-day warranty',
    priceKes: 90000,
    priceUsd: 950,
    period: 'one-time',
    badge: 'Popular',
  },
  {
    id: 'pkg-professional',
    category: 'websites',
    name: 'Professional Website Package',
    tagline: 'Up to 15 pages, multi-author CMS, search, CRM integration & 60-day warranty',
    priceKes: 160000,
    priceUsd: 1750,
    period: 'one-time',
    badge: 'Advanced UX',
  },
  {
    id: 'pkg-ecommerce',
    category: 'websites',
    name: 'Ecommerce Starter Storefront',
    tagline: 'Up to 50 products, catalog, shopping cart, M-Pesa STK & Card checkout',
    priceKes: 90000,
    priceUsd: 890,
    period: 'one-time',
    badge: 'Storefront',
  },
  {
    id: 'pkg-ecommerce-business',
    category: 'websites',
    name: 'Ecommerce Business Platform',
    tagline: '100+ products, coupons, inventory sync, dynamic shipping & accounting export',
    priceKes: 175000,
    priceUsd: 1650,
    period: 'one-time',
    badge: 'High-Volume',
  },
  {
    id: 'pkg-custom-app',
    category: 'websites',
    name: 'Enterprise Web Application',
    tagline: 'Custom web application architecture, PostgreSQL, API sync & custom flows',
    priceKes: 320000,
    priceUsd: 3600,
    period: 'one-time',
    badge: 'Enterprise',
  },
  {
    id: 'service-admin-hub-starter',
    category: 'websites',
    name: 'Standalone Admin Media Hub (Retrofit)',
    tagline: 'Independent Next.js admin control panel for existing websites with R2 media vault & banner editor',
    priceKes: 45000,
    priceUsd: 490,
    period: 'one-time',
    badge: 'Retrofit Hub',
  },
  {
    id: 'service-admin-hub-corporate',
    category: 'websites',
    name: 'Corporate Operations Desk & Multi-User Admin',
    tagline: 'Multi-user role-based admin workstation with content collections, live preview & audit logs',
    priceKes: 85000,
    priceUsd: 890,
    period: 'one-time',
    badge: 'Multi-User RBAC',
  },
  {
    id: 'rate-extra-page',
    category: 'websites',
    name: 'Additional Web Page Build',
    tagline: 'Custom responsive page design, layout, content formatting & technical SEO (per page)',
    priceKes: 2000,
    priceUsd: 40,
    period: 'one-time',
    badge: '+1 Page Unit',
  },
  {
    id: 'rate-extra-landing-page',
    category: 'websites',
    name: 'Standalone Landing Page / Funnel',
    tagline: 'High-conversion marketing landing page with hero CTA, testimonials & lead capture funnel',
    priceKes: 15000,
    priceUsd: 149,
    period: 'one-time',
    badge: 'Sales Funnel',
  },

  // ── Managed Care & Maintenance Retainers ──
  {
    id: 'care-essential',
    category: 'care',
    name: 'Care Essential Retainer',
    tagline: 'Automated patch updates, 24/7 uptime monitoring & verified weekly offsite R2 backups',
    priceKes: 5000,
    priceUsd: 75,
    period: 'month',
    badge: '99.9% SLA',
    billingOptions: generateBillingCycles(5000, 'KES', { annualDiscountPct: 20 }),
  },
  {
    id: 'care-business',
    category: 'care',
    name: 'Care Business Retainer',
    tagline: 'Daily backups, monthly content updates, Core Web Vitals maintenance & priority response',
    priceKes: 10000,
    priceUsd: 150,
    period: 'month',
    badge: 'Recommended',
    billingOptions: generateBillingCycles(10000, 'KES', { annualDiscountPct: 20 }),
  },
  {
    id: 'care-professional',
    category: 'care',
    name: 'Care Professional Retainer',
    tagline: 'Dedicated engineering hours, quarterly roadmap, emergency SLA hotline & security audit',
    priceKes: 20000,
    priceUsd: 300,
    period: 'month',
    badge: 'Priority 1h',
    billingOptions: generateBillingCycles(20000, 'KES', { annualDiscountPct: 20 }),
  },
  {
    id: 'care-enterprise',
    category: 'care',
    name: 'Care Enterprise Retainer',
    tagline: 'Dedicated DevOps engineer, 24/7 cluster monitoring & custom engineering sprint SLA',
    priceKes: 40000,
    priceUsd: 400,
    period: 'month',
    badge: 'Full DevOps',
    billingOptions: generateBillingCycles(40000, 'KES', { annualDiscountPct: 20 }),
  },

  // ── Managed Cloud Hosting ──
  {
    id: 'host-essential',
    category: 'hosting',
    name: 'Host Essential Container',
    tagline: '0.5 vCPU, 384MB RAM burst, 10GB NVMe, automated SSL, weekly R2 backups (KSh 4,500/yr)',
    priceKes: 4500,
    priceUsd: 49,
    period: 'year',
    billingOptions: generateBillingCycles(500, 'KES', { canonicalAnnualAmount: 4500, annualDiscountPct: 25 }),
  },
  {
    id: 'host-business',
    category: 'hosting',
    name: 'Host Business Container',
    tagline: '1.5 vCPU, 768MB RAM burst, 25GB NVMe, 5 email inboxes, daily R2 backups (KSh 8,500/yr)',
    priceKes: 8500,
    priceUsd: 99,
    period: 'year',
    badge: 'Popular',
    billingOptions: generateBillingCycles(950, 'KES', { canonicalAnnualAmount: 8500, annualDiscountPct: 25 }),
  },
  {
    id: 'host-pro',
    category: 'hosting',
    name: 'Host Professional Container',
    tagline: '2.0 vCPU, 1.5GB RAM burst, 50GB NVMe, isolated Redis 7 cache, 30-day snapshots (KSh 15,000/yr)',
    priceKes: 15000,
    priceUsd: 189,
    period: 'year',
    badge: 'High Perf',
    billingOptions: generateBillingCycles(1667, 'KES', { canonicalAnnualAmount: 15000, annualDiscountPct: 25 }),
  },
  {
    id: 'host-cloud',
    category: 'hosting',
    name: 'Managed Cloud Cluster',
    tagline: 'Dedicated 4.0 vCPU, 100GB NVMe, standalone PostgreSQL 16 & Redis (Multi-Cycle from KSh 3,200/mo)',
    priceKes: 30000,
    priceUsd: 300,
    period: 'year',
    badge: 'Multi-Cycle',
    billingOptions: generateBillingCycles(3200, 'KES', { canonicalAnnualAmount: 30000, annualDiscountPct: 22 }),
  },

  // ── Production Add-Ons & Integrations ──
  {
    id: 'addon-blog-news',
    category: 'addons',
    name: 'Blog & Content Publishing Engine',
    tagline: 'Self-hosted MDX or Headless CMS newsfeed with automated XML sitemaps',
    priceKes: 7500,
    priceUsd: 120,
    period: 'one-time',
  },
  {
    id: 'addon-advanced-form',
    category: 'addons',
    name: 'Multi-Step Lead / Survey Form',
    tagline: 'Conditional branching, file attachments, and instant webhook dispatches',
    priceKes: 5000,
    priceUsd: 80,
    period: 'one-time',
  },
  {
    id: 'addon-booking',
    category: 'addons',
    name: 'Online Booking & Scheduling Engine',
    tagline: 'Calendar sync, appointment reminders, and deposit payments',
    priceKes: 15000,
    priceUsd: 220,
    period: 'one-time',
  },
  {
    id: 'addon-payment-gateway',
    category: 'addons',
    name: 'Card & International Gateway (Paystack/Stripe)',
    tagline: 'Full checkout integration supporting USD, EUR, GBP and regional card rails',
    priceKes: 10000,
    priceUsd: 150,
    period: 'one-time',
  },
  {
    id: 'addon-mpesa',
    category: 'addons',
    name: 'M-Pesa STK Push Gateway (Daraja API)',
    tagline: 'Automated instant mobile checkout, callback reconciliation & ledger settlement',
    priceKes: 10000,
    priceUsd: 150,
    period: 'one-time',
    badge: 'Kenya SME',
  },
  {
    id: 'addon-seo-advanced',
    category: 'addons',
    name: 'Advanced SEO & Schema.org Hardening',
    tagline: 'Structured data snippets, Core Web Vitals optimization & Search Console verification',
    priceKes: 15000,
    priceUsd: 220,
    period: 'one-time',
  },
  {
    id: 'addon-copywriting',
    category: 'addons',
    name: 'Professional Copywriting (Per Section)',
    tagline: 'Conversion-engineered English copywriting, value propositions & CTA narrative',
    priceKes: 10000,
    priceUsd: 180,
    period: 'one-time',
  },
  {
    id: 'addon-migration',
    category: 'addons',
    name: 'Complete Website & Content Migration',
    tagline: 'Zero-downtime DNS transfer, asset preservation, and 301 redirect map',
    priceKes: 5000,
    priceUsd: 80,
    period: 'one-time',
  },
  {
    id: 'addon-multilingual',
    category: 'addons',
    name: 'Multilingual Localization (i18n)',
    tagline: 'Multi-language content pipeline, language selector & localized SEO routing',
    priceKes: 15000,
    priceUsd: 240,
    period: 'one-time',
  },
  {
    id: 'addon-document-hub',
    category: 'addons',
    name: 'Document & PDF Vault (R2/S3)',
    tagline: 'Searchable resource library, protected client file downloads & CDN delivery',
    priceKes: 6000,
    priceUsd: 120,
    period: 'one-time',
  },
  {
    id: 'addon-admin-dashboard',
    category: 'addons',
    name: 'Bespoke Client Admin & Media Vault Hub',
    tagline: 'Subdomain admin panel for media uploads, hero CTA edits & announcements with zero code',
    priceKes: 25000,
    priceUsd: 299,
    period: 'one-time',
    badge: 'Admin Hub',
  },
];
