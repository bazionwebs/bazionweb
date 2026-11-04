export type Market = 'kenya' | 'international';

export interface PricePoint {
  amount: number | null;
  currency: 'KES' | 'USD';
  formatted: string;
  period?: 'one-time' | 'month' | 'year' | 'starting';
}

export interface WebsitePlan {
  id: string;
  name: string;
  badge?: string;
  popular?: boolean;
  kenyaPrice: string;
  intlPrice: string;
  pages: string;
  timeline: string;
  revisions: string;
  support: string;
  description: string;
  targetAudience: string;
  deliverables: string[];
  ctaText: string;
  ctaHref: string;
}

export interface EcommercePlan {
  id: string;
  name: string;
  badge?: string;
  popular?: boolean;
  kenyaPrice: string;
  intlPrice: string;
  products: string;
  support: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
}

export interface CustomSystemTier {
  category: string;
  kenyaStarting: string;
  intlStarting: string;
  description: string;
  examples: string[];
}

export interface CarePlan {
  id: string;
  name: string;
  badge?: string;
  popular?: boolean;
  kenyaPrice: string;
  intlPrice: string;
  hours: string;
  description: string;
  features: string[];
  ctaHref: string;
}

export interface HostingPlan {
  id: string;
  name: string;
  badge?: string;
  popular?: boolean;
  kenyaPrice: string;
  intlPrice: string;
  billingPeriod: string;
  resources: string;
  support: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
}

export interface AddOnItem {
  id: string;
  name: string;
  category: 'feature' | 'integration' | 'marketing' | 'workflow';
  kenyaPrice: string;
  intlPrice: string;
  description: string;
  rawKes: number;
  rawUsd: number;
}

export const WEBSITE_PACKAGES: WebsitePlan[] = [
  {
    id: 'launch',
    name: 'Launch',
    kenyaPrice: 'KSh 25,000',
    intlPrice: '$450',
    pages: 'Up to 5 pages',
    timeline: '10–15 working days (2–3 weeks)',
    revisions: '1 revision round',
    support: '14-day post-launch support',
    targetAudience: 'Individuals, startups and small businesses getting online with modern authority.',
    description: 'A polished, fast-loading digital storefront with mobile optimization and direct contact channels.',
    deliverables: [
      'Responsive mobile-first layout',
      'Home, About, Services, Contact & Portfolio',
      'Interactive contact form & WhatsApp direct chat',
      'Google Maps & social media integration',
      'Basic technical SEO foundation & meta tags',
      'Automated SSL certificate configuration',
      'Google Analytics / privacy-first telemetry',
      'Fast CDN deployment & domain DNS setup',
      '1 revision round before sign-off',
      '14-day defect warranty & post-launch support',
    ],
    ctaText: 'Start with Launch',
    ctaHref: '/quote?package=launch',
  },
  {
    id: 'business',
    name: 'Business',
    badge: 'Most Popular',
    popular: true,
    kenyaPrice: 'KSh 90,000',   // ← canonical: priceBooks.ts KE-2026-v1
    intlPrice: '$950',          // ← canonical: priceBooks.ts GLOBAL-2026-v1
    pages: 'Up to 10 pages',
    timeline: '15–20 working days (3–4 weeks)',
    revisions: '2 revision rounds',
    support: '30-day post-launch support',
    targetAudience: 'Recommended for growing SMEs, churches, schools, NGOs, consultants and institutions.',
    description: 'Tailored corporate design with CMS content management, blog engine, lead-capture, and SEO hardening.',
    deliverables: [
      'Custom UI/UX website architecture',
      'Full CMS integration (self-manage text & media)',
      'Blog / news / announcements engine',
      'Advanced multi-field lead-generation forms',
      'Technical SEO, XML sitemap & Google Search Console setup',
      'Speed optimization & WebP image pipeline',
      'Enterprise security headers & hardening',
      'Automated backup configuration',
      'Google Analytics 4 & conversion event tracking',
      '1-on-1 administrator training session',
      '2 revision rounds included',
      '30-day post-launch technical support',
    ],
    ctaText: 'Choose Business',
    ctaHref: '/quote?package=business',
  },
  {
    id: 'professional',
    name: 'Professional',
    badge: 'Established Orgs',
    kenyaPrice: 'KSh 160,000',  // ← canonical: priceBooks.ts KE-2026-v1
    intlPrice: '$1,750',        // ← canonical: priceBooks.ts GLOBAL-2026-v1
    pages: 'Up to 15 pages',
    timeline: '4–6 weeks',
    revisions: '2 revision rounds',
    support: '60-day post-launch support',
    targetAudience: 'Established companies and multi-department organizations needing advanced presence & integrations.',
    description: 'High-performance digital presence with structured data, newsletter pipelines, search, and document centers.',
    deliverables: [
      'Bespoke Figma UI/UX design prototype',
      'Up to 15 structured, conversion-engineered pages',
      'Full CMS with multi-author workflows',
      'Site-wide live search & document download library',
      'Newsletter subscription integration (Mailchimp/Brevo)',
      'Advanced Schema.org structured data & rich snippets',
      'Full conversion funnels & goal tracking',
      'Advanced Core Web Vitals optimization',
      'Third-party software & API integrations',
      'Security audit & automated disaster recovery setup',
      '2 revision rounds included',
      '60-day priority support & monitoring',
    ],
    ctaText: 'Choose Professional',
    ctaHref: '/quote?package=professional',
  },
  {
    id: 'corporate',
    name: 'Corporate & Custom',
    badge: 'Enterprise',
    kenyaPrice: 'From KSh 320,000', // ← canonical: priceBooks.ts KE-2026-v1
    intlPrice: 'From $3,600',       // ← canonical: priceBooks.ts GLOBAL-2026-v1
    pages: 'Unlimited / Custom Scoped',
    timeline: '6–10 weeks',
    revisions: 'Defined in Contract',
    support: '90-day dedicated warranty',
    targetAudience: 'Corporations, universities, regional NGOs, large ministries and multi-entity institutions.',
    description: 'Full discovery, custom software engineering, specialized integrations, SLA guarantees and formal handover.',
    deliverables: [
      'Comprehensive discovery & technical requirements spec',
      'Information architecture & multi-stakeholder design reviews',
      'Custom frontend & backend web applications',
      'Enterprise CMS or headless architecture',
      'Custom database schemas & third-party API sync',
      'Enterprise security compliance & OWASP audit',
      'End-to-end automated testing & staging QA environment',
      'Staff training workshops & administrator manual',
      'Dedicated project manager & formal milestone sign-offs',
      '90-day priority SLA warranty and handover',
    ],
    ctaText: 'Request Custom Proposal',
    ctaHref: '/contact?service=corporate',
  },
];

