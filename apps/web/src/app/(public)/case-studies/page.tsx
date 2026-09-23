import Link from 'next/link';
import { ArrowRight, TrendingUp, Shield, Zap, Clock } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Case Studies',
  description: 'Real results from real clients. See how BazionWeb transformed website management for businesses across Kenya.',
  alternates: { canonical: 'https://bazionweb.com/case-studies' },
};

const studies = [
  {
    slug: 'acacia-healthcare',
    client: 'Acacia Healthcare',
    industry: 'Healthcare & Clinics',
    plan: 'Business',
    challenge: 'A 6-site healthcare network with slow pages, three different hosting providers, no unified monitoring, and SSL certificates expiring without warning.',
    results: [
      { icon: TrendingUp, metric: '99.98%', label: 'Uptime achieved' },
      { icon: Zap, metric: '97', label: 'Lighthouse score' },
      { icon: Clock, metric: '<15 min', label: 'P1 response time' },
      { icon: Shield, metric: '0', label: 'Security incidents' },
    ],
    quote: 'BazionWeb took complete ownership. No more SSL errors, no more slow pages, no more juggling vendors.',
    quoteName: 'Dr. Sarah K.',
    quoteRole: 'Director, Acacia Healthcare',
    color: 'from-blue-500 to-teal-500',
  },
  {
    slug: 'parkview-law',
    client: 'Parkview Law Associates',
    industry: 'Professional Services',
    plan: 'Growth',
    challenge: 'A law firm whose website had been untouched for 18 months. Outdated CMS, broken contact form, 42 on Lighthouse, no backups.',
    results: [
      { icon: Zap, metric: '41 → 96', label: 'Lighthouse score' },
      { icon: TrendingUp, metric: '3.2× ', label: 'More enquiry form submissions' },
      { icon: Clock, metric: '2 weeks', label: 'Time to first result' },
      { icon: Shield, metric: '100%', label: 'Backup success rate' },
    ],
    quote: 'I used to juggle three vendors. Now it\'s one invoice, one team. I haven\'t thought about my website in months.',
    quoteName: 'Michael O.',
    quoteRole: 'Managing Partner',
    color: 'from-purple-500 to-blue-500',
  },
  {
    slug: 'grow-africa-ngo',
    client: 'GrowAfrica Initiative',
    industry: 'NGO & Non-profit',
    plan: 'Starter',
    challenge: 'An NGO running donor campaigns on a site with no CDN, 8-second load times on mobile, and a broken donation form that had cost them three months of contributions.',
    results: [
      { icon: Zap, metric: '8s → 1.3s', label: 'Mobile load time' },
      { icon: TrendingUp, metric: '220%', label: 'Increase in donor conversions' },
      { icon: Shield, metric: 'A+', label: 'SSL Labs rating' },
      { icon: Clock, metric: '99.9%', label: 'Uptime guaranteed' },
    ],
    quote: 'Our donation page finally works reliably. Within 30 days we had our best fundraising month ever.',
    quoteName: 'Amara N.',
    quoteRole: 'Executive Director',
    color: 'from-teal-500 to-green-500',
  },
];

export default function CaseStudiesPage() {
  return (
    <>
      {/* Header */}
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
              Case Studies
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">
              Real clients, measurable results
            </h1>
            <p className="text-lg text-slate-400">
              Every case study shows a real challenge, our exact approach, and the numbers that resulted. No before/after stock photos.
            </p>
          </div>
        </div>
      </section>

      {/* Studies */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default space-y-10">
          {studies.map((study) => (
            <div key={study.slug} className="card p-8 md:p-10 grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Left */}
              <div className="lg:col-span-3 flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${study.color} flex items-center justify-center text-white font-black text-lg shadow`}>
                    {study.client[0]}
                  </div>
                  <div>
                    <div className="font-bold text-[#0F172A]">{study.client}</div>
                    <div className="text-xs text-slate-400">{study.industry}</div>
                  </div>
                  <span className="ml-auto badge-blue">{study.plan} Plan</span>
                </div>

                <h2 className="text-xl font-bold text-[#0F172A] mb-3">The challenge</h2>
                <p className="text-slate-500 leading-relaxed mb-6">{study.challenge}</p>

                <blockquote className="border-l-4 border-[#2563EB] pl-4 italic text-slate-600 text-sm leading-relaxed mb-5">
                  "{study.quote}"
                  <footer className="not-italic mt-2">
                    <span className="font-semibold text-[#0F172A]">{study.quoteName}</span>
                    <span className="text-slate-400"> — {study.quoteRole}</span>
                  </footer>
                </blockquote>

                <Link href={`/case-studies/${study.slug}`} className="btn-secondary inline-flex mt-auto">
                  Read full case study <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Results grid */}
              <div className="lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Results</h3>
                <div className="grid grid-cols-2 gap-3">
                  {study.results.map(r => (
                    <div key={r.label} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <r.icon className="w-4 h-4 text-[#2563EB] mb-2" />
                      <div className="text-xl font-black text-[#0F172A]">{r.metric}</div>
                      <div className="text-xs text-slate-400">{r.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-[#0F172A]">
        <div className="container-default text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">Want results like these?</h2>
          <p className="text-slate-400 mb-8">
            Every client starts with a free website assessment. We identify the issues, estimate the improvement, and give you a plan — no commitment needed.
          </p>
          <Link href="/contact" className="btn-primary px-8 py-4">
            Get Your Free Assessment <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </>
  );
}
