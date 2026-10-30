import Link from 'next/link';
import { LifeBuoy, ArrowRight, Clock, Users, FileText, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Technical Support & Incident Escalation Services',
  description: 'Fast technical support with systems engineers. Urgent P1 incident response, direct communication channels, and proactive issue resolution.',
  alternates: { canonical: 'https://bazionweb.com/services/support' },
};

const priorities = [
  { level: 'P1', label: 'Critical', def: 'Site completely down or payment processing broken', color: 'badge-red', times: ['1 hr', '30 min', '15 min', '5 min'] },
  { level: 'P2', label: 'High',     def: 'Major feature broken; significant user impact',     color: 'badge-yellow', times: ['4 hrs', '2 hrs', '1 hr', '30 min'] },
  { level: 'P3', label: 'Normal',   def: 'Minor feature broken; workaround available',        color: 'badge-blue', times: ['1 day', '4 hrs', '4 hrs', '2 hrs'] },
  { level: 'P4', label: 'Low',      def: 'Cosmetic issue; general question; enhancement',     color: 'badge-slate', times: ['2 days', '1 day', '8 hrs', '4 hrs'] },
];

const channels = [
  { icon: MessageSquare, title: 'Support tickets',    desc: 'Zammad-powered ticket system via your client portal. Full history, attachments, internal notes, and SLA tracking.' },
  { icon: FileText,      title: 'Monthly SLA report', desc: 'Every month you receive a report showing response times vs SLA targets for every ticket you raised.' },
  { icon: Users,         title: 'Real engineers',     desc: 'Every ticket is handled by a trained engineer — not a tier-1 call centre agent reading from a script.' },
  { icon: AlertTriangle, title: 'Escalation matrix',  desc: 'P1 tickets auto-escalate to senior engineers if not acknowledged within the SLA window. No ticket falls through the cracks.' },
  { icon: CheckCircle,   title: 'Post-incident RCA',  desc: 'Every P1 incident gets a Root Cause Analysis delivered within 48 hours of resolution.' },
  { icon: Clock,         title: 'SLA enforcement',    desc: 'SLA breaches auto-trigger service credits applied to your next invoice — you don\'t have to ask.' },
];

export default function SupportPage() {
  const plans = ['Starter', 'Growth', 'Business', 'Enterprise'];
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Technical Support & Incident Response',
          description: 'Real systems engineers, SLA-backed P1 emergency response, proactive monitoring, and direct escalation. No chatbots, no ticket black holes.',
          url: 'https://bazionweb.com/services/support',
          provider: { '@type': 'Organization', '@id': 'https://bazionweb.com/#organization', name: 'BazionWeb' },
          areaServed: ['Kenya', 'Worldwide'],
          offers: [
            { '@type': 'Offer', name: 'Support – Growth Plan (Kenya)', price: '8000', priceCurrency: 'KES', url: 'https://bazionweb.com/pricing' },
            { '@type': 'Offer', name: 'Support – Growth Plan (International)', price: '79', priceCurrency: 'USD', url: 'https://bazionweb.com/pricing' },
          ],
        }}
      />
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Services', href: '/services' }, { name: '24/7 Technical Support' }]} />
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-6">
            <LifeBuoy className="w-6 h-6 text-green-400" />
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Service</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">24/7 Technical Support</h1>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl">
            Real engineers. SLA-backed response times. No bots, no runarounds, no &ldquo;have you tried turning it off and on again.&rdquo; When something breaks, we own it.
          </p>
          <Link href="/contact" className="btn-primary px-7 py-3">
            Talk to a human <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Response time SLAs by priority</h2>
            <p className="text-slate-500 text-sm">Response time = time to first meaningful reply from an engineer</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-[var(--shadow-card)]">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-[#0F172A]">
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wide">Priority</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wide w-56">Situation</th>
                  {plans.map(p => (
                    <th key={p} className="text-center px-4 py-4 text-sm font-bold text-white">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {priorities.map(row => (
                  <tr key={row.level} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <span className={`badge ${row.color} mr-2`}>{row.level}</span>
                      <span className="text-xs text-slate-400">{row.label}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-xs">{row.def}</td>
                    {row.times.map((t, i) => (
                      <td key={i} className="px-4 py-4 text-center text-sm font-semibold text-[#0F172A]">{t}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-default">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">How our support works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {channels.map(c => (
              <div key={c.title} className="card p-6">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-4">
                  <c.icon className="w-5 h-5 text-[#22C55E]" />
                </div>
                <h3 className="font-bold text-[#0F172A] mb-2 text-sm">{c.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm bg-[#0F172A]">
        <div className="container-default text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-3">Support is included in every plan</h2>
          <p className="text-slate-400 mb-6 text-sm">Included in Care Essential (KSh 5,000 / $75/mo) and above, or on-demand at KSh 3,500/hr ($50/hr).</p>
          <div className="flex gap-3 justify-center">
            <Link href="/pricing" className="btn-primary px-7">View SLA by plan <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition-all">Submit a ticket</Link>
          </div>
        </div>
      </section>
    </>
  );
}