export const ECOMMERCE_PACKAGES: EcommercePlan[] = [
  {
    id: 'ecom-starter',
    name: 'E-Commerce Starter',
    kenyaPrice: 'KSh 90,000',   // ← matches priceBooks.ts
    intlPrice: '$890',          // ← canonical: priceBooks.ts GLOBAL-2026-v1
    products: 'Up to 30 products',
    support: '30-day support',
    description: 'For boutiques, artisans, and retailers launching their first professional transactional store.',
    features: [
      'Product catalogue & category filtering',
      'Shopping cart & streamlined mobile checkout',
      'Customer accounts & order status tracking',
      'M-Pesa Daraja payment integration (Kenya)',
      'Stripe & credit card payment gateway',
      'Automated customer & admin order email alerts',
      'Basic delivery zones & shipping fee rules',
      'Catalogue search & promotional banners',
      'Security SSL, backup configuration & store training',
      '30-day post-launch technical support',
    ],
    ctaText: 'Launch Online Store',
    ctaHref: '/quote?package=ecom-starter',
  },
  {
    id: 'ecom-business',
    name: 'E-Commerce Business',
    badge: 'Recommended Retail',
    popular: true,
    kenyaPrice: 'KSh 175,000',  // ← canonical: priceBooks.ts KE-2026-v1
    intlPrice: '$1,650',        // ← canonical: priceBooks.ts GLOBAL-2026-v1
    products: '100+ products',
    support: '90-day support',
    description: 'For established brands requiring inventory sync, discount coupons, advanced shipping, and high performance.',
    features: [
      '100+ product catalogue with multi-variant options (size, color)',
      'Automated stock/inventory alerts & out-of-stock management',
      'Integrated M-Pesa STK Push + International Cards + PayPal',
      'Coupons, discount rules & promotional engines',
      'Dynamic shipping calculations by location/weight',
      'Automated tax & VAT invoice generation',
      'Abandoned cart recovery alerts',
      'Full e-commerce analytics & Facebook Pixel / GA4 setup',
      'Core Web Vitals performance optimization for fast checkout',
      '90-day dedicated post-launch support',
    ],
    ctaText: 'Build E-Commerce Business',
    ctaHref: '/quote?package=ecom-business',
  },
  {
    id: 'ecom-pro',
    name: 'E-Commerce Professional',
    badge: 'High-Volume & B2B',
    kenyaPrice: 'From KSh 320,000', // ← canonical: priceBooks.ts KE-2026-v1
    intlPrice: 'From $3,600',       // ← canonical: priceBooks.ts GLOBAL-2026-v1
    products: 'Enterprise Scale',
    support: 'Dedicated SLA',
    description: 'Bespoke commerce platforms with ERP/accounting integration, subscriptions, multi-vendor, or wholesale tiers.',
    features: [
      'Custom commerce workflows & B2B pricing tiers',
      'Multiple payment gateways & regional currency switching',
      'Direct shipping courier API integrations',
      'Accounting & ERP synchronization (QuickBooks/Xero/SAP)',
      'Recurring subscriptions & membership access portals',
      'Advanced customer segmentation & marketing automation',
      'Multi-admin role permissions & audit logging',
      'High-concurrency database architecture & caching',
      'Custom discovery & technical specification',
      'Dedicated engineering team & custom SLA',
    ],
    ctaText: 'Schedule Commerce Discovery',
    ctaHref: '/contact?service=ecommerce-enterprise',
  },
];

