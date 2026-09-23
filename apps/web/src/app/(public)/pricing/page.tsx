import Link from 'next/link';
import { Check, X, ArrowRight, HelpCircle, Shield, Zap, Server, Globe } from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for complete website lifecycle management. Starter from $49/mo. No hidden fees.',
  alternates: { canonical: 'https://bazionweb.com/pricing' },
};

const plans = [
  {
    name: 'Starter',
    price: 49,
    desc: 'Hosting, SSL, backups, and monitoring. Everything to stay online reliably.',
    uptime: '99.9%',
    downtime: '43.8 min/mo',
    p1: '1 hour',
    p2: '4 hours',
    p3: '1 business day',
    credit: '5% monthly fee',
    highlight: false,
  },
  {
    name: 'Growth',
    price: 99,
    desc: 'Adds full maintenance, security management and priority support to your stack.',
    uptime: '99.95%',
    downtime: '21.9 min/mo',
    p1: '30 min',
    p2: '2 hours',
    p3: '4 hours',
    credit: '10% monthly fee',
    highlight: true,
  },
  {
    name: 'Business',
    price: 199,
    desc: 'Complete lifecycle management. Performance optimization, unlimited updates, strategy calls.',
    uptime: '99.95%',
    downtime: '21.9 min/mo',
    p1: '15 min',
    p2: '1 hour',
    p3: '4 hours',
    credit: '15% monthly fee',
    highlight: false,
  },
  {
    name: 'Enterprise',
    price: null,
    desc: 'Custom SLA, dedicated account manager, quarterly business reviews and pen testing.',
    uptime: '99.99%',
    downtime: '4.3 min/mo',
    p1: '5 min',
    p2: '30 min',
    p3: '2 hours',
    credit: '25% monthly fee',
    highlight: false,
  },
];

type FeatureRow = {
  category: string;
  features: { name: string; starter: boolean | string; growth: boolean | string; business: boolean | string; enterprise: boolean | string }[];
};

