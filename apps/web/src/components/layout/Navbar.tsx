'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ChevronDown,
  Globe,
  ShoppingCart,
  Cpu,
  Server,
  Shield,
  Building2,
  Church,
  GraduationCap,
  HeartHandshake,
  Rocket,
  Briefcase,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/Logo';
import NavbarCartLink from '@/components/layout/NavbarCartLink';

const serviceItems = [
  { name: 'Websites', href: '/services#websites', icon: Globe, desc: 'Starter, Business & Corporate' },
  { name: 'E-Commerce', href: '/services#ecommerce', icon: ShoppingCart, desc: 'Stores with M-Pesa & Card Rails' },
  { name: 'Custom Systems', href: '/services#custom-systems', icon: Cpu, desc: 'Portals, CRMs & Web Apps' },
  { name: 'Managed Technology', href: '/services#care', icon: Server, desc: 'Cloud Hosting & Proactive Care' },
  { name: 'Specialized Services', href: '/services#specialized', icon: Shield, desc: 'Security, Audits & Speed' },
];

const solutionItems = [
  { name: 'SMEs & Growing Businesses', href: '/solutions/smes', icon: Building2 },
  { name: 'Churches & Ministries', href: '/solutions/churches', icon: Church },
  { name: 'Schools & Education', href: '/solutions/education', icon: GraduationCap },
  { name: 'NGOs & Non-Profits', href: '/solutions/ngos', icon: HeartHandshake },
  { name: 'Startups & Product MVPs', href: '/solutions/startups', icon: Rocket },
  { name: 'Professional Services', href: '/solutions/professional-services', icon: Briefcase },
];

const companyItems = [
  { name: 'About BazionWeb', href: '/about', desc: 'Our mission, team & engineering culture' },
  { name: '6-Stage Process', href: '/process', desc: 'Transparent delivery from kickoff to launch' },
  { name: 'Security & Compliance', href: '/security', desc: 'Enterprise data safety & OWASP standards' },
  { name: 'Frequently Asked Questions', href: '/faq', desc: 'Clear answers on contracts and ownership' },
  { name: 'Contact Engineering', href: '/contact', desc: 'Direct inquiry & project consultations' },
];

