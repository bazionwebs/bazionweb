import Link from 'next/link';
import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';
import HomepagePricingPreview from '@/components/pricing/HomepagePricingPreview';
import {
  Globe,
  ShoppingCart,
  Cpu,
  Server,
  Shield,
  ArrowRight,
  TrendingUp,
  Clock,
  Award,
  HeartHandshake,
  Building2,
  Church,
  GraduationCap,
  Rocket,
  Briefcase,
  Layers,
  Sparkles,
  Zap,
  Lock,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Build. Launch. Manage. Grow. | BazionWeb Digital Engineering',
  description:
    'Digital platforms, websites, and custom systems engineered for businesses, churches, schools, NGOs, and startups. Transparent pricing, 100% client asset ownership, and SLA care.',
  alternates: { canonical: 'https://bazionweb.com/' },
};

// ─── Service Families ────────────────────────────────────────────────────────
const serviceFamilies = [
  {
    num: '01',
    name: 'Websites',
    tagline: 'Standard & Corporate Web Presences',
    desc: 'Custom, responsive websites built on modern Next.js with CMS integration, SEO readiness, and verified defect warranties.',
    href: '/services#websites',
    icon: Globe,
    accent: 'bg-blue-50 text-blue-600 border-blue-200/60',
    tags: ['Launch (KSh 25k)', 'Business (KSh 50k)', 'Pro (KSh 85k)', 'Corporate'],
  },
  {
    num: '02',
    name: 'E-Commerce',
    tagline: 'High-Converting Online Stores',
    desc: 'Stores equipped with automated M-Pesa STK Push prompts, credit card gateways, inventory sync, and tiered shipping calculations.',
    href: '/services#ecommerce',
    icon: ShoppingCart,
    accent: 'bg-emerald-50 text-emerald-600 border-emerald-200/60',
    tags: ['M-Pesa Daraja 2.0', 'Stripe / Cards', 'Stock Alerts', 'PDF Invoicing'],
  },
  {
    num: '03',
    name: 'Custom Digital Systems',
    tagline: 'Web Apps, Portals & Management Software',
    desc: 'Client portals, booking systems, church platforms, and school management systems engineered around exact workflows.',
    href: '/services#custom-systems',
    icon: Cpu,
    accent: 'bg-indigo-50 text-indigo-600 border-indigo-200/60',
    tags: ['Client Portals', 'ChMS Giving', 'School SIS/UMS', 'Custom CRMs'],
  },
  {
    num: '04',
    name: 'Managed Technology',
    tagline: 'Managed Cloud Hosting & Care Retainers',
    desc: 'Automated off-site backups, 24/7 uptime monitoring, firewall security, performance tuning, and included engineering support hours.',
    href: '/services#care',
    icon: Server,
    accent: 'bg-purple-50 text-purple-600 border-purple-200/60',
    tags: ['Host Essential', 'Cloud Containers', 'Monthly Care Plans', 'P1 SLA'],
  },
  {
    num: '05',
    name: 'Specialized Services',
    tagline: 'Targeted High-Impact Interventions',
    desc: 'Zero-downtime platform migrations, security penetration audits, malware recovery, and Core Web Vitals speed optimizations.',
    href: '/services#specialized',
    icon: Shield,
    accent: 'bg-amber-50 text-amber-600 border-amber-200/60',
    tags: ['Site Migrations', 'Security Hardening', 'Speed Pass', 'Emergency Fix'],
  },
];

// ─── Industry Solutions ──────────────────────────────────────────────────────
const solutionSectors = [
  {
    slug: 'smes',
    name: 'SMEs & Growing Businesses',
    desc: 'Turn stagnant web pages into automated lead-generating assets with fast mobile speeds and high Google search visibility.',
    icon: Building2,
    badge: 'High Conversion',
  },
  {
    slug: 'churches',
    name: 'Churches & Ministries',
    desc: 'Unify member communication, automate M-Pesa tithes & offerings, and broadcast sermon audio/video archives.',
    icon: Church,
    badge: 'Giving & Media',
  },
  {
    slug: 'education',
    name: 'Schools & Education',
    desc: 'Student admission portals, fee accounting with M-Pesa reconciliation, and automated exam grade book reports.',
    icon: GraduationCap,
    badge: 'SIS & Portals',
  },
  {
    slug: 'ngos',
    name: 'NGOs & Non-Profits',
    desc: 'Prove donor transparency, satisfy international grant audits, and publish structured field research publications.',
    icon: HeartHandshake,
    badge: 'Impact & Grants',
  },
  {
    slug: 'startups',
    name: 'Startups & Product MVPs',
    desc: 'Launch your Minimum Viable Product in 4 to 8 weeks with scalable Next.js 14, NestJS, and PostgreSQL architectures.',
    icon: Rocket,
    badge: 'Fast MVP Sprint',
  },
  {
    slug: 'professional-services',
    name: 'Professional Services',
    desc: 'Establish prestigious digital authority for law firms, medical clinics, and management consultancies.',
    icon: Briefcase,
    badge: 'Authority & Intake',
  },
];