export const CUSTOM_SYSTEM_TIERS: CustomSystemTier[] = [
  {
    category: 'Discovery & Specification Phase',
    kenyaStarting: 'KSh 25,000 – 75,000',
    intlStarting: '$500 – $1,500',
    description: 'Before writing code, we document your exact system architecture, workflows, database schema, and milestones. (Fee credited toward development if project proceeds).',
    examples: ['Requirements Document', 'Wireframes & UI Prototypes', 'Database Entity Models', 'API Roadmap & Cost Estimate'],
  },
  {
    category: 'Client Portals & API Gateways',       // was: Booking Platforms
    kenyaStarting: 'From KSh 180,000',               // ← canonical: priceBooks.ts custom-tier-1
    intlStarting: 'From $2,200',                     // ← canonical: priceBooks.ts custom-tier-1
    description: 'Secure customer web applications with authenticated logins, appointment booking, file sharing, and self-service dashboards.',
    examples: ['Customer Account Portals', 'Appointment & Service Booking', 'Membership Hubs', 'Document Vaults'],
  },
  {
    category: 'CRMs & Institutional Management Systems',
    kenyaStarting: 'From KSh 200,000',
    intlStarting: 'From $3,900',
    description: 'Custom management systems tailored to your internal operational structure without recurring SaaS per-seat taxes.',
    examples: ['Church Management & Giving Systems', 'Lead & Deal Pipeline CRMs', 'Clinic/Patient Scheduling', 'Inventory & Asset Trackers'],
  },
  {
    category: 'School Portals & Learning Management (LMS)',
    kenyaStarting: 'From KSh 250,000 – 300,000',
    intlStarting: 'From $4,900',
    description: 'Full educational platforms with student admission, grading, course modules, quizzes, and automated certificate generation.',
    examples: ['School Management Portals', 'E-Learning & Video Courses', 'Student Grading & Fee Portals', 'Teacher/Parent Communication'],
  },
  {
    category: 'ERP, SaaS Platforms & Enterprise Portals',
    kenyaStarting: 'From KSh 500,000 – 750,000+',   // ← matches priceBooks.ts custom-tier-3: 750,000
    intlStarting: 'From $8,500 – $15,000+',         // ← matches priceBooks.ts custom-tier-3
    description: 'Multi-tenant software-as-a-service platforms, automated billing engines, and cross-department enterprise operational systems.',
    examples: ['SaaS Minimum Viable Products (MVP)', 'Custom ERP Modules', 'Supply Chain Portals', 'Financial Transaction Platforms'],
  },
];

