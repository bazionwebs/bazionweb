import Link from 'next/link';
import { Globe, Check, ArrowRight, Code, Figma, Zap, Search, Smartphone, Database } from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Custom Next.js Web Development & Systems',
  description: 'Custom, responsive websites and web applications engineered on modern Next.js. CMS-integrated, SEO architecture, mobile UX, and high conversion.',
  alternates: { canonical: 'https://bazionwebs.com/services/development' },
};

const deliverables = [
  { icon: Figma,      title: 'UX/UI Design',          desc: 'Full Figma wireframes and hi-fi mockups before a single line of code is written.' },
  { icon: Code,       title: 'Next.js Development',    desc: 'Modern, type-safe Next.js 14 codebase. Server-side rendering, static generation, API routes.' },
  { icon: Database,   title: 'CMS Integration',        desc: 'Strapi 5 CMS so your team can update content without needing a developer.' },
  { icon: Search,     title: 'SEO Architecture',       desc: 'Semantic HTML, meta tags, structured data, sitemap, robots.txt — all configured from day one.' },
  { icon: Smartphone, title: 'Responsive Design',      desc: 'Pixel-perfect on mobile, tablet, and desktop. Tested across major browsers.' },
  { icon: Zap,        title: 'Performance-first Build', desc: 'Image optimization, lazy loading, CDN-ready. Lighthouse 95+ guaranteed at handoff.' },
];

const process = [
  { step: '01', title: 'Discovery call',       desc: 'We understand your business, goals, audience, and technical requirements.' },
  { step: '02', title: 'Proposal & scope',     desc: 'Written proposal with page list, feature scope, timeline, and fixed price.' },
  { step: '03', title: 'Design (Figma)',        desc: 'Wireframes → high-fidelity designs → your approval before build starts.' },
  { step: '04', title: 'Development',          desc: 'Sprint-based build with staging deploy for your review at every milestone.' },
  { step: '05', title: 'QA & performance',     desc: 'Cross-browser testing, accessibility check, Lighthouse audit, CMS training.' },
  { step: '06', title: 'Launch & handoff',     desc: 'Production deploy, DNS cut-over, and 30-day post-launch support included.' },
];

export default function WebDevPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Custom Website Design & Development',
          description: 'Custom, responsive websites and web applications engineered on modern Next.js. CMS-integrated, mobile-first, SEO-ready, and built to convert visitors into clients.',
          url: 'https://bazionwebs.com/services/development',
          provider: { '@type': 'Organization', '@id': 'https://bazionwebs.com/#organization', name: 'BazionWeb' },
          areaServed: ['Kenya', 'Worldwide'],
          offers: [
            { '@type': 'Offer', name: 'Launch Website (Kenya)', price: '25000', priceCurrency: 'KES', url: 'https://bazionwebs.com/pricing' },
            { '@type': 'Offer', name: 'Launch Website (International)', price: '495', priceCurrency: 'USD', url: 'https://bazionwebs.com/pricing' },
          ],
        }}
      />
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Services', href: '/services' }, { name: 'Website Development' }]} />
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6">
            <Globe className="w-6 h-6 text-[#2563EB]" />
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Service</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">Website Development</h1>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl">
            Custom websites built on Next.js — fast, accessible, CMS-integrated, and scored 95+ on Lighthouse from the moment we hand them over.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/contact?service=new-website" className="btn-primary px-7 py-3">
              Get a quote <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/quote" className="inline-flex items-center gap-2 px-7 py-3 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition-all">
              Estimate cost
            </Link>
          </div>
        </div>
      </section>

      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">What&apos;s included in every build</h2>
            <p className="text-slate-500">No extras. No hidden charges. Every item below is standard.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {deliverables.map(d => (
              <div key={d.title} className="card p-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                  <d.icon className="w-5 h-5 text-[#2563EB]" />
                </div>
                <h3 className="font-bold text-[#0F172A] mb-2">{d.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-default max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">Our build process</h2>
            <p className="text-slate-500">6 stages, fixed timeline, no surprises.</p>
          </div>
          <div className="space-y-5">
            {process.map(p => (
              <div key={p.step} className="flex gap-5">
                <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                  {p.step}
                </div>
                <div>
                  <div className="font-bold text-[#0F172A] mb-1">{p.title}</div>
                  <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm bg-[#F8FAFC]">
        <div className="container-default max-w-3xl mx-auto">
          <div className="card p-8 flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Starting from</div>
              <div className="text-4xl font-black text-[#0F172A] mb-1">$800</div>
              <div className="text-slate-500 text-sm">One-time project fee · Exact price quoted after scoping call</div>
              <ul className="mt-4 space-y-1.5">
                {['Fixed-price contract', 'Staging deploy for review', 'Full source code ownership', '30-day post-launch support'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-3.5 h-3.5 text-[#22C55E]" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <Link href="/contact?service=new-website" className="btn-primary px-7">
                Start your build <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/quote" className="btn-secondary px-7">Estimate cost</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
