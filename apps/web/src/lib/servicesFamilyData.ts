export interface ServiceFamily {
  slug: string;
  name: string;
  tagline: string;
  heroSubtitle: string;
  badge: string;
  whoItsFor: Array<{
    title: string;
    profile: string;
    fit: string | { KE: string; GLOBAL: string };
  }>;
  packages: Array<{
    id: string;
    name: string;
    priceKenya: string;
    priceIntl: string;
    badge?: string;
    popular?: boolean;
    pagesOrScale: string;
    timeline: string;
    warranty: string;
    description: string;
    deliverables: string[];
    ctaHref: string;
  }>;
  keyFeatures: Array<{
    title: string;
    description: string;
  }>;
  modularAddons: Array<{
    name: string;
    priceKenya: string;
    priceIntl: string;
    description: string;
  }>;
  outOfScope: string[];
  faqs: Array<{
    question: string;
    answer: string | { KE: string; GLOBAL: string };
  }>;
}

export const SERVICE_FAMILIES_DATA: Record<string, ServiceFamily> = {
  websites: {
    slug: 'websites',
    name: 'Website Design & Engineering',
    tagline: 'Custom-built. Launch-ready. Engineered for conversion.',
    heroSubtitle:
      'We design and engineer responsive, high-performance websites on modern Next.js. Fast-loading, CMS-integrated, and built to convert visitors into loyal clients.',
    badge: 'Family 01 — Websites',
    whoItsFor: [
      {
        title: 'Startups & Sole Practitioners',
        profile: 'Launching a brand-new digital footprint',
        fit: {
          KE: 'Launch Package (Up to 5 pages, 5–10 days turnaround, KSh 25,000).',
          GLOBAL: 'Launch Package (Up to 5 pages, 5–10 days turnaround, $450).',
        },
      },
      {
        title: 'Growing SMEs & Organizations',
        profile: 'Established businesses needing CMS and lead funnels',
        fit: {
          KE: 'Business Package (Up to 10 pages, CMS, blog engine, KSh 90,000).',
          GLOBAL: 'Business Package (Up to 10 pages, CMS, blog engine, $950).',
        },
      },
      {
        title: 'Corporations & Institutions',
        profile: 'Multi-department firms requiring advanced SEO and integrations',
        fit: 'Professional & Corporate Packages (15+ pages, custom UX, SLA support).',
      },
    ],
    packages: [
      {
        id: 'launch',
        name: 'Launch Website',
        priceKenya: 'KSh 25,000',
        priceIntl: '$450',
        pagesOrScale: 'Up to 5 pages',
        timeline: '5–10 working days',
        warranty: '14-day warranty',
        description: 'Clean, modern digital storefront designed for startups and small businesses.',
        deliverables: [
          'Mobile-first responsive UX/UI architecture',
          'Home, About, Services, Contact & Portfolio',
          'Interactive contact form & WhatsApp direct chat',
          'Google Maps & social media integration',
          'Basic technical SEO foundation & meta tags',
          'SSL HTTPS encryption configuration',
          '1 revision round before sign-off',
          '14-day post-launch technical defect warranty',
        ],
        ctaHref: '/quote?package=launch',
      },
      {
        id: 'business',
        name: 'Business Website',
        priceKenya: 'KSh 90,000',  // ← canonical: priceBooks.ts KE-2026-v1
        priceIntl: '$950',        // ← canonical: priceBooks.ts GLOBAL-2026-v1
        badge: 'Most Popular',
        popular: true,
        pagesOrScale: 'Up to 10 pages',
        timeline: '10–18 working days',
        warranty: '30-day warranty',
        description: 'Custom corporate design with CMS, blog, lead-capture forms, and technical SEO.',
        deliverables: [
          'Custom UI/UX website architecture',
          'Full CMS integration (self-manage text & media)',
          'Blog / news / announcements engine',
          'Advanced multi-field lead-generation forms',
          'Technical SEO, XML sitemap & Search Console setup',
          'Speed optimization & WebP image pipeline',
          'Enterprise security hardening & daily backups',
          '1-on-1 administrator training session',
          '2 revision rounds included',
          '30-day post-launch technical support',
        ],
        ctaHref: '/quote?package=business',
      },
      {
        id: 'professional',
        name: 'Professional Website',
        priceKenya: 'KSh 160,000', // ← canonical: priceBooks.ts KE-2026-v1
        priceIntl: '$1,750',       // ← canonical: priceBooks.ts GLOBAL-2026-v1
        badge: 'Established Orgs',
        pagesOrScale: 'Up to 15 pages',
        timeline: '15–25 working days',
        warranty: '60-day warranty',
        description: 'High-performance presence with structured data, newsletter pipelines, and document hubs.',
        deliverables: [
          'Bespoke Figma UI/UX design prototype',
          'Up to 15 structured conversion-engineered pages',
          'Full CMS with multi-author workflows',
          'Site-wide live search & document download library',
          'Newsletter subscription integration (Mailchimp/Brevo)',
          'Advanced Schema.org structured data & rich snippets',
          'Full conversion funnels & goal tracking',
          'Core Web Vitals performance tuning',
          '2 revision rounds included',
          '60-day priority support & monitoring',
        ],
        ctaHref: '/quote?package=professional',
      },
      {
        id: 'corporate',
        name: 'Corporate & Enterprise',
        priceKenya: 'From KSh 320,000', // ← canonical: priceBooks.ts KE-2026-v1
        priceIntl: 'From $3,600',       // ← canonical: priceBooks.ts GLOBAL-2026-v1
        badge: 'Custom Scope',
        pagesOrScale: 'Bespoke Architecture',
        timeline: '4–8 weeks',
        warranty: '90-day warranty',
        description: 'Discovery, custom development, specialized integrations, and SLA guarantees.',
        deliverables: [
          'Comprehensive discovery & technical requirements spec',
          'Information architecture & multi-stakeholder design reviews',
          'Custom frontend & backend web applications',
          'Enterprise CMS or headless architecture',
          'Enterprise security compliance & OWASP audit',
          'End-to-end automated testing & staging QA environment',
          'Staff training workshops & administrator manual',
          '90-day priority SLA warranty and handover',
        ],
        ctaHref: '/contact?service=corporate',
      },
    ],
    keyFeatures: [
      {
        title: 'Modern Next.js 14 App Architecture',
        description: 'React server components, streaming SSR, and zero layout shift delivering instantaneous page loads.',
      },
      {
        title: 'Intuitive Content Management (CMS)',
        description: 'Update staff bios, publish articles, and change service pricing without writing a line of code.',
      },
      {
        title: 'Technical SEO Built In',
        description: 'Semantic HTML5, automated XML sitemaps, OpenGraph cards, and Google Search Console verification.',
      },
      {
        title: '100% Client Asset Ownership',
        description: 'You own your domain, code repository, content, and hosting accounts with zero vendor lock-in.',
      },
    ],
    modularAddons: [
      {
        name: 'Dynamic Blog / News Engine',
        priceKenya: 'KSh 7,500',
        priceIntl: '$120',
        description: 'Full article collection with categories, author bios, and search.',
      },
      {
        name: 'Advanced Multi-Step Form',
        priceKenya: 'KSh 5,000',
        priceIntl: '$80',
        description: 'Conditional logic, file attachments, and email dispatch.',
      },
      {
        name: 'Multilingual Support (i18n)',
        priceKenya: 'KSh 15,000',
        priceIntl: '$240',
        description: 'Locale routing (/en, /sw, /fr) with language selector.',
      },
      {
        name: 'Document Download Hub',
        priceKenya: 'KSh 6,000',
        priceIntl: '$120',
        description: 'Filterable PDF archive for policy documents and brochures.',
      },
    ],
    outOfScope: [
      'Ongoing commercial copy typing from handwritten documents.',
      'Professional on-site video/photo shoots (can be quoted separately).',
      'Third-party cloud subscriptions and domain registration fees.',
      'Complex transactional e-commerce cart & inventory systems (see Family 02).',
    ],
    faqs: [
      {
        question: 'What is the difference between Launch and Business websites?',
        answer:
          'Launch is a 5-page static brochure site for simple visibility. Business is an expandable 10-page corporate platform with a CMS, blog, lead capture forms, and Google Search Console setup.',
      },
      {
        question: 'Do I get access to edit my own text and images?',
        answer:
          'Yes. On all Business, Professional, and Corporate packages, we configure an intuitive admin dashboard and provide a recorded video training session.',
      },
      {
        question: 'Who owns the domain and website code when finished?',
        answer:
          'You do. BazionWeb guarantees 100% client asset ownership of your domain, code, databases, and media.',
      },
    ],
  },

  ecommerce: {
    slug: 'ecommerce',
    name: 'E-Commerce Solutions',
    tagline: 'High-converting online stores with local & global payment rails.',
    heroSubtitle:
      'From boutique stores to high-volume multi-category catalogues. Seamless M-Pesa STK Push prompts, credit card checkout, inventory tracking, and automated receipts.',
    badge: 'Family 02 — E-Commerce',
    whoItsFor: [
      {
        title: 'Boutiques & Specialty Retailers',
        profile: 'Selling up to 30 curated products online',
        fit: {
          KE: 'E-Commerce Starter (M-Pesa STK, Card checkout, KSh 90,000).',
          GLOBAL: 'E-Commerce Starter (M-Pesa STK, Card checkout, $890).',
        },
      },
      {
        title: 'Established Multi-Product Stores',
        profile: 'Brands requiring inventory management and discount coupons',
        fit: {
          KE: 'E-Commerce Business (100+ products, stock alerts, KSh 175,000).',
          GLOBAL: 'E-Commerce Business (100+ products, stock alerts, $1,650).',
        },
      },
      {
        title: 'High-Volume & Wholesale Retailers',
        profile: 'B2B commerce, ERP integrations, and subscription billing',
        fit: {
          KE: 'E-Commerce Professional (From KSh 320,000).',
          GLOBAL: 'E-Commerce Professional (From $3,600).',
        },
      },
    ],
    packages: [
      {
        id: 'ecom-starter',
        name: 'E-Commerce Starter',
        priceKenya: 'KSh 90,000',
        priceIntl: '$890',
        pagesOrScale: 'Up to 30 products',
        timeline: '2–3 weeks',
        warranty: '30-day warranty',
        description: 'For boutiques, artisans, and retailers launching their first online store.',
        deliverables: [
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
        ctaHref: '/quote?package=ecom-starter',
      },
      {
        id: 'ecom-business',
        name: 'E-Commerce Business',
        priceKenya: 'KSh 175,000', // ← canonical: priceBooks.ts KE-2026-v1
        priceIntl: '$1,650',       // ← canonical: priceBooks.ts GLOBAL-2026-v1
        badge: 'Recommended Retail',
        popular: true,
        pagesOrScale: '100+ products',
        timeline: '3–5 weeks',
        warranty: '90-day warranty',
        description: 'For established brands requiring inventory sync, coupons, and dynamic shipping.',
        deliverables: [
          '100+ product catalogue with multi-variant options (size, color)',
          'Automated stock/inventory alerts & out-of-stock management',
          'Integrated M-Pesa STK Push + International Cards + PayPal',
          'Coupons, discount rules & promotional engines',
          'Dynamic shipping calculations by location/weight',
          'Automated tax & VAT invoice generation',
          'Abandoned cart recovery alerts',
          'Full e-commerce analytics & GA4 purchase events',
          'Core Web Vitals performance optimization',
          '90-day dedicated post-launch support',
        ],
        ctaHref: '/quote?package=ecom-business',
      },
      {
        id: 'ecom-pro',
        name: 'E-Commerce Professional',
        priceKenya: 'From KSh 320,000', // ← canonical: priceBooks.ts KE-2026-v1
        priceIntl: 'From $3,600',       // ← canonical: priceBooks.ts GLOBAL-2026-v1
        badge: 'High-Volume & B2B',
        pagesOrScale: 'Enterprise Scale',
        timeline: '6–10 weeks',
        warranty: 'Dedicated SLA',
        description: 'Custom commerce platforms with ERP sync, subscriptions, and custom APIs.',
        deliverables: [
          'Custom commerce workflows & B2B pricing tiers',
          'Multiple payment gateways & regional currency switching',
          'Direct shipping courier API integrations',
          'Accounting & ERP synchronization (QuickBooks/Xero/SAP)',
          'Recurring subscriptions & membership access portals',
          'Multi-admin role permissions & audit logging',
          'High-concurrency database architecture & caching',
          'Custom discovery & technical specification',
          'Dedicated engineering team & custom SLA',
        ],
        ctaHref: '/contact?service=ecommerce-enterprise',
      },
    ],
    keyFeatures: [
      {
        title: 'M-Pesa STK Push Integration',
        description: 'Customers receive an instant PIN prompt on their phone with automatic payment callback verification.',
      },
      {
        title: 'Global Credit Card Checkout',
        description: 'Paystack 3D-Secure payment rails allow diaspora and international customers to buy effortlessly.',
      },
      {
        title: 'Automated Inventory & Invoices',
        description: 'Low-stock warnings alert your team automatically, while customers receive branded PDF tax invoices.',
      },
      {
        title: 'Mobile-Optimized Checkout Flow',
        description: 'Frictionless 2-step checkout engineered to minimize cart abandonment on smartphone screens.',
      },
    ],
    modularAddons: [
      {
        name: 'Africa\'s Talking Order SMS Alerts',
        priceKenya: 'KSh 8,500',
        priceIntl: '$180',
        description: 'SMS notifications dispatched upon order placement and dispatch.',
      },
      {
        name: 'Tiered Location Shipping Matrix',
        priceKenya: 'KSh 7,500',
        priceIntl: '$150',
        description: 'Automated delivery rates by county, city, or weight band.',
      },
      {
        name: 'Automated PDF Tax Invoicing',
        priceKenya: 'KSh 6,000',
        priceIntl: '$120',
        description: 'Tax-compliant PDF invoice generated and attached to emails.',
      },
    ],
    outOfScope: [
      'Third-party payment transaction percentage charges (Safaricom, Paystack fees).',
      'Ongoing product photoshoot and image editing (client supplies product media).',
      'Physical warehousing, packing, and courier delivery operations.',
    ],
    faqs: [
      {
        question: 'How does M-Pesa STK Push work on the website?',
        answer:
          'When a customer checks out, they enter their Safaricom phone number. A secure prompt appears on their phone requesting their M-Pesa PIN. Once entered, the site confirms payment instantly.',
      },
      {
        question: 'Can we sell in both KES and USD?',
        answer:
          'Yes. Our E-Commerce Business and Professional packages support multi-currency display with appropriate payment routing.',
      },
    ],
  },

  'custom-systems': {
    slug: 'custom-systems',
    name: 'Custom Digital Systems & Portals',
    tagline: 'Tailored software engineered around your specific operational workflows.',
    heroSubtitle:
      'Stop forcing your business into rigid off-the-shelf subscriptions. We build bespoke client portals, booking engines, LMS educational platforms, and CRMs starting with a formal discovery phase.',
    badge: 'Family 03 — Custom Systems',
    whoItsFor: [
      {
        title: 'Service & Professional Firms',
        profile: 'Requiring customer accounts and document exchange',
        fit: {
          KE: 'Client & Partner Portals (From KSh 180,000).',
          GLOBAL: 'Client & Partner Portals (From $2,200).',
        },
      },
      {
        title: 'Churches & Ministry Networks',
        profile: 'Automating tithe tracking, member registries and SMS broadcasts',
        fit: {
          KE: 'Church Management Systems (ChMS) (From KSh 200,000).',
          GLOBAL: 'Church Management Systems (ChMS) (From $3,900).',
        },
      },
      {
        title: 'Schools & Educational Academies',
        profile: 'Managing student admissions, fee ledgers, and grading',
        fit: {
          KE: 'School Information Systems (SIS/UMS) (From KSh 250,000).',
          GLOBAL: 'School Information Systems (SIS/UMS) (From $4,900).',
        },
      },
    ],
    packages: [
      {
        id: 'discovery',
        name: 'Discovery & Technical Blueprint',
        priceKenya: 'KSh 25,000 – 75,000',
        priceIntl: '$500 – $1,500',
        badge: 'Phase 01',
        pagesOrScale: 'Architecture Sprint',
        timeline: '1–2 weeks',
        warranty: '100% Credited to Build',
        description: 'Mandatory technical specification, user roles, workflows, database schema, and cost roadmap.',
        deliverables: [
          'Detailed Software Requirements Document (SRS)',
          'Clickable Figma UX wireframe prototypes',
          'PostgreSQL Entity-Relationship Diagram (ERD)',
          'API contract specifications & integrations list',
          'Itemized milestone development quote & timeline',
          'Discovery fee credited 100% toward build on contract',
        ],
        ctaHref: '/contact?service=discovery',
      },
      {
        id: 'portals',
        name: 'Client & Partner Portals',
        priceKenya: 'From KSh 180,000',
        priceIntl: 'From $2,200',
        badge: 'Client Zone',
        pagesOrScale: 'Authenticated App',
        timeline: '4–6 weeks',
        warranty: '60-day warranty',
        description: 'Secure customer web applications with accounts, appointment booking, and dashboards.',
        deliverables: [
          'Secure JWT/OIDC authentication with role guards',
          'Document vault with encrypted file sharing',
          'Interactive booking & appointment scheduling',
          'Customer billing history & automated receipts',
          'Administrator moderation & user management dashboard',
          '60-day dedicated warranty & defect support',
        ],
        ctaHref: '/contact?service=portals',
      },
      {
        id: 'chms-crm',
        name: 'CRMs & Institutional Management',
        priceKenya: 'From KSh 200,000',
        priceIntl: 'From $3,900',
        badge: 'Operations',
        pagesOrScale: 'Operational Engine',
        timeline: '6–8 weeks',
        warranty: '90-day warranty',
        description: 'Custom management systems tailored to internal operations without monthly per-seat SaaS taxes.',
        deliverables: [
          'Custom lead and operational pipeline workflows',
          'Member directory / customer profile management',
          'Automated M-Pesa payment ledger reconciliation',
          'Branded bulk SMS & email notifications',
          'Audit logging & granular role permissions',
          '90-day dedicated post-launch support',
        ],
        ctaHref: '/contact?service=crm',
      },
      {
        id: 'school-lms',
        name: 'School Systems & LMS',
        priceKenya: 'From KSh 250,000',
        priceIntl: 'From $4,900',
        badge: 'Education',
        pagesOrScale: 'Institutional Platform',
        timeline: '8–12 weeks',
        warranty: '90-day warranty',
        description: 'Educational platforms with student admissions, grading rubrics, and parent fee portals.',
        deliverables: [
          'Student information system & admissions intake',
          'Fee ledger with instant M-Pesa Paybill matching',
          'Automated term PDF report card generator',
          'Teacher grade book & parent communication',
          'Course modules, quizzes & video player (LMS)',
          'Dedicated term-start peak capacity SLA',
        ],
        ctaHref: '/contact?service=education-systems',
      },
    ],
    keyFeatures: [
      {
        title: 'Built Around Your Exact Workflows',
        description: 'No unnecessary fields or clunky workarounds. The software mirrors how your team actually works.',
      },
      {
        title: 'No Per-Seat SaaS Subscriptions',
        description: 'Avoid paying $50/user/month to foreign software vendors. You own the software and database.',
      },
      {
        title: 'Enterprise RBAC & Security',
        description: 'Role-based access control (SuperAdmin, Staff, Client, Viewer) with row-level data segregation.',
      },
      {
        title: 'Automated Audit Logging',
        description: 'Immutable database records tracking who created, edited, deleted, or exported any record.',
      },
    ],
    modularAddons: [
      {
        name: 'Enterprise RBAC Permission Matrix',
        priceKenya: 'KSh 20,000',
        priceIntl: '$400',
        description: 'Granular permissions and data segregation.',
      },
      {
        name: 'SSO Authentication (Google / Microsoft)',
        priceKenya: 'KSh 15,000',
        priceIntl: '$300',
        description: 'Corporate single sign-on with active directory.',
      },
      {
        name: 'Automated PDF Engine (Certificates/Invoices)',
        priceKenya: 'KSh 18,000',
        priceIntl: '$350',
        description: 'High-speed server-side PDF generation with watermarks.',
      },
    ],
    outOfScope: [
      'Purchasing and supplying client computers, barcode scanners, or tablets.',
      'Manual legacy paper data entry (we provide automated CSV/Excel batch importers).',
      'Third-party cloud infrastructure consumption billed directly by AWS or Render.',
    ],
    faqs: [
      {
        question: 'Why do you require a Discovery phase before quoting custom software?',
        answer:
          'Software projects fail when assumptions are made on either side. Discovery produces an exact architectural blueprint, database schema, and fixed quotation so there are zero scope surprises.',
      },
      {
        question: 'Can this software integrate with our existing accounting or payment systems?',
        answer:
          'Yes. We build RESTful APIs and webhook consumers connecting directly to M-Pesa, QuickBooks, Xero, or custom third-party databases.',
      },
    ],
  },

  'managed-technology': {
    slug: 'managed-technology',
    name: 'Managed Technology & Cloud Operations',
    tagline: 'Proactive hosting, security, daily backups, and SLA care retainers.',
    heroSubtitle:
      'BazionWeb is not an unmanaged hosting reseller. We deliver Managed Cloud Operations: infrastructure, configuration, monitoring, backups, updates, and direct developer support.',
    badge: 'Family 04 — Managed Technology',
    whoItsFor: [
      {
        title: 'Single Website Owners',
        profile: 'Businesses wanting fast, secure hosting without cloud management headaches',
        fit: {
          KE: 'Host Essential & Business Plans (KSh 4,500 – 8,500/year).',
          GLOBAL: 'Host Essential & Business Plans ($49 – $99/year).',
        },
      },
      {
        title: 'Active Commercial Websites',
        profile: 'Companies needing continuous updates, offsite backups, and uptime guarantees',
        fit: {
          KE: 'Care Business Plan (KSh 10,000/month).',
          GLOBAL: 'Care Business Plan ($150/month).',
        },
      },
      {
        title: 'Mission-Critical & E-Commerce Web Apps',
        profile: 'High-traffic systems requiring 15-minute emergency SLAs and WAF defense',
        fit: {
          KE: 'Care Professional & Enterprise (From KSh 20,000/month).',
          GLOBAL: 'Care Professional & Enterprise (From $300/month).',
        },
      },
    ],
    packages: [
      {
        id: 'host-essential',
        name: 'Host Essential',
        priceKenya: 'KSh 4,500/year',
        priceIntl: '$49/year',
        pagesOrScale: 'Fast SSD NVMe',
        timeline: 'Annual billing',
        warranty: '99.9% Uptime',
        description: 'Managed web hosting with SSL, DNS management, and automated backups.',
        deliverables: [
          'High-speed SSD NVMe hosting',
          'Free automated SSL (HTTPS) certificate',
          'Cloudflare Edge DNS & global CDN caching',
          'Automated weekly off-site backups',
          '99.9% uptime monitoring',
          'Basic malware scanning & firewall',
          'Standard technical support',
        ],
        ctaHref: '/store?add=host-essential#hosting',
      },
      {
        id: 'host-business',
        name: 'Host Business',
        priceKenya: 'KSh 8,500/year',
        priceIntl: '$99/year',
        badge: 'Recommended',
        popular: true,
        pagesOrScale: '3x CPU/RAM + 5 Emails',
        timeline: 'Annual billing',
        warranty: '99.9% Uptime',
        description: 'Enhanced hosting with business emails, daily backups, and staging testing.',
        deliverables: [
          '3x CPU & memory resources for fast page loads',
          'Up to 5 business email accounts (@yourcompany.com)',
          'Automated daily backups with 14-day retention',
          'Free SSL, Cloudflare CDN & DDoS defense',
          'Staging environment for safe pre-launch testing',
          'Performance & speed monitoring',
          'Seamless free migration from your old host',
          'Priority ticket support response',
        ],
        ctaHref: '/store?add=host-business#hosting',
      },
      {
        id: 'care-business',
        name: 'Care Business Retainer',
        priceKenya: 'KSh 10,000/month',
        priceIntl: '$150/month',
        badge: 'Most Popular Care',
        popular: true,
        pagesOrScale: '2 Support Hours/Mo',
        timeline: 'Monthly retainer',
        warranty: '8h SLA Response',
        description: 'Proactive management with weekly update cycles, SEO reviews, and dedicated support hours.',
        deliverables: [
          'Weekly CMS & plugin compatibility testing',
          'Daily automated off-site encrypted backups',
          'Proactive security monitoring & firewall tuning',
          'Core Web Vitals & speed monitoring',
          'SEO health audits & indexation monitoring',
          'Monthly analytics review & plain-English report',
          'Up to 2 support hours for content & enhancements',
          'Same-day priority support response',
        ],
        ctaHref: '/checkout?plan=care-business',
      },
      {
        id: 'care-pro',
        name: 'Care Professional Retainer',
        priceKenya: 'KSh 20,000/month',
        priceIntl: '$300/month',
        badge: 'Mission-Critical',
        pagesOrScale: '5 Support Hours/Mo',
        timeline: 'Monthly retainer',
        warranty: '4h SLA Response',
        description: 'Full digital engineering partnership with active code support and penetration monitoring.',
        deliverables: [
          'Proactive security auditing & penetration monitoring',
          'On-demand staging backups & rollbacks',
          'SEO keyword position & schema monitoring',
          'Active content publishing assistance',
          'Frontend & backend code development support',
          'Up to 5 dedicated engineering hours included',
          'Quarterly digital strategy & performance call',
          'Priority emergency response channel (WhatsApp & phone)',
        ],
        ctaHref: '/checkout?plan=care-professional',
      },
    ],
    keyFeatures: [
      {
        title: 'The 7 Pillars of Care',
        description: 'Monitor · Secure · Backup · Update · Optimize · Support · Report.',
      },
      {
        title: 'Real Systems Engineers, Not Chatbots',
        description: 'Your tickets are triaged and resolved by senior developers with direct repository access.',
      },
      {
        title: 'Verified Daily Off-Site Backups',
        description: 'Database snapshots stored in encrypted secondary cloud regions with regular restore drills.',
      },
      {
        title: 'Contractual SLA Response Times',
        description: 'Documented response windows backed by service credits if availability drops below 99.9%.',
      },
    ],
    modularAddons: [
      {
        name: 'Extra Engineering Hours Pack (5 Hours)',
        priceKenya: 'KSh 15,000',
        priceIntl: '$220',
        description: 'Dedicated developer hours for new features or design sprints.',
      },
      {
        name: 'Dedicated Staging Environment',
        priceKenya: 'KSh 10,000/yr',
        priceIntl: '$150/yr',
        description: 'Private testing URL matching production.',
      },
      {
        name: 'Pay-As-You-Go Ad-Hoc Support',
        priceKenya: 'KSh 3,500/hr',
        priceIntl: '$50/hr',
        description: 'On-demand technical assistance without a monthly contract.',
      },
    ],
    outOfScope: [
      'Unrestricted scope creep (maintenance covers allocated hours; new features quoted separately).',
      'Third-party cloud vendor outages beyond BazionWeb infrastructure control.',
      'Fixing unauthorized code changes made by unvetted external freelancers.',
    ],
    faqs: [
      {
        question: 'Do I have to subscribe to a monthly Care plan after launch?',
        answer: {
          KE: 'No. We believe in client ownership. You are free to host or maintain your website independently, or engage BazionWeb on-demand at KSh 3,500/hour.',
          GLOBAL: 'No. We believe in client ownership. You are free to host or maintain your website independently, or engage BazionWeb on-demand at $50/hour.',
        },
      },
      {
        question: 'What happens if our website goes down?',
        answer:
          'Our monitoring triggers an alert to on-call engineers within 60 seconds. On Care Business and Professional plans, incident response starts immediately according to our SLA.',
      },
    ],
  },

  'specialized-services': {
    slug: 'specialized-services',
    name: 'Specialized Engineering Services',
    tagline: 'Targeted high-value interventions: Migrations, Security Audits & Speed Passes.',
    heroSubtitle:
      'Have an existing website that is slow, hacked, or stuck with an unreliable agency? We provide rapid, surgical interventions to restore security, speed, and reliability.',
    badge: 'Family 05 — Specialized Services',
    whoItsFor: [
      {
        title: 'Organizations Stuck on Bad Hosting',
        profile: 'Suffering from constant downtime and slow cPanel servers',
        fit: {
          KE: 'Zero-Downtime Website Migration (From KSh 5,000).',
          GLOBAL: 'Zero-Downtime Website Migration (From $80).',
        },
      },
      {
        title: 'Companies with Security Concerns',
        profile: 'Need compliance penetration testing and malware cleanup',
        fit: {
          KE: 'Security Audit & Hardening (From KSh 15,000).',
          GLOBAL: 'Security Audit & Hardening (From $300).',
        },
      },
      {
        title: 'Sites Failing Google Core Web Vitals',
        profile: 'Losing SEO rankings due to slow load times and layout shift',
        fit: {
          KE: 'Core Web Vitals Speed Pass (From KSh 15,000).',
          GLOBAL: 'Core Web Vitals Speed Pass (From $300).',
        },
      },
    ],
    packages: [
      {
        id: 'migration',
        name: 'Website & Database Migration',
        priceKenya: 'From KSh 5,000',
        priceIntl: 'From $80',
        pagesOrScale: 'Full Site & DB',
        timeline: '24–48 hours',
        warranty: 'Zero Downtime',
        description: 'Seamless migration of your website, database, files, and DNS from your old provider.',
        deliverables: [
          'Pre-migration backup and compatibility audit',
          'Zero-downtime file and database transfer',
          'SSL certificate installation & HTTPS verification',
          'Cloudflare Edge DNS cutover & TTL management',
          'Post-migration smoke testing and link check',
        ],
        ctaHref: '/quote?service=migration',
      },
      {
        id: 'security-audit',
        name: 'Security Audit & Hardening',
        priceKenya: 'From KSh 15,000',
        priceIntl: 'From $300',
        badge: 'High Value',
        pagesOrScale: 'Full Platform Scan',
        timeline: '3–5 days',
        warranty: 'Remediation Plan',
        description: 'Comprehensive vulnerability audit, malware cleaning, and enterprise firewall setup.',
        deliverables: [
          'OWASP Top 10 vulnerability assessment',
          'Malware scanning & back-door removal',
          'Security HTTP headers injection (CSP, HSTS, X-Frame)',
          'Brute-force protection & rate limiting setup',
          'Written vulnerability report & remediation guide',
        ],
        ctaHref: '/contact?service=security-audit',
      },
      {
        id: 'speed-pass',
        name: 'Core Web Vitals Speed Pass',
        priceKenya: 'From KSh 15,000',
        priceIntl: 'From $300',
        badge: 'SEO Booster',
        pagesOrScale: 'Performance Pass',
        timeline: '3–5 days',
        warranty: 'Lighthouse 90+ Target',
        description: 'Code optimization, image compression, and edge caching to achieve green Google metrics.',
        deliverables: [
          'LCP, CLS, and INP diagnostic analysis',
          'Next-gen image optimization (WebP/AVIF conversions)',
          'JavaScript/CSS minification & unused code elimination',
          'Cloudflare edge caching & browser cache tuning',
          'Before-and-after Lighthouse performance audit',
        ],
        ctaHref: '/contact?service=performance-pass',
      },
      {
        id: 'emergency-recovery',
        name: 'Emergency Site Rescue',
        priceKenya: 'From KSh 20,000',
        priceIntl: 'From $400',
        badge: 'Urgent Response',
        pagesOrScale: 'Emergency Outage',
        timeline: 'Under 4 hours triage',
        warranty: 'Restoration Focus',
        description: 'Urgent assistance for crashed websites, blacklisted domains, or active security breaches.',
        deliverables: [
          'Immediate on-call systems engineer assignment',
          'Root-cause outage diagnosis and damage containment',
          'Malware quarantine and defacement cleanup',
          'Database repair and restoration from backup',
          'Domain blacklist removal submission (Google Safe Browsing)',
        ],
        ctaHref: '/contact?service=emergency-rescue',
      },
    ],
    keyFeatures: [
      {
        title: 'Zero-Downtime Guarantee',
        description: 'We stage transfers in isolated environments so your visitors experience no disruption.',
      },
      {
        title: 'Measurable Outcomes',
        description: 'Every speed pass and audit includes verified before-and-after benchmarks.',
      },
      {
        title: 'Root-Cause Resolution',
        description: 'We don\'t just reboot crashed servers; we identify and eliminate the underlying vulnerability.',
      },
      {
        title: 'Fast Turnaround',
        description: 'Standard migrations and security passes completed within 24 to 72 hours.',
      },
    ],
    modularAddons: [
      {
        name: 'Cloudflare WAF Custom Firewall Rule Set',
        priceKenya: 'KSh 10,000',
        priceIntl: '$200',
        description: 'Geo-blocking and threat mitigation.',
      },
      {
        name: 'Database Query Optimization',
        priceKenya: 'KSh 12,000',
        priceIntl: '$250',
        description: 'Index tuning for slow SQL queries.',
      },
    ],
    outOfScope: [
      'Rewriting completely broken proprietary third-party software from scratch.',
      'Paying ransomware or extortion fees to cyber-criminals.',
      'Legal representation for copyright or trademark disputes.',
    ],
    faqs: [
      {
        question: 'Will our website go down during a migration?',
        answer:
          'No. We copy all files and databases to the new server and test thoroughly before pointing the domain DNS, guaranteeing zero downtime for your visitors.',
      },
      {
        question: 'How fast can you respond if our website is hacked right now?',
        answer:
          'Submit an inquiry via our emergency contact or WhatsApp desk (+254 721 287 053). An engineer initiates triage within 15 to 30 minutes.',
      },
    ],
  },
};