// ─── Differentiators ─────────────────────────────────────────────────────────
const differentiators = [
  {
    title: '100% Client Asset Ownership',
    desc: 'You own your domain name, frontend and backend source code, database records, and brand media. BazionWeb never holds your assets hostage.',
    icon: Award,
  },
  {
    title: 'Transparent Fixed-Scope Pricing',
    desc: 'Every project receives an itemized quotation with concrete deliverables, revision boundaries, and milestone payment schedules. No surprise invoices.',
    icon: TrendingUp,
  },
  {
    title: 'Modern Senior Architecture',
    desc: 'Engineered with Next.js 14, TypeScript, PostgreSQL, and Cloudflare Edge caching for ultra-fast, maintainable, and scalable digital platforms.',
    icon: Layers,
  },
  {
    title: 'Security-First Engineering',
    desc: 'Enterprise Web Application Firewall (WAF), HTTPS TLS 1.3, rate limiting, and automated daily offsite backup snapshots from day one.',
    icon: Lock,
  },
  {
    title: 'Lighthouse 95+ Speed Performance',
    desc: 'Optimized for Google Core Web Vitals (LCP < 1.8s, CLS < 0.02) to maximize organic search ranking and mobile visitor conversion rates.',
    icon: Zap,
  },
  {
    title: 'Post-Launch Care & SLA Support',
    desc: 'We do not disappear after launch. Every project includes a 14 to 90-day defect warranty plus optional proactive monthly maintenance retainers.',
    icon: Clock,
  },
];

// ─── The 6-Stage Process ─────────────────────────────────────────────────────
const processStages = [
  {
    step: '01',
    name: 'Discover',
    desc: 'We analyze your organizational goals, target users, workflows, and technical constraints.',
    exitCriteria: 'Phase complete when technical specification & quotation are approved.',
  },
  {
    step: '02',
    name: 'Plan',
    desc: 'Creation of user flows, clickable UI wireframes, database entity models, and design tokens.',
    exitCriteria: 'Phase complete when client signs off on design prototypes & sitemap.',
  },
  {
    step: '03',
    name: 'Build',
    desc: 'High-speed engineering of frontend components, CMS integration, APIs, and database schemas.',
    exitCriteria: 'Phase complete when fully functional code is deployed to private staging.',
  },
  {
    step: '04',
    name: 'Test',
    desc: 'Cross-browser testing, mobile responsive checks, security vulnerability scans, and client UAT.',
    exitCriteria: 'Phase complete when all QA tests pass and client grants final launch sign-off.',
  },
  {
    step: '05',
    name: 'Launch',
    desc: 'Zero-downtime production deployment, DNS cutover, SSL issuance, and admin walkthrough training.',
    exitCriteria: 'Phase complete when production URL is live and Google Search Console is verified.',
  },
  {
    step: '06',
    name: 'Manage',
    desc: 'Proactive 24/7 uptime monitoring, daily backups, security patches, and monthly performance tuning.',
    exitCriteria: 'Continuous peace of mind backed by dedicated SLA response times.',
  },
];

