'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Market,
  WEBSITE_PACKAGES,
  ECOMMERCE_PACKAGES,
  CUSTOM_SYSTEM_TIERS,
  HOSTING_PLANS,
  CARE_PLANS,
} from '@/lib/pricingData';
import MarketToggle from '@/components/ui/MarketToggle';
import AddonPriceCard from '@/components/pricing/AddonPriceCard';
import PricingPrinciplesSection from '@/components/pricing/PricingPrinciplesSection';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import {
  Check,
  ArrowRight,
  Globe,
  ShoppingCart,
  Cpu,
  Server,
  Wrench,
  HelpCircle,
} from 'lucide-react';

type TabKey = 'websites' | 'ecommerce' | 'custom' | 'hosting-care' | 'addons';

export default function PricingView() {
  const [market, setMarket] = useState<Market>('kenya');
  const [activeTab, setActiveTab] = useState<TabKey>('websites');

  return (
    <>
      {/* ─── Hero Section with Market Switcher ─── */}
      <section className="section bg-[#0F172A] pt-32 pb-20 text-white">
        <div className="container-default text-center max-w-4xl mx-auto">
          <div className="flex justify-center mb-4">
            <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Pricing Architecture' }]} />
          </div>

          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            2026 Commercial Price Book
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Transparent pricing, tailored to your market
          </h1>

          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Accessible professional development in Kenya and dedicated engineering partnerships globally.
            Every quotation backed by transparent scope, client ownership, and post-launch warranties.
          </p>

          {/* Interactive Market Switcher */}
          <MarketToggle currentMarket={market} onChange={setMarket} className="mb-6" />
        </div>
      </section>

      {/* ─── Category Navigation Tabs ─── */}
      <section className="sticky top-20 md:top-24 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="container-default py-3">
          <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'websites', label: 'Websites', icon: Globe },
              { id: 'ecommerce', label: 'E-Commerce', icon: ShoppingCart },
              { id: 'custom', label: 'Custom Digital Systems', icon: Cpu },
              { id: 'hosting-care', label: 'Managed Hosting & Care', icon: Server },
              { id: 'addons', label: 'Add-On Price Card', icon: Wrench },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabKey)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Main Content Area ─── */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          {/* TAB 1: WEBSITES */}
          {activeTab === 'websites' && (
            <div className="space-y-12">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-3">
                  Business & Organizational Websites
                </h2>
                <p className="text-sm text-slate-500">
                  Built on modern Next.js with CMS integration, SEO readiness, and verified Lighthouse 95+ performance.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {WEBSITE_PACKAGES.map(pkg => {
                  const price = market === 'kenya' ? pkg.kenyaPrice : pkg.intlPrice;
                  return (
                    <div
                      key={pkg.id}
                      className={`relative bg-white rounded-2xl border-2 p-7 flex flex-col transition-all hover:shadow-xl ${
                        pkg.popular
                          ? 'border-[#2563EB] shadow-[0_0_0_4px_rgba(37,99,235,0.08)]'
                          : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      {pkg.badge && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                          <span className={`text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider ${
                            pkg.popular ? 'bg-[#2563EB] text-white' : 'bg-[#0F172A] text-white'
                          }`}>
                            {pkg.badge}
                          </span>
                        </div>
                      )}

                      <div className="mb-6">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {pkg.name}
                        </div>
                        <div className="text-3xl font-black text-[#0F172A] mb-2 tracking-tight">
                          {price}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed min-h-[3rem]">
                          {pkg.description}
                        </p>
                      </div>

                      {/* Scope parameters */}
                      <div className="space-y-2 mb-6 pb-6 border-b border-slate-100 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Pages</span>
                          <span className="font-semibold text-[#0F172A]">{pkg.pages}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Turnaround</span>
                          <span className="font-semibold text-[#0F172A]">{pkg.timeline}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Revisions</span>
                          <span className="font-semibold text-[#0F172A]">{pkg.revisions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Warranty</span>
                          <span className="font-semibold text-emerald-600">{pkg.support}</span>
                        </div>
                      </div>

                      {/* Deliverables list */}
                      <div className="space-y-2.5 mb-8 flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          What&apos;s Included:
                        </div>
                        {pkg.deliverables.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 leading-tight">
                            <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto">
                        <Link
                          href={`${pkg.ctaHref}&market=${market}`}
                          className={pkg.popular ? 'btn-primary w-full justify-center text-xs' : 'btn-secondary w-full justify-center text-xs'}
                        >
                          {pkg.ctaText}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: E-COMMERCE */}
          {activeTab === 'ecommerce' && (
            <div className="space-y-12">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-3">
                  Online Stores & E-Commerce Platforms
                </h2>
                <p className="text-sm text-slate-500">
                  Transactional stores with instant M-Pesa STK Push, international card gateways, stock management, and SEO conversion tuning.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {ECOMMERCE_PACKAGES.map(pkg => {
                  const price = market === 'kenya' ? pkg.kenyaPrice : pkg.intlPrice;
                  return (
                    <div
                      key={pkg.id}
                      className={`relative bg-white rounded-2xl border-2 p-8 flex flex-col transition-all hover:shadow-xl ${
                        pkg.popular
                          ? 'border-[#2563EB] shadow-[0_0_0_4px_rgba(37,99,235,0.08)]'
                          : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      {pkg.badge && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                          <span className={`text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider ${
                            pkg.popular ? 'bg-[#2563EB] text-white' : 'bg-[#0F172A] text-white'
                          }`}>
                            {pkg.badge}
                          </span>
                        </div>
                      )}

                      <div className="mb-6">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {pkg.name}
                        </div>
                        <div className="text-3xl font-black text-[#0F172A] mb-2 tracking-tight">
                          {price}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {pkg.description}
                        </p>
                      </div>

                      <div className="space-y-2 mb-6 pb-6 border-b border-slate-100 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Scale</span>
                          <span className="font-semibold text-[#0F172A]">{pkg.products}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Post-Launch Warranty</span>
                          <span className="font-semibold text-emerald-600">{pkg.support}</span>
                        </div>
                      </div>

                      <div className="space-y-2.5 mb-8 flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          E-Commerce Features:
                        </div>
                        {pkg.features.map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 leading-tight">
                            <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto">
                        <Link
                          href={`${pkg.ctaHref}&market=${market}`}
                          className={pkg.popular ? 'btn-primary w-full justify-center text-xs' : 'btn-secondary w-full justify-center text-xs'}
                        >
                          {pkg.ctaText}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM DIGITAL SYSTEMS */}
          {activeTab === 'custom' && (
            <div className="space-y-12">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-3">
                  Custom Digital Systems & Portals
                </h2>
                <p className="text-sm text-slate-500">
                  We don&apos;t sell custom software by &quot;pages.&quot; We engineer systems through rigorous discovery, architecture, database modeling, and milestone delivery.
                </p>
              </div>

              {/* Discovery callout banner */}
              <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-[#0F172A] text-white rounded-2xl p-8 border border-blue-800/40">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="max-w-2xl">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6] mb-2 block">
                      Phase 01 — Mandatory Discovery & Specification
                    </span>
                    <h3 className="text-2xl font-extrabold mb-2">
                      Discovery & Technical Blueprint
                    </h3>
                    <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-4">
                      Every custom web system begins with a formal discovery phase: user roles, workflows, database architecture, security requirements, and a binding milestone roadmap.
                    </p>
                    <div className="flex items-center gap-4 text-xs font-semibold text-blue-200">
                      <span>✓ Requirements Document</span>
                      <span>✓ Wireframe Mockups</span>
                      <span>✓ Database Entity Models</span>
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/15 text-center shrink-0 w-full md:w-auto">
                    <div className="text-xs text-slate-300 font-medium">Discovery Investment</div>
                    <div className="text-2xl font-black text-white my-1">
                      {market === 'kenya' ? 'KSh 25,000 – 75,000' : '$500 – $1,500'}
                    </div>
                    <div className="text-[11px] text-emerald-400 font-semibold mb-3">
                      *100% credited toward development
                    </div>
                    <Link
                      href={`/contact?service=discovery&market=${market}`}
                      className="btn-primary text-xs px-6 py-2.5 w-full justify-center"
                    >
                      Book Discovery Session
                    </Link>
                  </div>
                </div>
              </div>

              {/* Tiers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CUSTOM_SYSTEM_TIERS.slice(1).map((tier, idx) => {
                  const starting = market === 'kenya' ? tier.kenyaStarting : tier.intlStarting;
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl p-7 border border-slate-200/80 hover:border-[#2563EB]/40 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <h4 className="text-lg font-bold text-[#0F172A]">{tier.category}</h4>
                          <span className="text-xs font-black text-[#2563EB] bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap">
                            {starting}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed mb-5">
                          {tier.description}
                        </p>
                        <div className="space-y-1.5 mb-6">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Typical Solutions Built:
                          </div>
                          {tier.examples.map((ex, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                              <span>{ex}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">
                          Individually scoped & quoted
                        </span>
                        <Link
                          href={`/contact?service=custom-systems&tier=${encodeURIComponent(tier.category)}&market=${market}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] hover:text-blue-800"
                        >
                          Request Scope Call <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: HOSTING & CARE */}
          {activeTab === 'hosting-care' && (
            <div className="space-y-16">
              {/* Part A: Managed Cloud Hosting */}
              <div className="space-y-8">
                <div className="text-center max-w-2xl mx-auto">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6] mb-1 block">
                    Zero Server Stress
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2">
                    Managed Cloud Hosting
                  </h2>
                  <p className="text-xs md:text-sm text-slate-500">
                    We do not resell cheap cPanel shared accounts. We manage the infrastructure: configuration, security checks, SSL renewals, automated offsite backups, and uptime monitoring.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {HOSTING_PLANS.map(plan => {
                    const price = market === 'kenya' ? plan.kenyaPrice : plan.intlPrice;
                    return (
                      <div
                        key={plan.id}
                        className={`bg-white rounded-2xl border-2 p-6 flex flex-col justify-between ${
                          plan.popular ? 'border-[#2563EB] shadow-md' : 'border-slate-200/80'
                        }`}
                      >
                        <div>
                          {plan.badge && (
                            <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#2563EB] mb-2">
                              {plan.badge}
                            </span>
                          )}
                          <h3 className="font-bold text-[#0F172A] text-base mb-1">{plan.name}</h3>
                          <div className="text-2xl font-black text-[#0F172A] mb-2">{price}</div>
                          <p className="text-xs text-slate-500 leading-relaxed mb-5 min-h-[2.5rem]">
                            {plan.description}
                          </p>

                          <div className="space-y-2 mb-6 border-t border-slate-100 pt-4">
                            {plan.features.map((feat, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Link
                          href={`${plan.ctaHref}&market=${market}`}
                          className={plan.popular ? 'btn-primary w-full justify-center text-xs' : 'btn-secondary w-full justify-center text-xs'}
                        >
                          Select Hosting
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Part B: Website Care & Maintenance */}
              <div className="space-y-8 pt-8 border-t border-slate-200">
                <div className="text-center max-w-2xl mx-auto">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB] mb-1 block">
                    Recurring Peace of Mind
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2">
                    BazionWeb Care & Ongoing Maintenance
                  </h2>
                  <p className="text-xs md:text-sm text-slate-500">
                    Websites are living software. Our monthly care plans guarantee updates, daily backups, WAF defense, SEO health checks, and included engineering support hours.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {CARE_PLANS.map(care => {
                    const price = market === 'kenya' ? care.kenyaPrice : care.intlPrice;
                    return (
                      <div
                        key={care.id}
                        className={`bg-white rounded-2xl border-2 p-6 flex flex-col justify-between ${
                          care.popular ? 'border-[#2563EB] shadow-md' : 'border-slate-200/80'
                        }`}
                      >
                        <div>
                          {care.badge && (
                            <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#2563EB] mb-2">
                              {care.badge}
                            </span>
                          )}
                          <h3 className="font-bold text-[#0F172A] text-base mb-1">{care.name}</h3>
                          <div className="text-2xl font-black text-[#0F172A] mb-1">{price}</div>
                          <div className="text-xs font-bold text-[#14B8A6] mb-3">{care.hours}</div>
                          <p className="text-xs text-slate-500 leading-relaxed mb-5 min-h-[2.5rem]">
                            {care.description}
                          </p>

                          <div className="space-y-2 mb-6 border-t border-slate-100 pt-4">
                            {care.features.map((feat, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Link
                          href={`${care.ctaHref}&market=${market}`}
                          className={care.popular ? 'btn-primary w-full justify-center text-xs' : 'btn-secondary w-full justify-center text-xs'}
                        >
                          Subscribe to Care
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ADD-ONS */}
          {activeTab === 'addons' && (
            <div className="space-y-10">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-3">
                  Standardized Add-On Price Card
                </h2>
                <p className="text-sm text-slate-500">
                  Fixed, transparent add-on pricing for custom requirements. No guessing or artificial quotation markups.
                </p>
              </div>

              <AddonPriceCard market={market} />
            </div>
          )}
        </div>
      </section>

      {/* ─── Commercial Principles & Client Ownership ─── */}
      <PricingPrinciplesSection />

      {/* ─── FAQ Section ─── */}
      <section className="section bg-slate-50 border-t border-slate-200">
        <div className="container-default max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB] mb-2 block">
              Clear Answers
            </span>
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">
              Frequently Asked Pricing Questions
            </h2>
            <p className="text-sm text-slate-500">
              Everything you need to know about our commercials, contracts, ownership, and payment schedules.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'Why are Kenya and International prices structured separately?',
                a: 'Kenya and International are distinct commercial markets with different delivery workflows. International packages include more formal discovery documentation, asynchronous timezone support, international payment handling (Wise/Stripe/Cards), and formal handover QA, rather than simply converting currencies at bank rates.',
              },
              {
                q: 'Do I own my website and domain completely?',
                a: 'Yes, 100%. Clients retain absolute ownership of their domain, source code, business data, content, and credentials. BazionWeb will never hold your digital assets hostage if you decide to self-host or transfer.',
              },
              {
                q: 'What is the difference between a Revision and a Change Request?',
                a: 'A revision modifies agreed design elements or text within the approved scope before sign-off. A change request introduces a completely new feature, extra page, or un-scoped API workflow that was not in the original contract. Change requests are priced transparently before implementation.',
              },
              {
                q: 'What are the standard payment terms?',
                a: 'For standard projects under KSh 100,000 / $5,000, we require a 50% deposit before commencement and 50% upon final acceptance before production launch. For larger enterprise systems, payments follow transparent milestones: 40% deposit → 30% design sign-off → 20% staging test approval → 10% launch.',
              },
              {
                q: 'What is included in the free post-launch support period?',
                a: 'All packages include a post-launch warranty (Launch: 14 days, Business: 30 days, Professional: 60 days, Corporate: 90 days) covering bug fixes, defect remediation, and system stabilization at zero billable cost.',
              },
              {
                q: 'Are third-party costs included in the package price?',
                a: 'Third-party expenses such as domain registration, premium software licenses, SMS gateway credits, email platforms, stock photos, and payment gateway transaction fees are billed directly at cost without hidden markup, unless explicitly bundled in your quotation.',
              },
            ].map((faq, i) => (
              <div key={i} className="card p-6 bg-white border border-slate-200">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-[#0F172A] text-sm md:text-base mb-2">
                      {faq.q}
                    </h3>
                    <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="section bg-[#0F172A] text-white">
        <div className="container-default text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6] mb-3 block">
            Instant Clarity
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Need an accurate, itemized quotation?
          </h2>
          <p className="text-slate-300 text-sm md:text-base mb-8 leading-relaxed">
            Use our interactive quote calculator to configure your exact page count, add-ons, and hosting tier, or book a free discovery consultation with our engineers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/quote?market=${market}`} className="btn-primary px-8 py-3.5 text-sm">
              Open Interactive Quote Calculator
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/contact?market=${market}`}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition-colors text-sm"
            >
              Speak to a Consultant
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
