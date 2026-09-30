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
import { useMarketPreference } from '@/hooks/useMarketPreference';

const serviceItems = [
  { name: 'Websites', href: '/services#websites', icon: Globe, desc: 'Starter, Business & Corporate' },
  { name: 'E-Commerce', href: '/services#ecommerce', icon: ShoppingCart, desc: 'M-Pesa STK & Card Checkout' },
  { name: 'Custom Systems', href: '/services#custom-systems', icon: Cpu, desc: 'Portals, CRMs & Web Apps' },
  { name: 'Managed Technology', href: '/services#care', icon: Server, desc: 'Cloud Hosting & Care Plans' },
  { name: 'Specialized Services', href: '/services#specialized', icon: Shield, desc: 'Audits, Migrations & Speed' },
];

const solutionItems = [
  { name: 'SMEs & Growing Businesses', href: '/solutions/smes', icon: Building2, desc: 'Lead generation & brand authority' },
  { name: 'Churches & Ministries', href: '/solutions/churches', icon: Church, desc: 'M-Pesa giving & sermon archives' },
  { name: 'Schools & Education', href: '/solutions/education', icon: GraduationCap, desc: 'Student portals & fee ledgers' },
  { name: 'NGOs & Non-Profits', href: '/solutions/ngos', icon: HeartHandshake, desc: 'Donor transparency & compliance' },
  { name: 'Startups & Product MVPs', href: '/solutions/startups', icon: Rocket, desc: 'Rapid 4-week MVP development' },
  { name: 'Professional Services', href: '/solutions/professional-services', icon: Briefcase, desc: 'Legal, medical & consulting firms' },
];

const companyItems = [
  { name: 'About BazionWeb', href: '/about' },
  { name: 'Security & Compliance', href: '/security' },
  { name: 'Frequently Asked Questions', href: '/faq' },
  { name: 'Contact Engineering', href: '/contact' },
];