export const CARE_PLANS: CarePlan[] = [
  {
    id: 'care-essential',
    name: 'Care Essential',
    kenyaPrice: 'KSh 5,000/month',
    intlPrice: '$75/month',
    hours: '1 hour support/month',
    description: 'Peace-of-mind maintenance keeping your site secure, updated, and bug-free.',
    features: [
      'Monthly CMS core and plugin updates',
      'Verified offsite backups & restore tests',
      'Security patch monitoring & malware scans',
      '24/7 uptime monitoring with instant alert dispatch',
      'Minor bug fixes & broken link checks',
      '1 hour allocated for content edits or support',
      'Monthly digital health summary report',
    ],
    ctaHref: '/store?add=care-essential#plans',
  },
  {
    id: 'care-business',
    name: 'Care Business',
    badge: 'Most Popular',
    popular: true,
    kenyaPrice: 'KSh 10,000/month',
    intlPrice: '$150/month',
    hours: 'Up to 2 hours support/month',
    description: 'Proactive management with weekly update cycles, SEO health reviews, and priority turnaround.',
    features: [
      'Everything in Care Essential, plus:',
      'Weekly updates and plugin compatibility testing',
      'Daily automated backups',
      'Proactive security monitoring & firewall tuning',
      'Core Web Vitals & speed monitoring',
      'SEO health audits & indexation monitoring',
      'Monthly analytics review & actionable insights',
      'Up to 2 support hours for content & enhancements',
      'Same-day priority support response',
    ],
    ctaHref: '/store?add=care-business#plans',
  },
  {
    id: 'care-professional',
    name: 'Care Professional',
    badge: 'Mission-Critical',
    kenyaPrice: 'KSh 20,000/month',
    intlPrice: '$300/month',
    hours: 'Up to 5 hours support/month',
    description: 'Full digital engineering partnership for companies requiring ongoing development and optimization.',
    features: [
      'Everything in Care Business, plus:',
      'Proactive security auditing & penetration monitoring',
      'On-demand staging backups & rollbacks',
      'SEO keyword position & schema monitoring',
      'Active content publishing assistance',
      'Frontend & backend code development support',
      'Up to 5 dedicated engineering hours included',
      'Quarterly digital strategy & performance call',
      'Priority emergency response channel (WhatsApp & phone)',
    ],
    ctaHref: '/store?add=care-professional#plans',
  },
  {
    id: 'care-enterprise',
    name: 'Care Enterprise',
    kenyaPrice: 'From KSh 40,000/month',
    intlPrice: 'From $400/month',
    hours: 'Custom SLA allocation',
    description: 'Dedicated support agreements for high-revenue e-commerce, SaaS, institutions, and portals.',
    features: [
      'Custom SLA with guaranteed 15-minute P1 response',
      'Dedicated named technical account manager',
      'Disaster recovery drills & database failover testing',
      'High-traffic flash sale & campaign readiness prep',
      'Dedicated engineering sprint allocation',
      'Quarterly executive reviews',
      'Direct developer escalation hotline',
    ],
    ctaHref: '/store?add=care-enterprise#plans',
  },
];

