import Link from 'next/link';
import {
  Globe,
  ShoppingCart,
  Cpu,
  Wrench,
  ArrowRight,
  Check,
  Building2,
  GraduationCap,
  HeartHandshake,
  Church,
  Rocket,
} from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import ClientJourneyProgress from '@/components/navigation/ClientJourneyProgress';
import { getServerMarket } from '@/lib/geoDetection';

export const metadata: Metadata = {
  title: 'Digital Engineering Services — Websites, E-Commerce & Systems',
  description:
    'Complete website & system lifecycle: custom development, e-commerce, custom web applications, security, and ongoing care plans.',
  alternates: { canonical: 'https://bazionweb.com/services' },
};

interface ProductFamily {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  tagline: string;
  desc: string;
  startingPrice: { KE: string; GLOBAL: string; [code: string]: string | undefined };
  deliverables: string[];
  accent: string;
  bg: string;
  textColor: string;
  pricingHref: string;
}

const productFamilies: ProductFamily[] = [
  {
    id: 'websites',
    icon: Globe,
    name: 'Website Design & Development',
    tagline: 'Custom-built. Launch-ready. Engineered for conversion.',
    desc: 'We design and engineer responsive, high-performance websites on modern Next.js. Fast-loading, CMS-integrated, and built to convert visitors into loyal clients.',
    startingPrice: {
      KE: 'From KSh 25,000',
      GLOBAL: 'From $450',
    },
    deliverables: [
      'Mobile-first responsive UX/UI architecture',
      'Full CMS content management (self-manage text & images)',
      'Blog / news / announcements publishing engine',
      'Technical SEO, Schema.org & Google Search Console setup',
      'Enterprise security headers & automated SSL encryption',
      'Included 14 to 90 days post-launch defect warranty',
    ],
    accent: '#2563EB',
    bg: 'bg-blue-50',
    textColor: 'text-[#2563EB]',
    pricingHref: '/pricing?tab=websites',
  },
  {
    id: 'ecommerce',
    icon: ShoppingCart,
    name: 'E-Commerce Solutions',
    tagline: 'High-converting online stores with local & global payment rails.',
    desc: 'From boutique retail shops to high-volume multi-category catalogues. Seamless M-Pesa STK Push prompts, credit card gateways, stock tracking, and automated customer notifications.',
    startingPrice: {
      KE: 'From KSh 90,000',
      GLOBAL: 'From $890',
    },
    deliverables: [
      'Product catalogues with multi-attribute variants',
      'Direct M-Pesa Daraja STK Push mobile checkout',
      'Stripe, PayPal, and credit card processing',
      'Inventory management & automated stock alerts',
      'Discount coupon engines & dynamic shipping zones',
      'Google Analytics 4 e-commerce conversion tracking',
    ],
    accent: '#14B8A6',
    bg: 'bg-teal-50',
    textColor: 'text-[#14B8A6]',
    pricingHref: '/pricing?tab=ecommerce',
  },
  {
    id: 'custom-systems',
    icon: Cpu,
    name: 'Custom Digital Systems & Portals',
    tagline: 'Tailored software engineered around your specific operational workflows.',
    desc: 'Stop forcing your business into rigid off-the-shelf subscriptions. We build bespoke client portals, booking engines, LMS educational platforms, and CRMs starting with a formal discovery phase.',
    startingPrice: {
      KE: 'Discovery from KSh 25,000 · Systems from KSh 180,000',
      GLOBAL: 'Discovery from $500 · Systems from $2,200',
    },
    deliverables: [
      'Formal technical specification & database architecture',
      'Role-based access control (Admins, Staff, Clients, Students)',
      'Interactive dashboards & data visualization',
      'Third-party ERP, CRM, and webhook integrations',
      'Automated PDF generation, receipts & reporting',
      'Dedicated project manager & milestone sign-offs',
    ],
    accent: '#8B5CF6',
    bg: 'bg-purple-50',
    textColor: 'text-purple-600',
    pricingHref: '/pricing?tab=custom',
  },
  {
    id: 'care',
    icon: Wrench,
    name: 'Website Care & Ongoing Maintenance',
    tagline: 'Proactive software maintenance, updates, and digital health monitoring.',
    desc: 'Protect your digital investment. We handle monthly CMS updates, security patches, offsite backups, continuous uptime checks, and priority technical support so your site is always fast, secure, and operational.',
    startingPrice: {
      KE: 'Care from KSh 5,000/mo',
      GLOBAL: 'Care from $75/mo',
    },
    deliverables: [
      'Proactive CMS & security patch management',
      'Automated daily/weekly offsite encrypted backups',
      'Web Application Firewall (WAF) & malware defense',
      'Core Web Vitals telemetry & speed monitoring',
      'Dedicated developer hours for updates and edits',
      'Monthly digital health & performance reports',
    ],
    accent: '#22C55E',
    bg: 'bg-green-50',
    textColor: 'text-green-600',
    pricingHref: '/pricing?tab=care',
  },
];

