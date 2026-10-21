import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Careers & Engineering Opportunities',
  description: 'Join the BazionWeb engineering team. We are building the most dependable web and digital systems partner for growing businesses worldwide.',
  alternates: { canonical: 'https://bazionweb.com/careers' },
};

const values = [
  { emoji: '🏗️', title: 'Build something real', desc: 'We\'re building production infrastructure used by real businesses. Your work ships fast and matters.' },
  { emoji: '📈', title: 'Grow with us', desc: 'We\'re early-stage and scaling. Strong performers get equity-like upside as the team grows.' },
  { emoji: '🌍', title: 'Global-first', desc: 'We\'re building a world-class managed services company — global quality, remote-first roots.' },
  { emoji: '🔒', title: 'Security culture', desc: 'Security isn\'t a checkbox here. It\'s how we think and build, from day one.' },
];

export default function CareersPage() {
  return (
    <>
      {/* Header */}
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-2xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Careers' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            Careers
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">
            Build the internet infrastructure businesses deserve
          </h1>
          <p className="text-lg text-slate-400">
            We&apos;re a small, expert team moving fast. Every role here has real ownership, real impact, and room to grow.
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
          <div className="text-center mb-8">
            <span className="eyebrow">Open Roles</span>
            <h2 className="text-3xl font-bold text-[#0F172A]">
              No open positions right now
            </h2>
          </div>

          <div className="text-center max-w-xl mx-auto">
            <p className="text-slate-500 text-sm mb-6">
              Our team is complete for now — but great people are always welcome.
              Send an open application and we&apos;ll reach out when a fitting role opens.
            </p>
            <Link href="mailto:careers@bazionweb.com" className="btn-secondary">
              Send an open application
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