export const MANAGED_HOSTING_PLANS: HostingPlan[] = [
  {
    id: 'host-essential',
    name: 'Host Essential',
    kenyaPrice: 'KSh 4,500/year',
    intlPrice: '$49/year',
    billingPeriod: 'Billed annually',
    resources: '0.5 vCPU / 384 MB RAM, 10 GB NVMe SSD',
    support: 'Standard email support',
    description: 'Isolated container hosting with automated SSL, Cloudflare Edge CDN, and weekly R2 cloud backups.',
    features: [
      'Isolated Docker container (0.5 vCPU / 384 MB RAM burst)',
      '10 GB high-speed NVMe SSD & 100 GB/mo bandwidth',
      'Free automated SSL (HTTPS) & Cloudflare Edge CDN',
      'Professional email forwarding (@yourcompany.com)',
      'Automated weekly off-site R2 cloud backups',
      '99.9% uptime monitoring & container auto-healing',
      'Standard technical support',
    ],
    ctaText: 'Choose Host Essential',
    ctaHref: '/store?add=host-essential#hosting',
  },
  {
    id: 'host-business',
    name: 'Host Business',
    badge: 'Recommended',
    popular: true,
    kenyaPrice: 'KSh 8,500/year',
    intlPrice: '$99/year',
    billingPeriod: 'Billed annually',
    resources: '1.5 vCPU / 768 MB RAM, 25 GB NVMe, 5 Emails',
    support: 'Priority ticket support',
    description: '3x compute power with 5 corporate email inboxes, shared DB + Redis cache, and daily R2 backups.',
    features: [
      '3x compute allocation (1.5 vCPU / 768 MB RAM burst)',
      '25 GB NVMe SSD storage & 500 GB/mo bandwidth',
      'Up to 5 corporate email inboxes (SPF, DKIM & DMARC)',
      'Isolated PostgreSQL / MariaDB schema + Redis cache',
      'Automated daily off-site R2 backups (14-day retention)',
      'Free SSL, Cloudflare CDN, WAF & DDoS defense',
      'Staging environment & seamless free migration',
      'Priority ticket support response',
    ],
    ctaText: 'Choose Host Business',
    ctaHref: '/store?add=host-business#hosting',
  },
  {
    id: 'host-professional',
    name: 'Host Professional',
    badge: 'High Performance',
    kenyaPrice: 'KSh 15,000/year',
    intlPrice: '$189/year',
    billingPeriod: 'Billed annually',
    resources: '2.0 vCPU / 1.5 GB RAM, 50 GB NVMe, Redis Cache',
    support: 'Priority phone & ticket support',
    description: 'High-concurrency container hosting with isolated Redis 7 caching, 10 emails, and 30-day R2 snapshots.',
    features: [
      'High-concurrency compute (2.0 vCPU / 1.5 GB RAM burst)',
      '50 GB NVMe SSD storage & 1 TB/mo bandwidth',
      'Up to 10 corporate email inboxes (@yourcompany.com)',
      'Isolated Redis 7 in-memory object cache & ACL',
      'Enhanced daily R2 backup retention (30-day snapshots)',
      'Automated staging environment with Git deploy hooks',
      'Real-time uptime telemetry & proactive threat blocking',
      'Priority phone & direct engineering support',
    ],
    ctaText: 'Choose Host Professional',
    ctaHref: '/store?add=host-pro#hosting',
  },
  {
    id: 'host-cloud',
    name: 'Managed Cloud',
    badge: 'Custom Architecture',
    kenyaPrice: 'From KSh 30,000/year',
    intlPrice: 'From $290/year',
    billingPeriod: 'Billed annually',
    resources: '4.0 vCPU / 2 GB+ RAM, 100 GB NVMe, Dedicated DB',
    support: 'Dedicated DevOps SLA',
    description: 'Fully isolated multi-container cloud cluster with dedicated PostgreSQL 16 and Redis 7 instances.',
    features: [
      'Dedicated container cluster (4.0 vCPU / 2 GB+ RAM)',
      '100 GB NVMe SSD storage & 2 TB/mo bandwidth (10 Gbps)',
      'Up to 25 corporate email accounts & custom routing',
      'Dedicated standalone PostgreSQL 16 & Redis 7 instances',
      'Automated CI/CD pipelines & zero-downtime releases',
      'Custom Cloudflare WAF, rate-limiting & daily R2 backups',
      '24/7 server health telemetry & direct engineer SLA',
    ],
    ctaText: 'Consult Cloud Architect',
    ctaHref: '/contact?service=managed-cloud',
  },
];