const linkBase = 'px-3 py-2 rounded-lg text-sm font-medium transition-colors';
const linkIdle = 'text-slate-600 hover:text-[#0D9488] hover:bg-teal-50/70';
const linkActive = 'text-[#0D9488] bg-teal-50 font-semibold';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const pathname = usePathname();
  const { market, setMarket } = useMarketPreference();

  useEffect(() => {
    setMenuOpen(false);
    setActiveDropdown(null);
  }, [pathname]);

  const toggleMarket = () => {
    setMarket(market === 'kenya' ? 'international' : 'kenya');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-xs border-b border-slate-200/80">
      <nav className="container-default flex items-center justify-between h-20 md:h-24">
        {/* ─── Logo ─── */}
        <Logo variant="light" priority markClassName="h-16" textClassName="text-2xl" />

        {/* ─── Desktop Links ─── */}
        <div className="hidden xl:flex items-center gap-1">
          {/* Services Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setActiveDropdown('services')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button
              className={cn(
                'flex items-center gap-1',
                linkBase,
                pathname?.startsWith('/services') ? linkActive : linkIdle,
              )}
            >
              <span>Services</span>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform duration-200', activeDropdown === 'services' && 'rotate-180')}
              />
            </button>

            {activeDropdown === 'services' && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[540px]">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 grid grid-cols-2 gap-2">
                  {serviceItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-teal-50/60 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 group-hover:bg-[#0D9488] transition-colors">
                          <Icon className="w-4 h-4 text-[#0D9488] group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#0F172A] group-hover:text-[#0D9488] transition-colors">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                        </div>
                      </Link>
                    );
                  })}
                  <div className="col-span-2 mt-1 pt-3 border-t border-slate-100 flex items-center justify-between px-2">
                    <span className="text-xs text-slate-400">All 5 Core Service Families</span>
                    <Link
                      href="/services"
                      className="text-xs font-semibold text-[#0D9488] flex items-center gap-1 hover:gap-1.5 transition-all"
                    >
                      View All Services <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Solutions Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setActiveDropdown('solutions')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button
              className={cn(
                'flex items-center gap-1',
                linkBase,
                pathname?.startsWith('/solutions') ? linkActive : linkIdle,
              )}
            >
              <span>Solutions</span>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform duration-200', activeDropdown === 'solutions' && 'rotate-180')}
              />
            </button>

            {activeDropdown === 'solutions' && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[580px]">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 grid grid-cols-2 gap-2">
                  {solutionItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-teal-50/60 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 group-hover:bg-[#0D9488] transition-colors">
                          <Icon className="w-4 h-4 text-[#0D9488] group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#0F172A] group-hover:text-[#0D9488] transition-colors">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                        </div>
                      </Link>
                    );
                  })}
                  <div className="col-span-2 mt-1 pt-3 border-t border-slate-100 flex items-center justify-between px-2">
                    <span className="text-xs text-slate-400">Tailored by organizational sector</span>
                    <Link
                      href="/solutions"
                      className="text-xs font-semibold text-[#0D9488] flex items-center gap-1 hover:gap-1.5 transition-all"
                    >
                      All Solutions Overview <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Direct Nav Links */}
          <Link href="/pricing" className={cn(linkBase, pathname === '/pricing' ? linkActive : linkIdle)}>
            Pricing
          </Link>
          <Link href="/process" className={cn(linkBase, pathname === '/process' ? linkActive : linkIdle)}>
            Process
          </Link>
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
                'flex items-center gap-1',
                linkBase,
                pathname === '/about' || pathname === '/security' || pathname === '/faq' ? linkActive : linkIdle,
              )}
            >
              <span>Company</span>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform duration-200', activeDropdown === 'company' && 'rotate-180')}
              />
            </button>

            {activeDropdown === 'company' && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[240px]">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 flex flex-col gap-0.5">
                  {companyItems.map(item => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-[#0D9488] hover:bg-teal-50 transition-colors"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Desktop Actions Cluster ─── */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Currency / Market Toggle Pill */}
          <button
            onClick={toggleMarket}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 hover:border-slate-300 bg-slate-50 transition-colors"
            title="Toggle between Kenya (KES) and International (USD) pricing"
            aria-label="Toggle currency"
          >
            <span className={market === 'kenya' ? 'text-[#0D9488]' : 'text-slate-400'}>🇰🇪 KES</span>
            <span className="text-slate-300">|</span>
            <span className={market === 'international' ? 'text-[#0D9488]' : 'text-slate-400'}>🌍 USD</span>
          </button>

          <Link
            href="/portal"
            className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-600 hover:text-[#0D9488] transition-colors"
          >
            Client Portal
          </Link>

          <Link
            href="/quote"
            className="btn-primary text-xs px-5 py-2.5 shadow-sm inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-200" />
            <span>Get a Free Assessment</span>
          </Link>
        </div>

        {/* ─── Mobile Hamburger ─── */}
        <div className="lg:hidden flex items-center gap-2">
          <button
            onClick={toggleMarket}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-slate-200 bg-slate-50"
          >
            <span>{market === 'kenya' ? '🇰🇪 KES' : '🌍 USD'}</span>
          </button>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-2 rounded-lg text-[#0F172A] hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-[#0F172A]" />}
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
                <span>{item.name}</span>
                <span className="text-[11px] text-slate-400">{item.desc}</span>
              </Link>
            ))}

            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-3 pb-1 border-t border-slate-100">
              Industry Solutions
            </div>
            {solutionItems.map(item => (
              <Link
                key={item.name}
                href={item.href}
                className="px-3 py-2 rounded-xl text-slate-700 hover:bg-teal-50 hover:text-[#0D9488]"
              >
                {item.name}
              </Link>
            ))}

            <div className="divider my-2" />

            <Link href="/pricing" className="px-3 py-2.5 rounded-xl font-medium text-slate-800">
              Pricing Book
            </Link>
            <Link href="/process" className="px-3 py-2.5 rounded-xl font-medium text-slate-800">
              6-Stage Process
            </Link>
            <Link href="/case-studies" className="px-3 py-2.5 rounded-xl font-medium text-slate-800">
              Work & Case Studies
            </Link>
            <Link href="/about" className="px-3 py-2.5 rounded-xl font-medium text-slate-800">
              About BazionWeb
            </Link>
            <Link href="/contact" className="px-3 py-2.5 rounded-xl font-medium text-slate-800">
              Contact & Inquiry
            </Link>

            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <Link href="/portal" className="text-center py-2 text-xs font-semibold text-slate-600 hover:text-[#0D9488]">
                Existing Client Portal Login →
              </Link>
              <Link href="/quote" className="btn-primary w-full justify-center text-sm py-3">
                Get a Free Assessment
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
