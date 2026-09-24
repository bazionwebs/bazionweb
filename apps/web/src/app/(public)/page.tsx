import Link from 'next/link';
import type { Metadata } from 'next';
import AudioTestimonial from '@/components/testimonials/AudioTestimonial';
import JsonLd from '@/components/seo/JsonLd';
import HomepagePricingPreview from '@/components/pricing/HomepagePricingPreview';
import {
  Globe, Shield, Wrench, Zap, LifeBuoy,
  Check, ArrowRight, Star, TrendingUp, Clock, Award,
  ChevronRight, Users, HeartHandshake, RotateCcw,
  Laptop, FileText, CheckCircle2
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Web Design, Custom Systems & E-Commerce Development | BazionWeb',
  description:
    'Custom Next.js websites, e-commerce stores with M-Pesa STK Push, bespoke portals, and proactive website care. Engineered for Kenya and international businesses.',
  alternates: { canonical: 'https://bazionweb.com/' },
};

// ─── Data ────────────────────────────────────────────────────────────────────

const services = [
  {
    icon: Globe,
    name: 'Website Design & Development',
    href: '/services#websites',
    desc: 'Custom, responsive websites built on modern Next.js with CMS integration, SEO-ready architecture, and defect warranties.',
    tags: ['Next.js', 'Tailwind', 'CMS Integration', 'SEO Ready'],
    accent: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Shield,
    name: 'E-Commerce Solutions',
    href: '/services#ecommerce',
    desc: 'Online stores with direct M-Pesa STK Push prompts, credit card gateways, stock tracking, and coupon engines.',
    tags: ['M-Pesa Daraja', 'Stripe / Cards', 'Inventory Sync', 'Conversion Ready'],
    accent: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Zap,
    name: 'Custom Digital Systems & Portals',
    href: '/services#custom-systems',
    desc: 'Bespoke client portals, booking systems, LMS platforms, and CRMs engineered around your internal workflows.',
    tags: ['Client Portals', 'LMS & CRMs', 'Custom APIs', 'Discovery Spec'],
    accent: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: Wrench,
    name: 'Website Care & Maintenance',
    href: '/services#care',
    desc: 'Weekly updates, security patches, SEO health checks, and included dedicated engineering support hours.',
    tags: ['CMS Updates', 'Core Web Vitals', 'Monthly Reports', 'Support Hours'],
    accent: 'bg-purple-50 text-purple-600',
  },
  {
    icon: LifeBuoy,
    name: 'Technical Support & Incident Response',
    href: '/services/support',
    desc: 'Real systems engineers, proactive monitoring, and urgent response for business-critical digital platforms.',
    tags: ['Direct Escalation', 'Fast Response', 'Direct Hotline', 'Security Audits'],
    accent: 'bg-amber-50 text-amber-600',
  },
];

const testimonials: {
  name: string; role: string; quote: string; rating: number;
  audio?: { src: string; transcript: string };
}[] = [
  {
    name: 'Sarah K.',
    role: 'Director, HealthCare NGO',
    quote: 'BazionWeb took complete ownership of our website. No more SSL errors, no more slow pages — and when we needed help, someone actually answered.',
    rating: 5,
  },
  {
    name: 'Michael O.',
    role: 'CEO, Professional Services Firm',
    quote: 'I used to juggle multiple vendors for development, maintenance, and support. Now it\'s one invoice, one team. I haven\'t thought about my website in months — that\'s exactly what I wanted.',
    rating: 5,
  },
  {
    name: 'Amara N.',
    role: 'Founder, Tech Startup',
    quote: 'Got our site live in two weeks. Professional design, fast loading, and Lighthouse score above 95. Our investors were impressed on day one.',
    rating: 5,
  },
];

const painPoints = [
  {
    icon: Users,
    pain: 'Managing 3–7 vendors',
    solution: 'One provider, one contract, one invoice',
  },
  {
    icon: TrendingUp,
    pain: 'Hidden fees & scope creep',
    solution: 'Transparent, all-inclusive pricing',
  },
  {
    icon: Clock,
    pain: 'No real technical support',
    solution: 'Dedicated engineers, not bots',
  },
  {
    icon: Award,
    pain: 'Security ignored until crisis',
    solution: 'Proactive WAF, malware, SSL rotation',
  },
];