// ─── Case Studies ────────────────────────────────────────────────────────────
const caseStudies = [
  {
    client: 'Global Health Mission',
    sector: 'Non-Profit Healthcare',
    problem: 'Slow 6-second load times and broken donation gateway losing international grants.',
    solution: 'Rebuilt on Next.js 14 with multi-currency donation rails and donor report archive.',
    tech: 'Next.js 14 · Tailwind · Cloudflare · Stripe',
    result: '+185% increase in online donations; 1.1s Largest Contentful Paint (LCP).',
  },
  {
    client: 'Baraka Commercial Distributors',
    sector: 'SME Wholesale Retail',
    problem: 'Manual WhatsApp order intake creating inventory bottlenecks and lost stock records.',
    solution: 'Engineered an automated commerce portal with M-Pesa STK Push and live stock sync.',
    tech: 'Next.js · NestJS · PostgreSQL · Daraja API',
    result: 'Reduced order processing time by 75% with zero manual billing reconciliation errors.',
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: 'BazionWeb',
          url: 'https://bazionweb.com/',
          description:
            'Digital engineering platform: websites, e-commerce, custom software, and managed care plans engineered for businesses and institutions in Kenya and worldwide.',
          telephone: '+254721287053',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Nairobi',
            addressCountry: 'KE',
          },
          priceRange: '$$',
        }}
      />

      {/* ─── SECTION 1: HERO ─── */}
      <section className="relative bg-[#0F172A] text-white pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="container-default relative z-10 text-center max-w-4xl mx-auto">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-950/70 border border-teal-800/40 text-xs font-bold text-[#14B8A6] uppercase tracking-widest mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Digital Engineering & Platform Operations</span>
          </div>

          {/* H1 Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight mb-6 leading-[1.08]">
            Build. Launch. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-teal-300 to-indigo-300">
              Manage. Grow.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Digital platforms, websites, and systems engineered for your organization. Transparent pricing, verified 100% asset ownership, and long-term SLA care.
          </p>

          {/* CTA Cluster */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/quote"
              className="btn-primary w-full sm:w-auto text-sm px-8 py-4 shadow-lg shadow-teal-500/20 text-center"
            >
              Get a Free Assessment
            </Link>
            <Link
              href="#services"
              className="w-full sm:w-auto px-7 py-4 rounded-xl border border-slate-700 hover:border-slate-500 text-white text-sm font-semibold transition-colors text-center"
            >
              Explore Services
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="flex items-center gap-3">
              <Award className="w-6 h-6 text-[#14B8A6] shrink-0" />
              <div>
                <div className="text-sm font-bold text-white">100% Client Asset Ownership</div>
                <div className="text-xs text-slate-400">Domains, code & databases belong to you</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-[#14B8A6] shrink-0" />
              <div>
                <div className="text-sm font-bold text-white">Sub-2s Mobile Performance</div>
                <div className="text-xs text-slate-400">Engineered for Google Core Web Vitals</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-[#14B8A6] shrink-0" />
              <div>
                <div className="text-sm font-bold text-white">Contractual SLA Support</div>
                <div className="text-xs text-slate-400">We don&apos;t disappear after launch</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: WHAT BAZIONWEB DOES (THE TRIAD) ─── */}
      <section className="py-20 bg-white border-b border-slate-200/80">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              The Operational Model
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-3">
              How BazionWeb Powers Your Digital Journey
            </h2>
            <p className="text-sm md:text-base text-slate-600">
              We structure every engagement into three clear phases to eliminate friction, secure engineering margins, and maximize long-term business impact.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: BUILD */}
            <div className="bg-[#F8FAFC] rounded-2xl p-8 border border-slate-200/80 hover:shadow-lg transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-100/70 text-[#0D9488] flex items-center justify-center font-black text-lg mb-6">
                  01
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 block">
                  One-Time Project
                </span>
                <h3 className="text-2xl font-black text-[#0F172A] mb-3">BUILD</h3>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-6">
                  Websites, e-commerce stores, custom portals, and web software designed from scratch. Fast, responsive, conversion-focused, and 100% owned by your organization.
                </p>
              </div>
              <ul className="space-y-2 pt-4 border-t border-slate-200/60 text-xs text-slate-700">
                <li className="flex items-center gap-2">✓ Launch, Business & Pro Websites</li>
                <li className="flex items-center gap-2">✓ M-Pesa & Card E-Commerce Stores</li>
                <li className="flex items-center gap-2">✓ Bespoke Portals & CRMs</li>
              </ul>
            </div>

            {/* Card 2: MANAGE */}
            <div className="bg-[#0F172A] text-white rounded-2xl p-8 border border-slate-800 shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-bl-full pointer-events-none" />
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-[#14B8A6] flex items-center justify-center font-black text-lg mb-6 border border-teal-500/30">
                  02
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-1 block">
                  Continuous Retainer
                </span>
                <h3 className="text-2xl font-black text-white mb-3">MANAGE</h3>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-6">
                  Websites are living software. We provide managed cloud hosting, automated daily backups, enterprise firewall defense, software updates, and guaranteed SLA response times.
                </p>
              </div>
              <ul className="space-y-2 pt-4 border-t border-slate-800 text-xs text-slate-300">
                <li className="flex items-center gap-2">✓ Managed High-Speed Cloud Hosting</li>
                <li className="flex items-center gap-2">✓ Daily Off-Site Encrypted Backups</li>
                <li className="flex items-center gap-2">✓ Proactive Security & Monthly Health Checks</li>
              </ul>
            </div>

            {/* Card 3: GROW */}
            <div className="bg-[#F8FAFC] rounded-2xl p-8 border border-slate-200/80 hover:shadow-lg transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center font-black text-lg mb-6">
                  03
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 block">
                  Continuous Value
                </span>
                <h3 className="text-2xl font-black text-[#0F172A] mb-3">GROW</h3>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-6">
                  Expand your market reach and conversion efficiency through technical SEO foundation, feature additions, third-party API integrations, and ongoing analytics optimization.
                </p>
              </div>
              <ul className="space-y-2 pt-4 border-t border-slate-200/60 text-xs text-slate-700">
                <li className="flex items-center gap-2">✓ Technical SEO & Schema Authority</li>
                <li className="flex items-center gap-2">✓ Conversion Rate Optimization (CRO)</li>
                <li className="flex items-center gap-2">✓ Third-Party API & Payment Pipelines</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: THE 5 SERVICE FAMILIES ─── */}
      <section id="services" className="py-20 bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Core Capabilities
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-3">
              The Five Service Families
            </h2>
            <p className="text-sm md:text-base text-slate-600">
              Clear deliverable boundaries, transparent prices, and zero guesswork.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceFamilies.map(fam => {
              const Icon = fam.icon;
              return (
                <div
                  key={fam.num}
                  className="bg-white rounded-2xl p-7 border border-slate-200/80 hover:shadow-xl hover:border-[#0D9488]/40 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center group-hover:bg-[#0D9488] group-hover:text-white transition-colors">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-400">FAMILY {fam.num}</span>
                    </div>

                    <h3 className="text-xl font-bold text-[#0F172A] mb-1 group-hover:text-[#0D9488] transition-colors">
                      {fam.name}
                    </h3>
                    <div className="text-xs text-[#0D9488] font-semibold mb-3">{fam.tagline}</div>
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-6">
                      {fam.desc}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {fam.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <Link
                      href={fam.href}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D9488] group-hover:text-[#0f766e] transition-colors"
                    >
                      <span>Explore {fam.name} Specifications</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── SECTION 4: SOLUTIONS BY SECTOR ─── */}
      <section className="py-20 bg-white border-y border-slate-200/80">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Organizational Verticals
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-3">
              Engineered Solutions for Your Sector
            </h2>
            <p className="text-sm md:text-base text-slate-600">
              Every vertical addresses domain-specific pain points with proven operational workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {solutionSectors.map(sector => {
              const Icon = sector.icon;
              return (
                <Link
                  key={sector.slug}
                  href={`/solutions/${sector.slug}`}
                  className="bg-[#F8FAFC] rounded-2xl p-7 border border-slate-200/80 hover:border-[#0D9488]/40 hover:bg-teal-50/20 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-teal-100/70 text-[#0D9488] flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                        {sector.badge}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[#0F172A] mb-2 group-hover:text-[#0D9488] transition-colors">
                      {sector.name}
                    </h3>
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-4">
                      {sector.desc}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-1 text-xs font-bold text-[#0D9488] pt-2">
                    <span>View Solution Stack</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── SECTION 5: WHY BAZIONWEB (DIFFERENTIATORS) ─── */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              The BazionWeb Advantage
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-3">
              Why Organizations Choose BazionWeb
            </h2>
            <p className="text-sm md:text-base text-slate-600">
              We eliminate the common pitfalls of freelancers and traditional agencies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {differentiators.map((diff, idx) => {
              const Icon = diff.icon;
              return (
                <div key={idx} className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#0F172A] mb-2">{diff.title}</h3>
                  <p className="text-xs md:text-sm text-slate-600 leading-relaxed">{diff.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── SECTION 6: HOW IT WORKS (THE 6-STAGE PROCESS) ─── */}
      <section className="py-20 bg-white border-y border-slate-200/80">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Engineering Rigor
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-3">
              The 6-Stage Delivery Process
            </h2>
            <p className="text-sm md:text-base text-slate-600">
              Clear exit criteria at every phase ensure you know exactly what is happening before moving forward.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {processStages.map(stage => (
              <div
                key={stage.step}
                className="bg-[#F8FAFC] rounded-2xl p-7 border border-slate-200/80 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-black text-[#0D9488] mb-2">PHASE {stage.step}</div>
                  <h3 className="text-xl font-bold text-[#0F172A] mb-2">{stage.name}</h3>
                  <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-6">
                    {stage.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/60 bg-teal-50/50 -mx-7 -mb-7 p-5 rounded-b-2xl">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800 mb-1">
                    Exit Criteria:
                  </div>
                  <div className="text-xs text-teal-900 font-medium">{stage.exitCriteria}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/process" className="inline-flex items-center gap-2 text-sm font-bold text-[#0D9488] hover:text-[#0f766e]">
              <span>Read the Full Operational Process & SLA Manual</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SECTION 7: PROVEN RESULTS & CASE STUDIES ─── */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="container-default max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Proven Impact
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-3">
              Problem → Solution → Result
            </h2>
            <p className="text-sm md:text-base text-slate-600">
              We measure our engineering by real commercial and operational outcomes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {caseStudies.map((cs, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0D9488]">
                      {cs.sector}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">{cs.client}</span>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <div className="text-[11px] font-bold uppercase text-rose-500 mb-0.5">Problem:</div>
                      <p className="text-xs text-slate-600">{cs.problem}</p>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-400 mb-0.5">Solution:</div>
                      <p className="text-xs text-slate-700 font-medium">{cs.solution}</p>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      Tech: <span className="text-slate-600">{cs.tech}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 bg-teal-50/60 -mx-8 -mb-8 p-6 rounded-b-2xl">
                  <div className="text-[11px] font-bold uppercase text-teal-800 mb-1">Measured Result:</div>
                  <div className="text-xs sm:text-sm font-bold text-teal-900">{cs.result}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── SECTION 8: CARE PLANS & PRICING PREVIEW ─── */}
      <section className="py-20 bg-white border-t border-slate-200/80">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              We Don&apos;t Disappear After Launch
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-3">
              Proactive Care & Transparent Pricing
            </h2>
            <p className="text-sm md:text-base text-slate-600">
              The 7 Pillars of Care: Monitor · Secure · Backup · Update · Optimize · Support · Report.
            </p>
          </div>

          {/* Pricing Preview Component */}
          <HomepagePricingPreview />

          <div className="text-center mt-12">
            <Link href="/pricing" className="btn-secondary text-xs px-6 py-3">
              View Complete 2026 Commercial Price Book →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SECTION 9: MASTER CONVERSION CTA ─── */}
      <section className="bg-gradient-to-br from-[#0F172A] via-slate-900 to-[#0F172A] py-20 text-white relative overflow-hidden">
        <div className="container-default relative z-10 text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6] mb-3 block">
            Ready to Upgrade Your Digital Operations?
          </span>
          <h2 className="text-3xl sm:text-5xl font-black mb-6 tracking-tight">
            Let&apos;s Build Your Digital Platform
          </h2>
          <p className="text-slate-300 text-sm sm:text-base mb-10 max-w-xl mx-auto leading-relaxed">
            Get an instant transparent estimate with our 2-minute Digital Project Configurator, or speak directly with a solutions engineer.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/quote"
              className="btn-primary w-full sm:w-auto text-sm px-8 py-4 shadow-xl shadow-teal-500/25"
            >
              Start Free Assessment (2 Mins)
            </Link>
            <a
              href="https://wa.me/254721287053?text=Hello%20BazionWeb%2C%20I%20would%20like%20to%20discuss%20a%20digital%20platform%20project."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-7 py-4 rounded-xl border border-slate-700 hover:border-slate-500 text-white text-sm font-semibold transition-colors"
            >
              Direct WhatsApp Desk (+254 721 287 053)
            </a>
          </div>

          <div className="text-xs text-slate-400">
            Backed by our 100% Client Asset Ownership Guarantee and 30-day quotation validity.
          </div>
        </div>
      </section>
    </>
  );
}
