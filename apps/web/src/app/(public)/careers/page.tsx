import Link from 'next/link';
import { ArrowRight, MapPin, Clock, Briefcase } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Join the BazionWeb team. We\'re building the best managed web services company in Africa.',
};

const openRoles = [
  {
    title: 'Full-Stack Engineer (Next.js + NestJS)',
    type: 'Full-time',
    location: 'Nairobi / Remote',
    team: 'Engineering',
    desc: 'Build and maintain our web platform, client portal, and API. Strong TypeScript required. Familiarity with Docker and Prisma a big plus.',
    skills: ['TypeScript', 'Next.js', 'NestJS', 'PostgreSQL', 'Docker'],
  },
  {
    title: 'Support Engineer (Junior)',
    type: 'Part-time',
    location: 'Nairobi',
    team: 'Support',
    desc: 'Handle client tickets (P2–P4), run monthly maintenance tasks, monitor infrastructure alerts, and escalate P1 issues. Linux fundamentals required.',
    skills: ['Linux', 'Nginx', 'WordPress', 'cPanel', 'Tickets'],
  },
  {
    title: 'Sales & Business Development',
    type: 'Commission + Retainer',
    location: 'Nairobi',
    team: 'Growth',
    desc: 'Own the outbound pipeline: identify ICP prospects, run discovery calls, deliver proposals, and close. SaaS or IT services background preferred.',
    skills: ['B2B Sales', 'CRM', 'Proposals', 'Managed Services'],
  },
];

const values = [
  { emoji: '🏗️', title: 'Build something real', desc: 'We\'re building production infrastructure used by real businesses. Your work ships fast and matters.' },
  { emoji: '📈', title: 'Grow with us', desc: 'We\'re early-stage and scaling. Strong performers get equity-like upside as the team grows.' },
  { emoji: '🌍', title: 'Africa-first', desc: 'We\'re building the managed services company East Africa deserves — global quality, local roots.' },
  { emoji: '🔒', title: 'Security culture', desc: 'Security isn\'t a checkbox here. It\'s how we think and build, from day one.' },
];

export default function CareersPage() {
  return (
    <>
      {/* Header */}
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            Careers
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">
            Build the internet infrastructure East Africa deserves
          </h1>
          <p className="text-lg text-slate-400">
            We're a small, expert team moving fast. Every role here has real ownership, real impact, and room to grow.
          </p>
        </div>
      </section>

      {/* Why work here */}
      <section className="section-sm bg-white">
        <div className="container-default">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {values.map(v => (
              <div key={v.title} className="card p-5">
                <div className="text-2xl mb-3">{v.emoji}</div>
                <div className="font-bold text-[#0F172A] text-sm mb-2">{v.title}</div>
                <p className="text-xs text-slate-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open roles */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-12">
            <span className="eyebrow">Open Roles</span>
            <h2 className="text-3xl font-bold text-[#0F172A]">
              {openRoles.length} open position{openRoles.length !== 1 ? 's' : ''}
            </h2>
          </div>

          <div className="space-y-5 max-w-3xl mx-auto">
            {openRoles.map(role => (
              <div key={role.title} className="card p-7">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-bold text-[#0F172A] text-lg mb-1">{role.title}</h3>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" /> {role.team}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {role.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {role.location}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`mailto:careers@bazionweb.com?subject=Application: ${encodeURIComponent(role.title)}`}
                    className="btn-primary text-sm py-2 px-5 shrink-0"
                  >
                    Apply <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <p className="text-slate-500 text-sm mb-4 leading-relaxed">{role.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.skills.map(s => (
                    <span key={s} className="badge-slate text-xs">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-slate-500 text-sm mb-3">Don't see your role? We always want to hear from great people.</p>
            <Link href="mailto:careers@bazionweb.com" className="btn-secondary">
              Send an open application
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
