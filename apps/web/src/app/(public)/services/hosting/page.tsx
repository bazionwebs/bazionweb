import Link from 'next/link';
import { Server, ArrowRight, Shield, RefreshCw, Activity, Clock, HardDrive, Globe2 } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Managed Cloud Hosting',
  description: 'Enterprise cloud hosting with 99.95% uptime SLA, Cloudflare CDN, auto SSL, and daily encrypted backups. Fully managed — zero config required.',
};

const features = [
  { icon: Activity,   title: '99.95% Uptime SLA',        desc: 'Monitored every 60 seconds by Uptime Kuma. Service credits issued automatically for any breach.' },
  { icon: Globe2,     title: 'Cloudflare CDN + DDoS',    desc: 'Global CDN with DDoS protection, smart caching, and WAF rules out of the box.' },
  { icon: Shield,     title: 'Auto SSL (Let\'s Encrypt)', desc: 'SSL issued, renewed, and monitored automatically. You will never see an expired certificate warning.' },
  { icon: HardDrive,  title: 'Daily Encrypted Backups',  desc: 'AES-256 encrypted backups stored off-site on Backblaze B2. 30-day retention on Starter, up to 365 days on Enterprise.' },
  { icon: RefreshCw,  title: 'Zero-downtime Deploys',    desc: 'Rolling container restarts with health checks ensure your site stays live during every update.' },
  { icon: Clock,      title: 'Real-time Monitoring',     desc: 'Grafana dashboards, Loki log aggregation, and instant alerting to our on-call team.' },
];

const specs = [
  ['Infrastructure',  'Oracle Cloud / Hetzner Cloud (Nairobi + Frankfurt)'],
  ['Web server',      'Nginx (via Nginx Proxy Manager)'],
  ['Runtime',         'Node.js 20 LTS / PHP 8.3 / Python 3.12'],
  ['Database',        'PostgreSQL 16 (managed, automated backups)'],
  ['Cache',           'Redis 7 (session + application cache)'],
  ['CDN',             'Cloudflare (global PoPs, smart caching)'],
  ['SSL',             "Let's Encrypt auto-renew + Cloudflare Universal SSL"],
  ['Backups',         'Backblaze B2 — AES-256, daily, off-site'],
  ['Monitoring',      'Uptime Kuma + Grafana + Loki'],
  ['Status page',     'status.bazionweb.com (public)'],
];

export default function HostingPage() {
  return (
    <>
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-3xl">
          <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center mb-6">
            <Server className="w-6 h-6 text-[#14B8A6]" />
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Service</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">Managed Cloud Hosting</h1>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl">
            Enterprise-grade infrastructure with a 99.95% uptime SLA, Cloudflare CDN, auto-renewing SSL, and daily encrypted backups — fully managed so you never touch a server.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/pricing" className="btn-primary px-7 py-3">
              View plans <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="https://status.bazionweb.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition-all">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              Live status
            </Link>
          </div>
        </div>
      </section>

      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">Everything included in managed hosting</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <div key={f.title} className="card p-6">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-[#14B8A6]" />
                </div>
                <h3 className="font-bold text-[#0F172A] mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-default max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-8">Infrastructure specifications</h2>
          <div className="card overflow-hidden">
            <table className="min-w-full">
              <tbody className="divide-y divide-slate-50">
                {specs.map(([label, value]) => (
                  <tr key={label} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 text-sm font-semibold text-slate-500 w-40">{label}</td>
                    <td className="px-6 py-3.5 text-sm text-[#0F172A]">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-sm bg-[#0F172A]">
        <div className="container-default text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-3">Hosting is included in every plan</h2>
          <p className="text-slate-400 mb-6 text-sm">Starting from $49/mo — no setup fees, cancel any time.</p>
          <Link href="/pricing" className="btn-primary px-8">See pricing <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>
    </>
  );
}
