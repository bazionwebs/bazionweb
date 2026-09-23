import Link from 'next/link';
import { Zap, ArrowRight, TrendingUp, Image, Database, Globe, BarChart2, Server } from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Performance Optimization',
  description: 'Core Web Vitals improvements, Lighthouse 95+ scores, image optimization, CDN tuning. Measurable performance with before/after reports.',
  alternates: { canonical: 'https://bazionweb.com/services/performance' },
};

const optimizations = [
  { icon: BarChart2, title: 'Core Web Vitals Audit',   desc: 'Full LCP, INP, and CLS measurement across mobile and desktop. We identify every bottleneck before touching code.' },
  { icon: Image,     title: 'Image Optimization',       desc: 'Conversion to WebP/AVIF, lazy loading, responsive srcsets, and blur-up placeholders. Images are typically the biggest win.' },
  { icon: Globe,     title: 'CDN & Caching Config',     desc: 'Cloudflare cache rules, browser cache headers, and CDN preloading configured for maximum cache hit rates.' },
  { icon: Database,  title: 'Database Query Review',    desc: 'Slow query detection, index optimisation, and N+1 query elimination. Applied where dynamic content is the bottleneck.' },
  { icon: Server,    title: 'Server-side Optimisation', desc: 'PHP/Node.js runtime tuning, OPcache configuration, connection pooling, and memory limit optimisation.' },
  { icon: TrendingUp,'title': 'Before/After Report',   desc: 'Lighthouse scores, Core Web Vitals readings, and load time measurements before and after — so you see exactly what changed.' },
];

const targets = [
  { metric: 'Lighthouse Performance', target: '95+', unit: '/100' },
  { metric: 'LCP (Largest Contentful Paint)', target: '< 2.5s', unit: '' },
  { metric: 'INP (Interaction to Next Paint)', target: '< 200ms', unit: '' },
  { metric: 'CLS (Cumulative Layout Shift)', target: '< 0.1', unit: '' },
  { metric: 'Time to First Byte (TTFB)', target: '< 800ms', unit: '' },
  { metric: 'Total Blocking Time', target: '< 300ms', unit: '' },
];

export default function PerformancePage() {
  return (
    <>
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Services', href: '/services' }, { name: 'Performance Optimization' }]} />
          <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mb-6">
            <Zap className="w-6 h-6 text-yellow-400" />
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Service</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">Performance Optimization</h1>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl">
            Faster pages rank better, convert better, and retain users better. We target Lighthouse 95+ with measurable before/after proof — not just promises.
          </p>
          <Link href="/contact?service=performance" className="btn-primary px-7 py-3">
            Speed up your site <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] mb-8">What we optimise</h2>
              <div className="space-y-5">
                {optimizations.map(o => (
                  <div key={o.title} className="flex gap-4">
                    <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0 mt-0.5">
                      <o.icon className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-[#0F172A] mb-1 text-sm">{o.title}</div>
                      <p className="text-xs text-slate-500 leading-relaxed">{o.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-7">
              <h3 className="font-bold text-[#0F172A] mb-6">Our performance targets</h3>
              <div className="space-y-4">
                {targets.map(t => (
                  <div key={t.metric} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm text-slate-500">{t.metric}</span>
                    <span className="font-bold text-[#22C55E] text-sm">{t.target}{t.unit}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-3 bg-slate-50 rounded-xl text-xs text-slate-400">
                Targets are goals, not guaranteed minimums — actual scores depend on your existing content and third-party scripts. We discuss realistic expectations in our assessment.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-sm bg-[#0F172A]">
        <div className="container-default text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-3">Performance optimization from $199/mo</h2>
          <p className="text-slate-400 mb-6 text-sm">Included in Business+ plans. Standalone audit available from $120.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/pricing" className="btn-primary px-7">See plans <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/contact?service=performance" className="inline-flex items-center gap-2 px-7 py-3 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition-all">Book audit</Link>
          </div>
        </div>
      </section>
    </>
  );
}
