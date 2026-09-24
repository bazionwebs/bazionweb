import Link from 'next/link';
import { Shield, Check, ArrowRight, Lock, Eye, AlertTriangle, FileSearch, RefreshCw, Bell } from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Security Management',
  description: 'Proactive WAF, malware scanning, SSL monitoring, and security audits. We manage your website security before it becomes a crisis.',
  alternates: { canonical: 'https://bazionweb.com/services/security' },
};

const layers = [
  { icon: Shield,       title: 'WAF (Web Application Firewall)',  desc: 'ModSecurity + Cloudflare WAF rules block SQLi, XSS, and OWASP Top 10 attacks before they reach your server.' },
  { icon: Eye,          title: 'Weekly Malware Scanning',         desc: 'Automated malware detection scans every 7 days. Infected files quarantined and reported immediately.' },
  { icon: Lock,         title: 'SSL Monitoring & Rotation',       desc: 'SSL certificates monitored for expiry. Auto-renewed via Let\'s Encrypt. Manual escalation for Cloudflare certificates.' },
  { icon: AlertTriangle,'title': 'Intrusion Prevention (Fail2Ban)', desc: 'Fail2Ban blocks IPs after repeated failed login attempts. SSH hardened with key-only access and non-standard ports.' },
  { icon: FileSearch,   title: 'Monthly Security Audit',          desc: 'OWASP-aligned review of headers, permissions, dependencies, and access logs. Findings reported with severity ratings.' },
  { icon: RefreshCw,    title: 'Patch Management',                desc: 'Critical CVEs patched within 72 hours. Security-only patches applied out-of-cycle without waiting for monthly maintenance.' },
  { icon: Bell,         title: 'Incident Response',               desc: 'Documented IRP with P1 escalation: contain, eradicate, recover, report. Post-incident RCA delivered within 48 hours.' },
];

export default function SecurityPage() {
  return (
    <>
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Services', href: '/services' }, { name: 'Security Management' }]} />
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-6">
            <Shield className="w-6 h-6 text-red-400" />
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Service</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">Security Management</h1>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl">
            Multi-layer, proactive security — WAF, malware scanning, intrusion prevention, SSL management, and monthly audits. We handle it so you don&apos;t find out about problems after the fact.
          </p>
          <Link href="/contact?service=security" className="btn-primary px-7 py-3">
            Secure your website <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">7 layers of website security</h2>
            <p className="text-slate-500">Each layer addresses a different attack vector. Together they cover the full OWASP Top 10.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {layers.map((l) => (
              <div key={l.title} className="card p-6 flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                  <l.icon className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <div className="font-bold text-[#0F172A] mb-1 text-sm">{l.title}</div>
                  <p className="text-xs text-slate-500 leading-relaxed">{l.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-default max-w-3xl mx-auto">
          <div className="bg-[#0F172A] rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-5">What we monitor, 24/7</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                'SSL certificate validity', 'Failed login attempts', 'WAF rule triggers',
                'Malware signatures', 'File integrity changes', 'Uptime & response codes',
                'Database query anomalies', 'Backup completion status',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" /> {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-sm bg-[#F8FAFC]">
        <div className="container-default text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-3">Security management from $59/mo</h2>
          <p className="text-slate-500 mb-6 text-sm">Included in Growth+ plans. Or available as a standalone security audit add-on from $99.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/pricing" className="btn-primary px-7">See plans <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/contact?service=security" className="btn-secondary px-7">Book audit</Link>
          </div>
        </div>
      </section>
    </>
  );
}