const featureMatrix: FeatureRow[] = [
  {
    category: 'Hosting & Infrastructure',
    features: [
      { name: 'Managed Cloud Hosting', starter: true, growth: true, business: true, enterprise: true },
      { name: 'Auto SSL Certificate', starter: true, growth: true, business: true, enterprise: true },
      { name: 'Cloudflare CDN', starter: true, growth: true, business: true, enterprise: true },
      { name: 'Daily Backups', starter: true, growth: true, business: true, enterprise: true },
      { name: 'Uptime Monitoring', starter: true, growth: true, business: true, enterprise: true },
      { name: 'Backup Verification', starter: false, growth: false, business: 'Monthly', enterprise: 'Monthly Tested' },
    ],
  },
  {
    category: 'Security',
    features: [
      { name: 'Security Monitoring', starter: 'Basic', growth: 'Full', business: 'Full', enterprise: 'Full + Pen Test' },
      { name: 'WAF (Web Application Firewall)', starter: false, growth: true, business: true, enterprise: true },
      { name: 'Malware Scanning', starter: false, growth: true, business: true, enterprise: true },
      { name: 'SSL Monitoring & Rotation', starter: 'Auto only', growth: 'Auto + Monitor', business: 'Auto + Monitor', enterprise: 'Auto + Monitor' },
    ],
  },
  {
    category: 'Maintenance',
    features: [
      { name: 'Monthly Maintenance', starter: false, growth: true, business: true, enterprise: true },
      { name: 'Monthly Report', starter: false, growth: true, business: true, enterprise: true },
      { name: 'Unlimited Minor Content Updates', starter: false, growth: false, business: true, enterprise: true },
      { name: 'Performance Optimization', starter: false, growth: false, business: true, enterprise: true },
      { name: 'Core Web Vitals Monitoring', starter: false, growth: false, business: true, enterprise: true },
    ],
  },
  {
    category: 'Support',
    features: [
      { name: 'Support Channel', starter: 'Email', growth: 'Email + Ticket', business: 'Email + Ticket + Priority', enterprise: 'Dedicated AM' },
      { name: 'P1 Response Time', starter: '1 hour', growth: '30 min', business: '15 min', enterprise: '5 min' },
      { name: 'Uptime SLA', starter: '99.9%', growth: '99.95%', business: '99.95%', enterprise: '99.99%' },
      { name: 'Service Credits', starter: '5%', growth: '10%', business: '15%', enterprise: '25%' },
    ],
  },
  {
    category: 'Account Management',
    features: [
      { name: 'Client Portal Access', starter: true, growth: true, business: true, enterprise: true },
      { name: 'Quarterly Business Review', starter: false, growth: false, business: false, enterprise: true },
      { name: 'Dedicated Account Manager', starter: false, growth: false, business: false, enterprise: true },
      { name: 'Custom SLA', starter: false, growth: false, business: false, enterprise: true },
      { name: 'Monthly Strategy Call', starter: false, growth: false, business: true, enterprise: true },
    ],
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-5 h-5 text-[#22C55E] mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-slate-200 mx-auto" />;
  return <span className="text-xs text-slate-600 text-center block">{value}</span>;
}

const faqs = [
  {
    q: 'What\'s included in "website development"?',
    a: 'Website development is a one-time project fee separate from your monthly plan. We design and build custom, responsive websites on Next.js with CMS integration. After launch, your monthly plan covers everything ongoing.',
  },
  {
    q: 'Can I upgrade or downgrade my plan?',
    a: 'Yes. You can upgrade instantly and the new plan kicks in immediately. Downgrades take effect at your next billing cycle.',
  },
  {
    q: 'What does "minor content updates" mean?',
    a: 'Changes that take under 30 minutes — text edits, image swaps, new blog posts, contact details, team member changes. Structural redesigns or new feature development are scoped separately.',
  },
  {
    q: 'Are there any setup fees?',
    a: 'None. Your first invoice is your first monthly subscription. If we\'re migrating your existing site, that\'s quoted as a separate one-time add-on.',
  },
  {
    q: 'What happens if you miss the uptime SLA?',
    a: 'You receive a service credit automatically applied to your next invoice. No need to ask — our monitoring detects it and we process it proactively.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes — pay annually and get 2 months free (effectively a ~17% discount). Contact us to arrange annual billing.',
  },
];

export default function PricingPage() {
  return (
    <>
      {/* Header */}
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default text-center">
          <div className="flex justify-center">
            <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Pricing' }]} />
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            Pricing
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Transparent pricing, zero surprises
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-4">
            Every plan includes hosting, SSL, backups and monitoring. Pay monthly. Cancel anytime.
          </p>
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-slate-400">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            All prices in USD · Annual billing saves 2 months
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="section-sm bg-[#F8FAFC]">
        <div className="container-default">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl border-2 p-7 flex flex-col ${
                  plan.highlight ? 'border-[#2563EB] shadow-[0_0_0_4px_rgba(37,99,235,0.08)]' : 'border-slate-100'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-[#2563EB] text-white text-xs font-bold px-4 py-1.5 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{plan.name}</div>
                  <div className="flex items-end gap-1 mb-3">
                    {plan.price ? (
                      <>
                        <span className="text-4xl font-black text-[#0F172A]">${plan.price}</span>
                        <span className="text-slate-400 text-sm mb-1">/mo</span>
                      </>
                    ) : (
                      <span className="text-2xl font-black text-[#0F172A]">Custom</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{plan.desc}</p>
                </div>

                <div className="space-y-1.5 mb-6 pb-6 border-b border-slate-100 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Uptime SLA</span>
                    <span className="font-semibold text-[#0F172A]">{plan.uptime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Allowed downtime</span>
                    <span className="font-semibold text-[#0F172A]">{plan.downtime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">P1 response</span>
                    <span className="font-semibold text-[#0F172A]">{plan.p1}</span>
                  </div>
                </div>

                <div className="mt-auto">
                  <Link
                    href={plan.price ? `/checkout?plan=${plan.name.toLowerCase()}` : '/contact?plan=enterprise'}
                    className={plan.highlight ? 'btn-primary w-full justify-center' : 'btn-secondary w-full justify-center'}
                  >
                    {plan.price ? 'Get Started' : 'Contact Us'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="section bg-white">
        <div className="container-default">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-3">Full feature comparison</h2>
            <p className="text-slate-500">Every feature, every plan — no fine print.</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-[var(--shadow-card)]">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[#0F172A]">
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-64">Feature</th>
                  {['Starter', 'Growth', 'Business', 'Enterprise'].map(p => (
                    <th key={p} className={`px-4 py-4 text-center text-sm font-bold ${p === 'Growth' ? 'text-[#2563EB]' : 'text-white'}`}>
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureMatrix.map(group => (
                  <>
                    <tr key={group.category} className="bg-slate-50">
                      <td colSpan={5} className="px-6 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {group.category}
                      </td>
                    </tr>
                    {group.features.map((f, i) => (
                      <tr key={f.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-6 py-3 text-sm text-slate-600">{f.name}</td>
                        <td className="px-4 py-3 text-center"><Cell value={f.starter} /></td>
                        <td className="px-4 py-3 text-center bg-blue-50/30"><Cell value={f.growth} /></td>
                        <td className="px-4 py-3 text-center"><Cell value={f.business} /></td>
                        <td className="px-4 py-3 text-center"><Cell value={f.enterprise} /></td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="section-sm bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">One-time add-ons</h2>
            <p className="text-slate-500 text-sm">Available with any plan</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { icon: Globe, name: 'Website Build', price: 'From $800', desc: 'Custom Next.js website with CMS' },
              { icon: Server, name: 'Site Migration', price: 'From $150', desc: 'Zero-downtime transfer to our infra' },
              { icon: Zap, name: 'Performance Audit', price: 'From $120', desc: 'Full Lighthouse + CWV audit report' },
              { icon: Shield, name: 'Security Audit', price: 'From $200', desc: 'OWASP scan + remediation report' },
            ].map(a => (
              <div key={a.name} className="card p-5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                  <a.icon className="w-4 h-4 text-[#2563EB]" />
                </div>
                <div className="font-semibold text-[#0F172A] text-sm mb-1">{a.name}</div>
                <div className="text-[#2563EB] font-bold text-sm mb-1">{a.price}</div>
                <div className="text-xs text-slate-400">{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section bg-white">
        <div className="container-default max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-3">Frequently asked questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map(f => (
              <div key={f.q} className="card p-6">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#0F172A] mb-2 text-sm">{f.q}</div>
                    <div className="text-sm text-slate-500 leading-relaxed">{f.a}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-[#0F172A]">
        <div className="container-default text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Not sure which plan fits?
          </h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto">
            Tell us about your website and we'll recommend the right plan — or build a custom quote for Enterprise needs.
          </p>
          <Link href="/contact" className="btn-primary px-8 py-4 text-base">
            Get a Free Recommendation
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </>
  );
}