const reasons = [
  {
    num: '01',
    title: 'Single Point of Accountability',
    desc: 'Development, security patches, performance optimization, and ongoing maintenance from one dedicated team. No more finger-pointing between separate contractors, web developers, and domain registrars.',
    icon: Users,
    highlight: 'One contract, one invoice',
  },
  {
    num: '02',
    title: 'Sub-15 Minute P1 Emergency Response',
    desc: 'When an unexpected outage or critical issue occurs, real systems engineers triage and resolve it rapidly. No chatbots, ticket black holes, or days of waiting.',
    icon: Clock,
    highlight: 'Rapid engineer escalation',
  },
  {
    num: '03',
    title: '100% Client Asset Ownership',
    desc: 'You retain complete, unencumbered ownership of your domain names, code repositories, design assets, and content. Zero proprietary platform lock-in.',
    icon: Award,
    highlight: 'Your assets stay yours',
  },
  {
    num: '04',
    title: 'No Lock-in Contracts & 30-Day Guarantee',
    desc: 'All plans operate on simple, predictable monthly subscriptions. You can cancel with 30 days notice anytime, backed by a 30-day money-back guarantee for new clients.',
    icon: HeartHandshake,
    highlight: 'Zero risk to start',
  },
  {
    num: '05',
    title: 'Proactive Security & WAF Protection',
    desc: 'Every client website is protected by an enterprise Web Application Firewall, automated malware scanning, SSL management, and proactive vulnerability patching.',
    icon: Shield,
    highlight: 'Threats stopped before impact',
  },
  {
    num: '06',
    title: 'Lighthouse 95+ Performance Target',
    desc: 'Built on modern Next.js 14 and routed through global edge CDNs. We optimize for Core Web Vitals (LCP, CLS, INP) to maximize Google search rank and conversion.',
    icon: Zap,
    highlight: 'Blazing fast load times',
  },
  {
    num: '07',
    title: 'Automated Daily & Verified Backups',
    desc: 'Your database and assets are automatically encrypted and snapshotted offsite daily, with regular restore drills to ensure instant disaster recovery.',
    icon: RotateCcw,
    highlight: 'Disaster recovery ready',
  },
  {
    num: '08',
    title: 'Private Staging Environments',
    desc: 'Never test in production. Every update, design refinement, and new feature is deployed to a private staging URL for your explicit review and sign-off.',
    icon: Laptop,
    highlight: 'Approve before launch',
  },
  {
    num: '09',
    title: 'Plain-Language Monthly Reports',
    desc: 'Receive transparent monthly summaries detailing updates completed, security scans passed, uptime records, and site speed benchmarks in plain business English.',
    icon: FileText,
    highlight: 'Transparent accountability',
  },
  {
    num: '10',
    title: 'Unified Client Portal & Helpdesk',
    desc: 'Log in anytime to submit tickets, track milestone deliveries, view invoices, and monitor system health and uptime stats in real time.',
    icon: CheckCircle2,
    highlight: 'Real-time visibility',
  },
  {
    num: '12',
    title: 'Predictable Flat Pricing — Zero Hidden Fees',
    desc: 'No sudden invoices for software updates, PHP upgrades, SSL renewals, or unexpected maintenance spikes. What you see is what you pay.',
    icon: TrendingUp,
    highlight: 'No budget surprises',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': ['Organization', 'ProfessionalService'],
              '@id': 'https://bazionweb.com/#organization',
              name: 'BazionWeb',
              alternateName: 'Bazion Web Solutions',
              url: 'https://bazionweb.com/',
              logo: 'https://bazionweb.com/brand/logo.png',
              image: 'https://bazionweb.com/og-image.png',
              description:
                'Professional web design, custom Next.js web application development, e-commerce with M-Pesa STK Push integration, bespoke portals, and ongoing website care for businesses in Kenya and worldwide.',
              email: 'hello@bazionweb.com',
              telephone: '+254721287053',
              priceRange: '$$',
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'Nairobi',
                addressCountry: 'KE',
              },
              areaServed: ['Kenya', 'Worldwide'],
              sameAs: [
                'https://twitter.com/bazionweb',
                'https://linkedin.com/company/bazionweb',
                'https://github.com/bazionweb',
              ],
              contactPoint: {
                '@type': 'ContactPoint',
                email: 'hello@bazionweb.com',
                telephone: '+254721287053',
                contactType: 'customer service',
                availableLanguage: ['English', 'Swahili'],
              },
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'Digital Engineering Services',
                itemListElement: [
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: 'Website Design & Development',
                      description: 'Custom responsive websites built on modern Next.js with CMS integration and technical SEO.',
                    },
                    priceSpecification: [
                      { '@type': 'PriceSpecification', price: '25000', priceCurrency: 'KES', description: 'Kenya Market' },
                      { '@type': 'PriceSpecification', price: '495', priceCurrency: 'USD', description: 'International' },
                    ],
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: 'E-Commerce Solutions',
                      description: 'Online stores with direct M-Pesa STK Push mobile checkout and global credit card gateways.',
                    },
                    priceSpecification: [
                      { '@type': 'PriceSpecification', price: '90000', priceCurrency: 'KES', description: 'Kenya Market' },
                      { '@type': 'PriceSpecification', price: '1500', priceCurrency: 'USD', description: 'International' },
                    ],
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: 'Custom Digital Systems & Portals',
                      description: 'Bespoke client portals, booking engines, LMS platforms, and custom software systems.',
                    },
                    priceSpecification: [
                      { '@type': 'PriceSpecification', price: '150000', priceCurrency: 'KES', description: 'Kenya Market' },
                      { '@type': 'PriceSpecification', price: '2500', priceCurrency: 'USD', description: 'International' },
                    ],
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: 'Website Care & Ongoing Maintenance',
                      description: 'Monthly CMS updates, security patches, automated backups, and dedicated engineering support.',
                    },
                    priceSpecification: [
                      { '@type': 'PriceSpecification', price: '5000', priceCurrency: 'KES', description: 'Kenya Market' },
                      { '@type': 'PriceSpecification', price: '49', priceCurrency: 'USD', description: 'International' },
                    ],
                  },
                ],
              },
            },
            {
              '@type': 'WebSite',
              '@id': 'https://bazionweb.com/#website',
              url: 'https://bazionweb.com/',
              name: 'BazionWeb',
              publisher: { '@id': 'https://bazionweb.com/#organization' },
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://bazionweb.com/blog?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            },
          ],
        }}
      />
      {/* ── Hero ── */}
      <section className="relative min-h-screen bg-[#0F172A] flex items-center overflow-hidden">
        {/* Ambient gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#2563EB]/10 blur-[120px]" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#14B8A6]/10 blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#2563EB]/5 blur-[140px]" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="container-default relative z-10 py-32 md:py-40">
          <div className="max-w-4xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-8">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-xs font-semibold text-slate-300 tracking-widest uppercase">Now Serving Clients Worldwide</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-[1.05] tracking-tight">
              Your website,{' '}
              <span className="bg-gradient-to-r from-[#2563EB] to-[#14B8A6] bg-clip-text text-transparent">
                completely managed.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
              Development, bespoke systems, ongoing maintenance, and dedicated engineering support — one trusted partner, one clear invoice.
              Stop worrying about technical headaches. Start growing your business.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Link href="/contact" className="btn-primary px-8 py-4 text-base">
                Get Free Quote
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/pricing" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-white/15 text-white font-semibold text-base hover:bg-white/5 transition-all duration-200">
                View Pricing
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Micro trust signals */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
              {['No setup fees', '30-day money-back', 'Cancel anytime', 'Dedicated support team'].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-white" />
        </div>
      </section>

      {/* ── Pain → Solution ── */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="eyebrow">The Problem</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
              Managing a website shouldn&apos;t be this hard
            </h2>
            <p className="text-slate-500 text-lg">
              Most businesses deal with the same frustrations. We&apos;ve built BazionWeb to solve every one of them.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {painPoints.map((p, i) => (
              <div key={i} className="card p-6">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                  <p.icon className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-sm font-semibold text-red-500 mb-2 line-through opacity-70">{p.pain}</div>
                <div className="text-sm font-medium text-[#0F172A]">→ {p.solution}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section className="section bg-white">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="eyebrow">What We Do</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
              Everything your website needs, under one roof
            </h2>
            <p className="text-slate-500 text-lg">
              Complete digital solutions, one provider. From initial architecture to continuous optimization — we handle it all.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(s => (
              <Link
                key={s.name}
                href={s.href}
                className="card-interactive p-6 group"
              >
                <div className={`w-12 h-12 rounded-xl ${s.accent} flex items-center justify-center mb-5`}>
                  <s.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] mb-2 group-hover:text-[#2563EB] transition-colors">{s.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">{s.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.tags.map(t => (
                    <span key={t} className="badge-slate text-xs">{t}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/services" className="btn-secondary">
              Explore All Services
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 12 Reasons to Choose BazionWeb ── */}
      <section className="section bg-[#0F172A] text-white relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[#2563EB]/10 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#14B8A6]/10 blur-[140px] pointer-events-none" />

        <div className="container-default relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
              Why Choose BazionWeb
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              12 reasons growing businesses trust us with their website
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              From guaranteed SLAs to complete asset ownership, here is why companies switch from
              scattered freelancers and basic hosting providers to our fully managed model.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {reasons.map(r => (
              <div
                key={r.num}
                className="bg-white/5 border border-white/10 hover:border-blue-500/40 rounded-2xl p-7 transition-all duration-300 flex flex-col group hover:-translate-y-1 hover:shadow-card-xl backdrop-blur-sm"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-mono font-bold tracking-widest text-[#14B8A6] bg-teal-500/10 px-2.5 py-1 rounded-md border border-teal-500/20">
                    {r.num}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-[#2563EB]/20 border border-white/10 flex items-center justify-center transition-colors">
                    <r.icon className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-2.5 group-hover:text-[#60A5FA] transition-colors">
                  {r.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1">
                  {r.desc}
                </p>

                <div className="pt-4 border-t border-white/10 flex items-center gap-2 text-xs font-medium text-slate-400">
                  <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                  <span>{r.highlight}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Process & Pricing cross-links */}
          <div className="card bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
            <div>
              <h4 className="text-lg font-bold text-white mb-1">
                Curious how our six delivery phases work?
              </h4>
              <p className="text-sm text-slate-400">
                From free assessment to launch and ongoing management, see our exact step-by-step milestones.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/process" className="btn-primary text-sm px-6 py-3">
                See Our Process
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Preview ── */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="eyebrow">Pricing Architecture</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
              Transparent, market-tailored packages
            </h2>
            <p className="text-slate-500 text-base md:text-lg">
              Accessible professional development in Kenya and dedicated engineering partnerships worldwide.
            </p>
          </div>

          <HomepagePricingPreview />
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="section bg-[#0F172A]">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
              What Clients Say
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Trusted by growing businesses worldwide
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                  ))}
                </div>
                <blockquote className="text-slate-300 text-sm leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div>
                  <div className="font-semibold text-white text-sm">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.role}</div>
                </div>
                <AudioTestimonial src={t.audio?.src} transcript={t.audio?.transcript} name={t.name} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section bg-white">
        <div className="container-default">
          <div className="max-w-3xl mx-auto text-center">
            <span className="eyebrow">Ready to Start?</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0F172A] mb-6">
              Get a free website assessment
            </h2>
            <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto">
              We&apos;ll review your current setup and give you a clear plan with honest recommendations — no commitment required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact" className="btn-primary px-8 py-4 text-base">
                Request Free Assessment
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/pricing" className="btn-secondary px-8 py-4 text-base">
                View Pricing First
              </Link>
            </div>
            <div className="flex items-center justify-center gap-2 mt-8">
              <HeartHandshake className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-sm text-slate-400">Response within 24 hours, guaranteed</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
