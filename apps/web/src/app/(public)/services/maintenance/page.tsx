import Link from 'next/link';
import { Wrench, Check, ArrowRight, RefreshCw, FileText, AlertCircle, Edit3, Activity, Package } from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Website Care & Monthly Maintenance Plans',
  description: 'Monthly CMS & plugin updates, security patches, continuous health checks, and minor content updates delivered with transparent monthly reporting.',
  alternates: { canonical: 'https://bazionweb.com/services/maintenance' },
};

const tasks = [
  { icon: Package,    title: 'CMS & Plugin Updates',  desc: 'Core CMS, themes, and plugins updated monthly in a staging environment first — never applied live without testing.' },
  { icon: AlertCircle,title: 'Security Patches',      desc: 'Critical patches applied within 72 hours of release. Zero-day vulnerabilities get emergency treatment.' },
  { icon: Edit3,      title: 'Content Updates',       desc: 'Unlimited minor content changes on Growth+ plans: text, images, team members, contact details, new blog posts.' },
  { icon: Activity,   title: 'Health Checks',         desc: 'Broken link scan, 404 audit, form testing, mobile render check, and database query review every month.' },
  { icon: RefreshCw,  title: 'Uptime Monitoring',     desc: 'Continuous 60-second uptime checks with immediate alerting and escalation if anything goes offline.' },
  { icon: FileText,   title: 'Monthly Report',        desc: 'A clean, readable PDF report every month — what was done, what was found, what\'s coming next.' },
];

const whatsMinor = [
  'Text edits on any page', 'Image or logo swap', 'New team member added', 'Contact info update',
  'Blog post published', 'Testimonial added', 'FAQ updated', 'Social links changed',
  'Business hours updated', 'Event announcement added',
];

const whatsNotMinor = [
  'New page design',  'New section/layout', 'E-commerce feature', 'Custom functionality',
  'Third-party integration', 'Full rebrand',
];

export default function MaintenancePage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Website Care & Monthly Maintenance',
          description: 'Monthly CMS updates, security patches, health checks, content updates, and transparent monthly reporting. One team, one invoice.',
          url: 'https://bazionweb.com/services/maintenance',
          provider: { '@type': 'Organization', '@id': 'https://bazionweb.com/#organization', name: 'BazionWeb' },
          areaServed: ['Kenya', 'Worldwide'],
          offers: [
            { '@type': 'Offer', name: 'Starter Care Plan (Kenya)', price: '5000', priceCurrency: 'KES', url: 'https://bazionweb.com/pricing' },
            { '@type': 'Offer', name: 'Starter Care Plan (International)', price: '49', priceCurrency: 'USD', url: 'https://bazionweb.com/pricing' },
          ],
        }}
      />
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Services', href: '/services' }, { name: 'Website Maintenance' }]} />

          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6">
            <Wrench className="w-6 h-6 text-purple-400" />
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Service</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">Website Maintenance</h1>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl">
            Monthly updates, patches, content changes, and health checks — all tested, documented, and delivered in a report. Your website never gets neglected.
          </p>
          <Link href="/contact?service=maintenance" className="btn-primary px-7 py-3">
            Get maintenance coverage <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">What we do every month</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tasks.map(t => (
              <div key={t.title} className="card p-6">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-4">
                  <t.icon className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="font-bold text-[#0F172A] mb-2">{t.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-default max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-8">What counts as a &ldquo;minor content update&rdquo;?</h2>
          <p className="text-slate-500 mb-6">On Growth+ plans, unlimited minor updates are included. Here&apos;s how we define them:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6">
              <div className="text-xs font-bold text-[#22C55E] uppercase tracking-widest mb-4">✓ Minor — included</div>
              <ul className="space-y-2">
                {whatsMinor.map(i => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0" /> {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-6 border-dashed">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Scoped separately</div>
              <ul className="space-y-2">
                {whatsNotMinor.map(i => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="w-3.5 h-3.5 shrink-0 text-center">→</span> {i}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-4">These are quoted as one-time add-ons — usually a quick turnaround.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-sm bg-[#F8FAFC]">
        <div className="container-default max-w-3xl mx-auto">
          <div className="card p-8 border-l-4 border-[#2563EB]">
            <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
              <div>
                <h3 className="font-bold text-[#0F172A] text-lg mb-1">Maintenance is included in Growth+ plans</h3>
                <p className="text-sm text-slate-500">From $59/mo. No setup fees. Monthly rolling contract.</p>
              </div>
              <div className="flex gap-3 shrink-0">
                <Link href="/pricing" className="btn-primary px-6">See plans <ArrowRight className="w-4 h-4" /></Link>
                <Link href="/contact" className="btn-secondary px-6">Ask a question</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
