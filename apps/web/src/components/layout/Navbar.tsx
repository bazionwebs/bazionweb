'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, Globe, Shield, Wrench, Server, Zap, LifeBuoy, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const services = [
  { name: 'Website Development', href: '/services/development', icon: Globe, desc: 'Custom, responsive websites' },
  { name: 'Managed Hosting',     href: '/services/hosting',     icon: Server, desc: 'Fast, reliable cloud hosting' },
  { name: 'Maintenance',         href: '/services/maintenance', icon: Wrench, desc: 'Updates, patches, health checks' },
  { name: 'Security Management', href: '/services/security',    icon: Shield, desc: 'WAF, SSL, malware protection' },
  { name: 'Performance Optim.', href: '/services/performance', icon: Zap,    desc: 'Core Web Vitals & speed' },
  { name: '24/7 Support',       href: '/services/support',     icon: LifeBuoy, desc: 'SLA-backed technical support' },
];

const navLinks = [
  { name: 'About',       href: '/about' },
  { name: 'Services',    href: '/services', hasDropdown: true },
  { name: 'Pricing',     href: '/pricing' },
  { name: 'Case Studies',href: '/case-studies' },
  { name: 'Blog',        href: '/blog' },
];

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [servOpen,  setServOpen]  = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); setServOpen(false); }, [pathname]);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-card border-b border-slate-100'
          : 'bg-transparent',
      )}
    >
      <nav className="container-default flex items-center justify-between h-16 md:h-18">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-sm">B</span>
          </div>
          <span className={cn(
            'font-bold text-lg tracking-tight transition-colors',
            scrolled ? 'text-[#0F172A]' : 'text-white',
          )}>
            BazionWeb
          </span>
        </Link>

        {/* ── Desktop Links ── */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map(link => (
            link.hasDropdown ? (
              <div key={link.name} className="relative" onMouseEnter={() => setServOpen(true)} onMouseLeave={() => setServOpen(false)}>
                <button className={cn(
                  'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  scrolled ? 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50' : 'text-white/90 hover:text-white hover:bg-white/10',
                )}>
                  {link.name}
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', servOpen && 'rotate-180')} />
                </button>

                {servOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[520px]">
                    <div className="bg-white rounded-2xl shadow-card-xl border border-slate-100 p-4 grid grid-cols-2 gap-1">
                      {services.map(s => (
                        <Link
                          key={s.name}
                          href={s.href}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                            <s.icon className="w-4 h-4 text-[#2563EB]" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[#0F172A]">{s.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{s.desc}</div>
                          </div>
                        </Link>
                      ))}
                      <div className="col-span-2 mt-1 pt-3 border-t border-slate-100 flex items-center justify-between px-2">
                        <span className="text-xs text-slate-400">All services included in our plans</span>
                        <Link href="/services" className="text-xs font-semibold text-[#2563EB] flex items-center gap-1 hover:gap-2 transition-all">
                          View all <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.name}
                href={link.href}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === link.href
                    ? scrolled ? 'text-[#2563EB] bg-blue-50' : 'text-white bg-white/15'
                    : scrolled ? 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50' : 'text-white/90 hover:text-white hover:bg-white/10',
                )}
              >
                {link.name}
              </Link>
            )
          ))}
        </div>

        {/* ── Desktop CTA ── */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/portal"
            className={cn(
              'text-sm font-semibold px-4 py-2 rounded-xl transition-colors',
              scrolled ? 'text-slate-600 hover:text-[#2563EB]' : 'text-white/90 hover:text-white',
            )}
          >
            Client Portal
          </Link>
          <Link href="/contact" className="btn-primary text-sm px-5 py-2.5">
            Get Free Quote
          </Link>
        </div>

        {/* ── Mobile Hamburger ── */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className={cn(
            'lg:hidden p-2 rounded-lg transition-colors',
            scrolled ? 'text-[#0F172A] hover:bg-slate-100' : 'text-white hover:bg-white/10',
          )}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* ── Mobile Menu ── */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 shadow-card-lg">
          <div className="container-default py-4 flex flex-col gap-1">
            {navLinks.map(link => (
              <Link
                key={link.name}
                href={link.href}
                className={cn(
                  'px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'text-[#2563EB] bg-blue-50'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-[#2563EB]',
                )}
              >
                {link.name}
              </Link>
            ))}
            <div className="divider my-2" />
            <Link href="/portal" className="px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
              Client Portal
            </Link>
            <Link href="/contact" className="btn-primary mt-2 w-full justify-center">
              Get Free Quote
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
