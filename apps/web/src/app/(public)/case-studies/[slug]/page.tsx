import Link from 'next/link';
import { ArrowLeft, ArrowRight, TrendingUp, Shield, Zap, Clock, Check } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

const studies: Record<string, {
  client: string; industry: string; plan: string; website: string;
  challenge: string; approach: string[]; results: { icon: any; metric: string; label: string }[];
  quote: string; quoteName: string; quoteRole: string;
  timeline: string; teamSize: string;
}> = {
  'acacia-healthcare': {
    client: 'Acacia Healthcare Ltd', industry: 'Healthcare & Clinics',
    plan: 'Business', website: 'acaciahealthcare.co.ke', timeline: '3 weeks to full migration',
    teamSize: '6 managed sites',
    challenge: 'A 6-site healthcare network with slow pages, three different hosting providers, no unified monitoring, and SSL certificates expiring without warning. Their IT manager had left, and the remaining staff had no technical capacity to manage the websites. Patients were complaining about the booking form being unreliable.',
    approach: [
      'Migrated all 6 sites to a unified hosting environment with zero downtime using a staged DNS cutover strategy.',
      'Deployed Cloudflare CDN across all domains — reducing average page load time from 4.8s to 1.3s.',
      'Implemented WAF rules, Fail2Ban, and malware scanning across the full estate.',
      'Set up Uptime Kuma monitoring for all 6 domains with PagerDuty alerting to our on-call engineer.',
      'Fixed the broken booking form and implemented end-to-end form testing in the monthly maintenance cycle.',
      'Enrolled all sites in monthly maintenance — all CMS and plugin updates applied to staging first.',
    ],
    results: [
      { icon: TrendingUp, metric: '99.98%', label: '30-day uptime (all 6 sites)' },
      { icon: Zap,        metric: '97',     label: 'Average Lighthouse score' },
      { icon: Clock,      metric: '1.3s',   label: 'Average page load time (was 4.8s)' },
      { icon: Shield,     metric: '0',      label: 'Security incidents since migration' },
    ],
    quote: 'BazionWeb took complete ownership. No more SSL errors, no more slow pages, no more juggling vendors. I don\'t even think about our websites anymore — and that\'s exactly what I needed.',
    quoteName: 'Dr. Sarah K.', quoteRole: 'Director, Acacia Healthcare Ltd',
  },
  'parkview-law': {
    client: 'Parkview Law Associates', industry: 'Professional Services',
    plan: 'Growth', website: 'parkviewlaw.co.ke', timeline: '2 weeks to first results',
    teamSize: '1 main site + 2 practice area landing pages',
    challenge: 'A law firm whose website had been untouched for 18 months. Outdated CMS with 14 unpatched plugins, a broken contact form that was silently dropping enquiries, a Lighthouse score of 42, and no backups. The firm had recently lost a major client pitch partly because their website looked untrustworthy.',
    approach: [
      'Emergency security audit: 14 plugin updates applied in staging, tested, then deployed to production within 48 hours.',
      'Fixed the broken contact form — a plugin conflict introduced by an auto-update 6 months prior.',
      'Rebuilt the site\'s performance: image optimisation, CDN configuration, and caching rules took Lighthouse from 42 to 96.',
      'Enrolled in monthly maintenance with content updates — 3 attorney profiles updated, 2 practice area pages refreshed.',
      'Implemented daily encrypted backups with 60-day retention.',
      'Monthly security scan showing clean bill of health included in monthly report.',
    ],
    results: [
      { icon: Zap,        metric: '42 → 96', label: 'Lighthouse performance score' },
      { icon: TrendingUp, metric: '3.2×',    label: 'Increase in enquiry form submissions' },
      { icon: Clock,      metric: '2 weeks', label: 'Time from onboarding to first measurable result' },
      { icon: Shield,     metric: '100%',    label: 'Backup success rate (30 days)' },
    ],
    quote: 'I used to juggle three vendors. Now it\'s one invoice, one team. I haven\'t thought about my website in months — and I\'m getting more leads than ever.',
    quoteName: 'Michael O.', quoteRole: 'Managing Partner, Parkview Law Associates',
  },
};

export async function generateStaticParams() {
  return Object.keys(studies).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const s = studies[params.slug];
  if (!s) return {};
  return {
    title: `${s.client} — Case Study`,
    description: s.challenge.slice(0, 160),
  };
}

export default function CaseStudyPage({ params }: { params: { slug: string } }) {
  const s = studies[params.slug];
  if (!s) notFound();

  return (
    <>
      <section className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-4xl">
          <Link href="/case-studies" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-8">
            <ArrowLeft className="w-4 h-4" /> All case studies
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white font-black text-xl shadow">
              {s.client[0]}
            </div>
            <div>
              <div className="font-bold text-white">{s.client}</div>
              <div className="text-xs text-slate-400">{s.industry}</div>
            </div>
            <span className="ml-auto badge-blue">{s.plan} Plan</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-5 leading-snug">
            How we transformed {s.client}'s website management
          </h1>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <span>{s.timeline}</span>
            <span>·</span>
            <span>{s.teamSize}</span>
            <span>·</span>
            <a href={`https://${s.website}`} target="_blank" rel="noopener noreferrer" className="text-[#14B8A6] hover:underline">{s.website}</a>
          </div>
        </div>
      </section>

      <section className="section bg-[#F8FAFC]">
        <div className="container-default max-w-4xl">
          {/* Results */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
            {s.results.map(r => (
              <div key={r.label} className="card p-5 text-center">
                <r.icon className="w-5 h-5 text-[#2563EB] mx-auto mb-3" />
                <div className="text-2xl font-black text-[#0F172A] mb-1">{r.metric}</div>
                <div className="text-xs text-slate-400 leading-snug">{r.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            <div className="lg:col-span-3 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-[#0F172A] mb-3">The challenge</h2>
                <p className="text-slate-600 leading-relaxed">{s.challenge}</p>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0F172A] mb-4">What we did</h2>
                <div className="space-y-3">
                  {s.approach.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <blockquote className="card p-6 border-l-4 border-[#2563EB]">
                <p className="text-slate-600 italic leading-relaxed mb-4">"{s.quote}"</p>
                <footer>
                  <div className="font-semibold text-[#0F172A] text-sm">{s.quoteName}</div>
                  <div className="text-xs text-slate-400">{s.quoteRole}</div>
                </footer>
              </blockquote>

              <div className="card p-6">
                <h3 className="font-bold text-[#0F172A] mb-3 text-sm">Services delivered</h3>
                {['Managed Cloud Hosting', 'Security Management', 'Monthly Maintenance', 'Performance Optimisation', '24/7 Technical Support'].map(svc => (
                  <div key={svc} className="flex items-center gap-2 text-sm text-slate-600 py-1.5 border-b border-slate-50 last:border-0">
                    <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0" /> {svc}
                  </div>
                ))}
              </div>

              <div className="card p-6 bg-[#0F172A] text-white">
                <p className="text-sm text-slate-400 mb-3">Want results like these?</p>
                <Link href="/contact" className="btn-primary w-full justify-center text-sm">
                  Get free assessment <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
