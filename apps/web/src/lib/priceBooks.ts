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
    'care-enterprise': {
      productId: 'care-enterprise',
      category: 'care',
      name: 'Care Enterprise',
      amount: 40000,
      currency: 'KES',
      formatted: 'KSh 40,000/mo',
      billingPeriod: 'month',
      description: 'Dedicated engineering pod, 24/7 SLA, and full-lifecycle cloud management.',
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
      name: 'Host Professional',
      amount: 15000,
      currency: 'KES',
      formatted: 'KSh 15,000/yr',
      billingPeriod: 'year',
      description: 'Dedicated compute allocation, Redis object caching, 30-day snapshot backups.',
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
    },
    'host-cloud': {
      productId: 'host-cloud',
      category: 'hosting',
      name: 'Managed Cloud',
      amount: 30000,
      currency: 'KES',
      formatted: 'From KSh 30,000/yr',
      billingPeriod: 'year',
      description: 'Isolated Docker container orchestration, dedicated PostgreSQL database, Redis cluster.',
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
    'care-enterprise': {
      productId: 'care-enterprise',
      category: 'care',
      name: 'Care Enterprise',
      amount: 400,
      currency: 'USD',
      formatted: '$400/mo',
      billingPeriod: 'month',
      description: 'Dedicated engineering pod, 24/7 SLA, and full-lifecycle cloud management.',
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
      name: 'Host Professional',
      amount: 189,
      currency: 'USD',
      formatted: '$189/yr',
      billingPeriod: 'year',
      description: 'Dedicated isolated compute, Redis acceleration, real-time APM telemetry, and 99.95% uptime SLA.',
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
    },
    'host-cloud': {
      productId: 'host-cloud',
      category: 'hosting',
      name: 'Managed Cloud',
      amount: 290,
      currency: 'USD',
      formatted: 'From $290/yr',
      billingPeriod: 'year',
      description: 'Isolated Docker container orchestration, dedicated PostgreSQL database, Redis cluster.',
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