export const ADD_ON_RATE_CARD: AddOnItem[] = [
  {
    id: 'extra-page',
    name: 'Additional Page',
    category: 'feature',
    kenyaPrice: 'KSh 2,000',
    intlPrice: '$40',
    description: 'Fully designed and responsive page adhering to your design system.',
    rawKes: 2000,
    rawUsd: 40,
  },
  {
    id: 'blog-news',
    name: 'Blog / News Engine',
    category: 'feature',
    kenyaPrice: 'KSh 7,500',
    intlPrice: '$120',
    description: 'Full article CMS, categories, author bio, social sharing, and search.',
    rawKes: 7500,
    rawUsd: 120,
  },
  {
    id: 'advanced-form',
    name: 'Advanced Form / Survey',
    category: 'feature',
    kenyaPrice: 'KSh 5,000',
    intlPrice: '$80',
    description: 'Multi-step logic, file uploads, conditional fields, and CRM webhook.',
    rawKes: 5000,
    rawUsd: 80,
  },
  {
    id: 'booking-system',
    name: 'Online Booking System',
    category: 'feature',
    kenyaPrice: 'From KSh 15,000',
    intlPrice: 'From $220',
    description: 'Calendar scheduling, appointment reminders, and automated calendar sync.',
    rawKes: 15000,
    rawUsd: 220,
  },
  {
    id: 'payment-gateway',
    name: 'Card Payment Gateway',
    category: 'integration',
    kenyaPrice: 'From KSh 10,000',
    intlPrice: 'From $150',
    description: 'Stripe, PayPal, or PesaPal secure card processing integration.',
    rawKes: 10000,
    rawUsd: 150,
  },
  {
    id: 'mpesa-integration',
    name: 'M-Pesa STK Push Integration',
    category: 'integration',
    kenyaPrice: 'From KSh 10,000',
    intlPrice: 'From $150',
    description: 'Direct Safaricom Daraja STK Push prompt for instant Kenya mobile checkout.',
    rawKes: 10000,
    rawUsd: 150,
  },
  {
    id: 'newsletter',
    name: 'Newsletter Integration',
    category: 'marketing',
    kenyaPrice: 'KSh 5,000',
    intlPrice: '$80',
    description: 'Mailchimp or Brevo opt-in popups, footer forms, and welcome automated emails.',
    rawKes: 5000,
    rawUsd: 80,
  },
  {
    id: 'advanced-seo',
    name: 'Advanced SEO Foundation',
    category: 'marketing',
    kenyaPrice: 'From KSh 15,000',
    intlPrice: 'From $220',
    description: 'Structured Schema.org markup, keyword research, meta tuning, and canonical audit.',
    rawKes: 15000,
    rawUsd: 220,
  },
  {
    id: 'copywriting',
    name: 'Professional Copywriting',
    category: 'marketing',
    kenyaPrice: 'From KSh 10,000',
    intlPrice: 'From $180',
    description: 'Persuasive, conversion-driven copy for key landing pages and service decks.',
    rawKes: 10000,
    rawUsd: 180,
  },
  {
    id: 'migration',
    name: 'Website Migration',
    category: 'workflow',
    kenyaPrice: 'From KSh 5,000',
    intlPrice: 'From $80',
    description: 'Zero-downtime transfer of content, database, and DNS from your old host.',
    rawKes: 5000,
    rawUsd: 80,
  },
  {
    id: 'extra-revision',
    name: 'Additional Revision Round',
    category: 'workflow',
    kenyaPrice: 'KSh 3,000',
    intlPrice: '$50',
    description: 'One additional structured revision round beyond the package limit.',
    rawKes: 3000,
    rawUsd: 50,
  },
  {
    id: 'custom-api',
    name: 'Custom API Integration',
    category: 'integration',
    kenyaPrice: 'From KSh 15,000',
    intlPrice: 'From $240',
    description: 'Connect third-party SaaS, ERP, CRM, or external webhooks.',
    rawKes: 15000,
    rawUsd: 240,
  },
  {
    id: 'rush-delivery',
    name: 'Priority / Rush Delivery',
    category: 'workflow',
    kenyaPrice: '+25% to +50%',
    intlPrice: '+25% to +50%',
    description: 'Accelerated production schedule (subject to team capacity).',
    rawKes: 0,
    rawUsd: 0,
  },
];

export const HOURLY_SUPPORT_RATES = {
  kenya: 'KSh 3,500/hour (minimum 1 hour)',
  international: '$50/hour (minimum 1 hour)',
};

export const PRICING_PRINCIPLES = [
  {
    title: '100% Client Ownership',
    description:
      'You own your domain, website code, visual assets, customer data, and accounts. BazionWeb never holds domains or code hostage.',
  },
  {
    title: 'Transparent Documented Scope',
    description:
      'Every project receives a detailed scope, milestone plan, and quotation. No surprise invoices or hidden maintenance penalties.',
  },
  {
    title: 'Third-Party Cost Clarity',
    description:
      'Domain registrations, premium plugins, cloud hosting fees, SMS gateways, and payment gateway charges are billed at cost with zero hidden markups.',
  },
  {
    title: 'Structured Milestone Payments',
    description:
      'Standard projects operate on a 50% deposit and 50% on final launch sign-off. Larger enterprise projects follow structured 40% → 30% → 20% → 10% delivery milestones.',
  },
  {
    title: 'Defect Warranty & Included Support',
    description:
      'Every build includes a dedicated post-launch support window (Launch: 14 days, Business: 30 days, Professional: 60 days, Corporate: 90 days) to guarantee peace of mind.',
  },
  {
    title: 'No Mandatory Long-Term Lock-in',
    description:
      'You are free to host or maintain your website independently after launch, or subscribe to our managed care plans for hassle-free reliability.',
  },
];
