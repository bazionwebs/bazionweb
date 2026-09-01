import Link from 'next/link';
import {
  Globe, Server, Wrench, Shield, Zap, LifeBuoy,
  ArrowRight, Check
} from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Complete website lifecycle management: development, hosting, maintenance, security, performance, and 24/7 support.',
};

const services = [
  {
    id: 'development',
    icon: Globe,
    name: 'Website Development',
    tagline: 'Custom-built. Launch-ready. Built to last.',
    desc: 'We design and build responsive, CMS-integrated websites on modern Next.js. Every site we build scores 95+ on Lighthouse on day one.',
    deliverables: [
      'Discovery & wireframes',
      'UI/UX design (Figma)',
      'Next.js development',
      'CMS integration (Strapi)',
      'SEO-ready architecture',
      'QA & launch support',
    ],
    from: 'From $800 one-time',
    accent: '#2563EB',
    bg: 'bg-blue-50',
    textColor: 'text-[#2563EB]',
  },
  {
    id: 'hosting',
    icon: Server,
    name: 'Managed Cloud Hosting',
    tagline: 'Infrastructure you never have to think about.',
    desc: 'Cloud-hosted on enterprise infrastructure with Cloudflare CDN, automated SSL, daily backups, and real-time uptime monitoring.',
    deliverables: [
      'Cloud server provisioning',
      'Cloudflare CDN + DDoS protection',
      'Auto SSL (Let\'s Encrypt)',
      'Daily encrypted backups',
      'Uptime monitoring (Kuma)',
      'Monthly uptime reports',
    ],
    from: 'Included in all plans',
    accent: '#14B8A6',
    bg: 'bg-teal-50',
    textColor: 'text-[#14B8A6]',
  },
  {
    id: 'maintenance',
    icon: Wrench,
    name: 'Website Maintenance',
    tagline: 'Always updated. Never neglected.',
    desc: 'Monthly software updates, CMS and plugin patches, content refreshes, and a comprehensive health check — all documented and reported.',
    deliverables: [
      'CMS core updates',
      'Plugin/theme updates',
      'Content updates (Growth+)',
      'Broken link checks',
      'Monthly health report',
      'Change log delivery',
    ],
    from: 'Included in Growth+',
    accent: '#8B5CF6',
    bg: 'bg-purple-50',
    textColor: 'text-purple-600',
  },
  {
    id: 'security',
    icon: Shield,
    name: 'Security Management',
    tagline: 'Proactive security before it becomes a crisis.',
    desc: 'WAF rules, malware scanning, SSL lifecycle management, security audits and incident response — all handled without you lifting a finger.',
    deliverables: [
      'WAF (ModSecurity + Cloudflare)',
      'Weekly malware scans',
      'SSL monitoring & rotation',
      'Fail2Ban intrusion prevention',
      'Monthly security report',
      'Incident response plan',
    ],
    from: 'Included in Growth+',
    accent: '#EF4444',
    bg: 'bg-red-50',
    textColor: 'text-red-600',
  },
  {
    id: 'performance',
    icon: Zap,
    name: 'Performance Optimization',
    tagline: 'Faster pages. Better rankings. More conversions.',
    desc: 'Core Web Vitals improvements, image optimization, aggressive caching strategies, and CDN tuning — with before/after Lighthouse proof.',
    deliverables: [
      'Core Web Vitals audit',
      'Image optimization pipeline',
      'Browser caching config',
      'CDN tuning & preloading',
      'Database query review',
      'Before/after Lighthouse report',
    ],
    from: 'Included in Business+',
    accent: '#F59E0B',
    bg: 'bg-yellow-50',
    textColor: 'text-yellow-600',
  },
  {
    id: 'support',
    icon: LifeBuoy,
    name: '24/7 Technical Support',
    tagline: 'Real engineers. Real SLAs. Real accountability.',
    desc: 'SLA-backed support via tickets and email. Every plan has defined response targets — and we track against them in your monthly report.',
    deliverables: [
      'Zammad ticket system',
      'SLA response targets',
      'P1–P4 severity classification',
      'Escalation matrix',
      'Monthly SLA report',
      'Incident post-mortems (P1)',
    ],
    from: 'Included in all plans',
    accent: '#22C55E',
    bg: 'bg-green-50',
    textColor: 'text-green-600',
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Header */}
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
              Our Services
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Everything your website needs — under one roof
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Six service lines, fully integrated. We own the complete website lifecycle so you can focus on running your business.
            </p>
          </div>
        </div>
      </section>

      {/* Service cards */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default space-y-10">
          {services.map((s, i) => (
            <div
              key={s.id}
              id={s.id}
              className={`card p-8 md:p-10 grid grid-cols-1 lg:grid-cols-5 gap-8 items-start ${
                i % 2 !== 0 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              {/* Content */}
              <div className="lg:col-span-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-5 h-5 ${s.textColor}`} />
                  </div>
                  <div>
                    <div className="font-bold text-[#0F172A] text-lg">{s.name}</div>
                    <div className={`text-sm font-medium ${s.textColor}`}>{s.tagline}</div>
                  </div>
                </div>
                <p className="text-slate-500 leading-relaxed mb-5">{s.desc}</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500 mb-6">
                  {s.from}
                </div>
                <Link href={`/contact?service=${s.id}`} className="btn-primary inline-flex">
                  Get started with {s.name.split(' ')[0].toLowerCase()}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Deliverables */}
              <div className="lg:col-span-2">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">What's delivered</div>
                  <ul className="space-y-2.5">
                    {s.deliverables.map(d => (
                      <li key={d} className="flex items-center gap-2 text-sm text-slate-600">
                        <Check className="w-4 h-4 shrink-0" style={{ color: s.accent }} />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Service integration callout */}
      <section className="section bg-[#0F172A]">
        <div className="container-default max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            How It All Fits Together
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            All six services work as one
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed mb-10">
            Unlike piecing together multiple providers, every BazionWeb service shares the same monitoring, the same incident response, and the same client portal. When your security team spots a threat, your maintenance team already knows. When your performance drops, your support team is alerted automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pricing" className="btn-primary px-8 py-4">
              See Plan Options
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/contact" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition-all duration-200">
              Get Free Assessment
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
