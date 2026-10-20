'use client';

import Link from 'next/link';
import { Globe, Shield, Wrench, Server, Zap, LifeBuoy, Twitter, Linkedin, Github, Mail, Phone, MapPin } from 'lucide-react';
import Logo from '@/components/ui/Logo';

const services = [
  { name: 'Website Development', href: '/services/development', icon: Globe },
  { name: 'Custom Systems & Portals', href: '/services#custom-systems', icon: Server },
  { name: 'Maintenance', href: '/services/maintenance', icon: Wrench },
  { name: 'Security Management', href: '/services/security', icon: Shield },
  { name: 'Performance Optim.', href: '/services/performance', icon: Zap },
  { name: '24/7 Support', href: '/services/support', icon: LifeBuoy },
];

const company = [
  { name: 'About Us', href: '/about' },
  { name: 'Our Process', href: '/process' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Case Studies', href: '/case-studies' },
  { name: 'Blog', href: '/blog' },
  { name: 'FAQ', href: '/faq' },
  { name: 'Careers', href: '/careers' },
  { name: 'System Status', href: 'https://status.bazionwebs.com' },
];

const legal = [
  { name: 'Terms of Service', href: '/legal/terms' },
  { name: 'Privacy Policy', href: '/legal/privacy' },
  { name: 'SLA', href: '/legal/sla' },
  { name: 'Cookie Policy', href: '/legal/cookies' },
  { name: 'Data Processing Agreement', href: '/legal/dpa' },
];

export default function Footer() {
  return (
    <footer className="relative bg-gradient-to-b from-[#374151] via-[#1F2937] to-[#111827] text-white border-t border-slate-600/50 shadow-2xl">
      {/* Main footer */}
      <div className="container-default py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Logo variant="dark" markClassName="h-14 w-auto" className="mb-6" />
            <p className="text-slate-300 text-sm leading-relaxed max-w-sm mb-6">
              Complete website lifecycle management for growing businesses.
              One provider, one invoice — development, custom systems, security, and ongoing support.
            </p>
            <div className="flex flex-col gap-2 mb-8">
              <a href="mailto:hello@bazionwebs.com" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm">
                <Mail className="w-4 h-4 shrink-0 text-[#14B8A6]" />
                hello@bazionwebs.com
              </a>
              <a href="tel:+254721287053" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm">
                <Phone className="w-4 h-4 shrink-0 text-[#14B8A6]" />
                +254 721 287 053
              </a>
              <span className="flex items-center gap-2 text-slate-300 text-sm">
                <MapPin className="w-4 h-4 shrink-0 text-[#14B8A6]" />
                Remote-first · Worldwide
              </span>
            </div>
            <div className="flex items-center gap-3">
              {[
                { icon: Twitter, href: 'https://twitter.com/bazionweb', label: 'Twitter' },
                { icon: Linkedin, href: 'https://linkedin.com/company/bazionweb', label: 'LinkedIn' },
                { icon: Github, href: 'https://github.com/bazionweb', label: 'GitHub' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <Icon className="w-4 h-4 text-slate-300 hover:text-white" />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-widest">Services</h3>
            <ul className="flex flex-col gap-2.5">
              {services.map(s => (
                <li key={s.name}>
                  <Link href={s.href} className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2">
                    <s.icon className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-widest">Company</h3>
            <ul className="flex flex-col gap-2.5">
              {company.map(l => (
                <li key={l.name}>
                  {l.href.startsWith('http') ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      {l.name}
                      {l.name === 'System Status' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] inline-block animate-pulse" />
                      )}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-sm text-slate-300 hover:text-white transition-colors">
                      {l.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-widest">Legal</h3>
            <ul className="flex flex-col gap-2.5">
              {legal.map(l => (
                <li key={l.name}>
                  <Link href={l.href} className="text-sm text-slate-300 hover:text-white transition-colors">
                    {l.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-default py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <a
              href="https://status.bazionwebs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors group"
            >
              <span className="w-2 h-2 rounded-full bg-[#22C55E] inline-block animate-pulse" />
              All systems operational
              <span className="text-slate-400 group-hover:text-slate-300 transition-colors">· status.bazionwebs.com</span>
            </a>
          </div>

          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} BazionWeb. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