const linkBase = 'px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150';
const linkIdle = 'text-slate-600 hover:text-[#0D9488] hover:bg-teal-50/70';
const linkActive = 'text-[#0D9488] bg-teal-50 font-bold';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
    setActiveDropdown(null);
  }, [pathname]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-xs border-b border-slate-200/80">
      <nav className="container-default flex items-center justify-between h-20">
        {/* ─── Logo ─── */}
        <div className="flex items-center shrink-0">
          <Logo variant="light" priority markClassName="h-10 md:h-12" textClassName="text-xl md:text-2xl font-black" />
        </div>

        {/* ─── Desktop Links ─── */}
        <div className="hidden lg:flex items-center gap-1 xl:gap-2">
          {/* Services Mega Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setActiveDropdown('services')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button
              className={cn(
                'flex items-center gap-1.5',
                linkBase,
                pathname?.startsWith('/services') || pathname?.startsWith('/solutions') ? linkActive : linkIdle,
              )}
              aria-expanded={activeDropdown === 'services'}
            >
              <span>Services</span>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform duration-200', activeDropdown === 'services' && 'rotate-180')}
              />
            </button>

            {activeDropdown === 'services' && (
              <div className="absolute top-full left-0 pt-2 w-[680px]">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-5 grid grid-cols-12 gap-5">
                  {/* Left Column: Core Engineering Services */}
                  <div className="col-span-7 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-3 mb-2">
                      Core Engineering Services
                    </span>
                    {serviceItems.map(item => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-teal-50/70 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 group-hover:bg-[#0D9488] transition-colors mt-0.5">
                            <Icon className="w-4 h-4 text-[#0D9488] group-hover:text-white transition-colors" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[#0F172A] group-hover:text-[#0D9488] transition-colors leading-tight">
                              {item.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Right Column: Industry Solutions */}
                  <div className="col-span-5 bg-slate-50/70 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-2 mb-2">
                        By Industry
                      </span>
                      <div className="space-y-0.5">
                        {solutionItems.map(item => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-[#0D9488] hover:bg-white transition-colors"
                            >
                              <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{item.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-200/60 px-2 flex items-center justify-between">
                      <Link
                        href="/solutions"
                        className="text-xs font-bold text-[#0D9488] hover:underline flex items-center gap-1"
                      >
                        All Sector Solutions <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="col-span-12 pt-3 border-t border-slate-100 flex items-center justify-between px-2">
                    <span className="text-xs text-slate-400">Fixed-price deliverables with post-launch defect warranties</span>
                    <Link
                      href="/services"
                      className="text-xs font-bold text-[#0D9488] flex items-center gap-1 hover:gap-1.5 transition-all"
                    >
                      View All Services Catalog <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pricing */}
          <Link href="/pricing" className={cn(linkBase, pathname === '/pricing' ? linkActive : linkIdle)}>
            Pricing
          </Link>

          {/* Process */}
          <Link href="/process" className={cn(linkBase, pathname === '/process' ? linkActive : linkIdle)}>
            Process
          </Link>

          {/* Work / Case Studies */}
          <Link href="/case-studies" className={cn(linkBase, pathname === '/case-studies' ? linkActive : linkIdle)}>
            Work
          </Link>

          {/* Company Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setActiveDropdown('company')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button
              className={cn(
                'flex items-center gap-1.5',
                linkBase,
                pathname === '/about' || pathname === '/security' || pathname === '/faq' ? linkActive : linkIdle,
              )}
              aria-expanded={activeDropdown === 'company'}
            >
              <span>Company</span>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform duration-200', activeDropdown === 'company' && 'rotate-180')}
              />
            </button>

            {activeDropdown === 'company' && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[280px]">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 flex flex-col gap-0.5">
                  {companyItems.map(item => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-[#0D9488] hover:bg-teal-50 transition-colors"
                    >
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-400 font-normal mt-0.5">{item.desc}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Desktop Actions Cluster (Clean & Streamlined) ─── */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            href="/portal"
            className="text-xs font-semibold px-3 py-2 text-slate-600 hover:text-[#0D9488] transition-colors"
          >
            Client Portal
          </Link>

          <NavbarCartLink />

          <Link
            href="/quote"
            className="btn-primary text-xs px-5 py-2.5 shadow-sm inline-flex items-center gap-1.5 font-bold"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-200" />
            <span>Get a Free Assessment</span>
          </Link>
        </div>

        {/* ─── Mobile Hamburger ─── */}
        <div className="lg:hidden flex items-center">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* ─── Mobile Navigation Menu ─── */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200/80 shadow-2xl max-h-[85vh] overflow-y-auto">
          <div className="container-default py-5 flex flex-col gap-1 text-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-1 pb-1">
              Core Services
            </div>
            {serviceItems.map(item => (
              <Link
                key={item.name}
                href={item.href}
                className="px-3 py-2 rounded-xl text-slate-700 hover:bg-teal-50 hover:text-[#0D9488] flex items-center justify-between"
              >
                <span className="font-semibold">{item.name}</span>
                <span className="text-[11px] text-slate-400">{item.desc}</span>
              </Link>
            ))}

            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-3 pb-1 border-t border-slate-100">
              Navigation
            </div>
            <Link href="/pricing" className="px-3 py-2 rounded-xl font-medium text-slate-800 hover:bg-slate-50">
              Pricing Book
            </Link>
            <Link href="/process" className="px-3 py-2 rounded-xl font-medium text-slate-800 hover:bg-slate-50">
              6-Stage Process
            </Link>
            <Link href="/case-studies" className="px-3 py-2 rounded-xl font-medium text-slate-800 hover:bg-slate-50">
              Work &amp; Case Studies
            </Link>
            <Link href="/about" className="px-3 py-2 rounded-xl font-medium text-slate-800 hover:bg-slate-50">
              About BazionWeb
            </Link>
            <Link href="/contact" className="px-3 py-2 rounded-xl font-medium text-slate-800 hover:bg-slate-50">
              Contact &amp; Inquiry
            </Link>

            <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col gap-2.5">
              <Link href="/portal" className="text-center py-2 text-xs font-semibold text-slate-600 hover:text-[#0D9488]">
                Existing Client Portal Login →
              </Link>
              <Link href="/quote" className="btn-primary w-full justify-center text-sm py-3 font-bold">
                Get a Free Assessment
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