const industries = [
  {
    icon: Building2,
    name: 'SMEs & Growing Businesses',
    desc: 'Establish authority, generate qualified inbound leads, and present a world-class digital image.',
  },
  {
    icon: Church,
    name: 'Churches & Ministries',
    desc: 'Live sermon archives, event calendars, online tithes & offerings via M-Pesa, and community hubs.',
  },
  {
    icon: GraduationCap,
    name: 'Schools & Educational Institutions',
    desc: 'Student admission portals, course modules, fee payment tracking, and parent communication.',
  },
  {
    icon: HeartHandshake,
    name: 'NGOs & Non-Profits',
    desc: 'Multi-lingual program documentation, donation portals, impact report downloads, and grant reporting.',
  },
  {
    icon: Rocket,
    name: 'Startups & Founders',
    desc: 'Rapid MVP deployment, scalable Next.js architectures, and conversion-engineered product landing pages.',
  },
];

export default async function ServicesPage() {
  const { market } = await getServerMarket();
  const activeMarket = market === 'KE' ? 'KE' : 'GLOBAL';

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'BazionWeb Services',
          itemListElement: productFamilies.map((family, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'Service',
              name: family.name,
              description: family.desc,
              provider: {
                '@type': 'Organization',
                name: 'BazionWeb',
                url: 'https://bazionweb.com',
              },
              offers: {
                '@type': 'Offer',
                description: family.startingPrice[activeMarket] ?? family.startingPrice.GLOBAL,
              },
            },
          })),
        }}
      />
      {/* ─── Hero Header ─── */}
      <section className="section bg-[#0F172A] pt-32 pb-16 text-white">
        <div className="container-default max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Services' }]} />
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-3">
            Core Service Architecture
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Websites, Digital Systems &amp; Managed Technology
          </h1>
          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
            We design, develop, secure, and maintain professional digital solutions for businesses, organizations, and institutions in Kenya and worldwide.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/pricing" className="btn-primary text-xs px-6 py-3">
              Explore 2026 Pricing Architecture
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/quote" className="btn-secondary text-xs px-6 py-3">
              Open Instant Quote Calculator
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Step-by-Step Client Journey Banner (Below Hero Banner with High Contrast) ─── */}
      <section className="bg-[#0B1120] border-b border-slate-800 py-5">
        <div className="container-default max-w-6xl mx-auto">
          <ClientJourneyProgress currentStep={1} variant="dark" />
        </div>
      </section>

      {/* ─── Product Families ─── */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default space-y-12 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB] mb-2 block">
              Four Product Families
            </span>
            <h2 className="text-3xl font-extrabold text-[#0F172A]">
              Engineered for Complete Digital Success
            </h2>
          </div>

          <div className="space-y-8">
            {productFamilies.map((family) => (
              <div
                key={family.id}
                id={family.id}
                className="card p-8 md:p-10 bg-white border border-slate-200/90 shadow-sm rounded-2xl grid grid-cols-1 lg:grid-cols-5 gap-8 items-start"
              >
                {/* Content */}
                <div className="lg:col-span-3">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl ${family.bg} flex items-center justify-center shrink-0`}>
                      <family.icon className={`w-6 h-6 ${family.textColor}`} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[#0F172A] text-xl md:text-2xl">
                        {family.name}
                      </h3>
                      <div className={`text-xs font-semibold ${family.textColor}`}>
                        {family.tagline}
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm leading-relaxed mb-6">
                    {family.desc}
                  </p>

                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 mb-8">
                    <span>{family.startingPrice[activeMarket] ?? family.startingPrice.GLOBAL}</span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link href={family.pricingHref} className="btn-primary text-xs px-5 py-2.5">
                      View Packages & Pricing
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href={`/quote?service=${family.id}`}
                      className="btn-secondary text-xs px-5 py-2.5"
                    >
                      Calculate Quote
                    </Link>
                  </div>
                </div>

                {/* Deliverables Checklist */}
                <div className="lg:col-span-2">
                  <div className="bg-slate-50/80 rounded-xl p-6 border border-slate-200/80">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Core Capabilities & Inclusions
                    </div>
                    <ul className="space-y-3">
                      {family.deliverables.map(item => (
                        <li key={item} className="flex items-start gap-2.5 text-xs text-slate-600 leading-tight">
                          <Check className="w-4 h-4 shrink-0 text-[#22C55E] mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Industries We Serve ─── */}
      <section className="section bg-white border-t border-slate-100">
        <div className="container-default max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB] mb-2 block">
              Tailored Solutions
            </span>
            <h2 className="text-3xl font-extrabold text-[#0F172A] mb-3">
              Industries & Organizations We Serve
            </h2>
            <p className="text-sm text-slate-500">
              We understand that a corporate law firm, an educational institution, and a faith-based ministry have fundamentally different requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map(ind => (
              <div
                key={ind.name}
                className="bg-slate-50/70 rounded-2xl p-6 border border-slate-100 hover:border-blue-200 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-[#2563EB] flex items-center justify-center mb-4">
                  <ind.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-[#0F172A] text-base mb-2">{ind.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{ind.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Strategic Integration Callout ─── */}
      <section className="section bg-[#0F172A] text-white">
        <div className="container-default max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            The BazionWeb Advantage
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-6">
            One engineering team, zero vendor finger-pointing
          </h2>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-10">
            When you build with BazionWeb, your designers, developers, maintenance specialists, and security engineers sit at the same table. No juggling disparate platforms while waiting for a freelancer to respond.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pricing" className="btn-primary px-8 py-3.5 text-xs">
              Review Pricing Architecture
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition-colors text-xs"
            >
              Book Technical Consultation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
