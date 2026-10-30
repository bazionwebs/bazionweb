import Link from 'next/link';
import { Search, PenTool, Code, FlaskConical, Rocket, RefreshCw, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Our Engineering & Delivery Process',
  description:
    'From initial discovery and wireframing to Next.js development, rigorous QA testing, launch, and proactive care — explore our 6-phase engineering lifecycle.',
  alternates: { canonical: 'https://bazionweb.com/process' },
};

const phases = [
  {
    id: 'discovery',
    step: 'Phase 1',
    icon: Search,
    title: 'Discovery & Proposal',
    duration: 'Week 1',
    desc: 'We start with a free assessment of your current site (or idea): goals, competitors, must-have features, and budget. You get a fixed-scope proposal with a timeline — no hourly billing surprises.',
    points: ['Free website assessment', 'Competitor & goals review', 'Fixed scope, timeline, and price'],
    doneWhen: 'You approve a fixed proposal.',
  },
  {
    id: 'design',
    step: 'Phase 2',
    icon: PenTool,
    title: 'Design Mockup',
    duration: 'Weeks 1–2',
    desc: 'We design a full mockup of your new site — layout, colors, typography, and key pages. You see everything before a single line of code is written, and we revise until you approve it.',
    points: ['Hi-fi mockups of all key pages', 'Your branding, content, and feedback baked in', 'Unlimited revisions on the initial mockup'],
    doneWhen: 'You approve the mockup.',
  },
  {
    id: 'build',
    step: 'Phase 3',
    icon: Code,
    title: 'Build on Staging',
    duration: 'Weeks 2–6',
    desc: 'We build the approved design on a private staging site: responsive pages, CMS integration, forms, and any custom programming. You can watch progress live and request changes as we go.',
    points: ['Private staging URL from day one', 'Responsive + CMS-integrated build', 'Content loaded and formatted'],
    doneWhen: 'The staging site is complete and approved.',
  },
  {
    id: 'testing',
    step: 'Phase 4',
    icon: FlaskConical,
    title: 'Testing & SEO',
    duration: 'Final week',
    desc: 'Every link, form, and page is tested across browsers and devices. We configure titles, meta tags, sitemaps, and structured data — and for redesigns, we preserve your URL structure so rankings survive the move.',
    points: ['Cross-browser & mobile testing', 'Speed pass (Lighthouse 95+ target)', 'SEO setup + ranking preservation'],
    doneWhen: 'The QA checklist is green and you approve the launch.',
  },
  {
    id: 'launch',
    step: 'Phase 5',
    icon: Rocket,
    title: 'Zero-Downtime Launch',
    duration: 'Launch day',
    desc: 'We cut over to the new site without downtime: DNS, SSL, monitoring, and backups switched on and verified. You get a walkthrough of everything that changed.',
    points: ['DNS + SSL cutover handled for you', 'Monitoring and backups live from minute one', 'Launch walkthrough call'],
    doneWhen: 'The site is live, verified, and handed over.',
  },
  {
    id: 'management',
    step: 'Phase 6',
    icon: RefreshCw,
    title: 'Ongoing Management',
    duration: 'Every month',
    desc: 'A website without a manager decays. Under a management plan we handle updates, security, backups, content changes, and monthly reporting — so the site keeps improving instead of rotting.',
    points: ['Updates, security, backups, monitoring', 'Content changes included', 'Monthly report in plain language'],
    doneWhen: 'Never — it repeats every month under your plan.',
  },
];

export default function ProcessPage() {
  return (
    <>
      {/* Header */}
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Our Process' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            How We Work
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            From first call to fully managed, in six phases
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            You approve every step before we take the next one. No black boxes,
            no surprise invoices — just a clear path from idea to a website
            that stays healthy.
          </p>
        </div>
      </section>

      {/* Sticky phase nav */}
      <div className="sticky top-20 md:top-24 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="container-default flex gap-1 overflow-x-auto py-3 no-scrollbar">
          {phases.map((p, i) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-[#2563EB] hover:bg-blue-50/70 transition-colors"
            >
              {i + 1}. {p.title}
            </a>
          ))}
        </div>
      </div>

      {/* Phases */}
      <section className="section bg-white">
        <div className="container-default max-w-3xl space-y-6">
          {phases.map((p, i) => (
            <div key={p.id}>
              <article id={p.id} className="card p-7 md:p-8 scroll-mt-32">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <p.icon className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold tracking-widest uppercase text-[#14B8A6]">
                      {p.step} · {p.duration}
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-[#0F172A]">{p.title}</h2>
                  </div>
                </div>
                <p className="text-slate-600 leading-relaxed mb-4">{p.desc}</p>
                <ul className="space-y-2 mb-5">
                  {p.points.map(pt => (
                    <li key={pt} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <div className="rounded-xl bg-[#F8FAFC] border border-slate-100 px-4 py-3 text-sm">
                  <span className="font-semibold text-[#0F172A]">Done when: </span>
                  <span className="text-slate-600">{p.doneWhen}</span>
                </div>
              </article>

              {(i === 1 || i === 3 || i === 5) && (
                <div className="flex justify-center pt-2">
                  <Link href="/quote" className="btn-primary text-sm">
                    {i === 5 ? 'Start with phase 1 — free assessment' : 'Get a fixed quote for your project'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-[#0F172A]">
        <div className="container-default text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready for phase 1?
          </h2>
          <p className="text-slate-400 mb-8">
            It starts with a free assessment. We reply within 24 hours with honest findings — even if the answer is &ldquo;you don&apos;t need us.&rdquo;
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact" className="btn-primary px-8 py-4 text-base">
              Get your free assessment
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition-all text-base"
            >
              See management plans
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
