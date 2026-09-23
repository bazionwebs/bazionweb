'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Globe, Database, ShoppingCart, Layers, Truck,
  Palette, Check, ArrowRight, ChevronRight,
  TrendingDown, Info, ArrowLeft
} from 'lucide-react';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

// ─── Data ─────────────────────────────────────────────────────────────────────

const PAGE_TYPES = [
  { id: 'simple', label: 'Simple page', desc: 'About, Contact, FAQ, Legal', rate: 59, icon: Globe },
  { id: 'standard', label: 'Standard page', desc: 'Services, Portfolio, Blog list', rate: 119, icon: Layers },
  { id: 'complex', label: 'Complex page', desc: 'Homepage, Landing, Dashboard', rate: 219, icon: Database },
];

const PLAN_OPTIONS = [
  { id: 'starter', label: 'Starter', price: 29, desc: 'Hosting, SSL, backups, monitoring', uptime: '99.9%' },
  { id: 'growth', label: 'Growth', price: 59, desc: '+ Maintenance, security management', uptime: '99.95%', recommended: true },
  { id: 'business', label: 'Business', price: 119, desc: '+ Performance, unlimited updates', uptime: '99.95%', recommended: false },
  { id: 'enterprise', label: 'Enterprise', price: 0, desc: 'Custom SLA, dedicated AM', uptime: '99.99%' },
];

const ADD_ONS = [
  { id: 'hasCms', label: 'CMS Integration', desc: 'Strapi — manage content without code', cost: 179, icon: Database },
  { id: 'hasEcommerce', label: 'E-commerce', desc: 'Stripe checkout, product catalogue', cost: 399, icon: ShoppingCart },
  { id: 'needsMigration', label: 'Site Migration', desc: 'Zero-downtime transfer from current host', cost: 79, icon: Truck },
  { id: 'customDesign', label: 'Custom UI/UX Design', desc: 'Full Figma design system before build', cost: 199, icon: Palette },
];

interface Pages {
  simple: number;
  standard: number;
  complex: number;
}

interface Config {
  pages: Pages;
  addOns: Record<string, boolean>;
  plan: string;
  billing: 'monthly' | 'annual';
}

const initial: Config = {
  pages: { simple: 2, standard: 2, complex: 1 },
  addOns: { hasCms: false, hasEcommerce: false, needsMigration: false, customDesign: false },
  plan: 'growth',
  billing: 'monthly',
};

// ─── Calculation ──────────────────────────────────────────────────────────────

function calculate(config: Config) {
  const pageCost =
    config.pages.simple * 59 +
    config.pages.standard * 119 +
    config.pages.complex * 219;

  const addOnCost = ADD_ONS.filter(a => config.addOns[a.id]).reduce((s, a) => s + a.cost, 0);
  const buildTotal = pageCost + addOnCost;

  const plan = PLAN_OPTIONS.find(p => p.id === config.plan)!;
  const monthly = plan.price;
  const annual = monthly * 10; // 2 months free
  const annualSaving = monthly * 2;

  const recurringCost = config.billing === 'annual' ? annual : monthly * 12;
  const year1 = buildTotal + recurringCost;

  return { buildTotal, monthly, annual, annualSaving, recurringCost, year1, pageCost, addOnCost };
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

export default function QuoteCalculatorPage() {
  const [config, setConfig] = useState<Config>(initial);
  const [step, setStep] = useState<Step>(1);

  const calc = calculate(config);

  function setPages(type: keyof Pages, val: number) {
    setConfig(prev => ({ ...prev, pages: { ...prev.pages, [type]: Math.max(0, val) } }));
  }

  function toggleAddOn(id: string) {
    setConfig(prev => ({ ...prev, addOns: { ...prev.addOns, [id]: !prev.addOns[id] } }));
  }

  const totalPages = config.pages.simple + config.pages.standard + config.pages.complex;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-4xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Instant Quote' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            Quote Calculator
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Get an instant price estimate
          </h1>
          <p className="text-slate-400 text-lg">
            Configure your website and plan — see a live cost breakdown. No email required.
          </p>
        </div>
      </div>

      <div className="container-default max-w-4xl py-12">
        {/* Progress steps */}
        <div className="flex items-center gap-3 mb-10">
          {(['Pages', 'Add-ons', 'Plan'] as const).map((label, i) => {
            const stepNum = (i + 1) as Step;
            const active = step === stepNum;
            const done = step > stepNum;
            return (
              <button
                key={label}
                onClick={() => setStep(stepNum)}
                className="flex items-center gap-2"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  done ? 'bg-[#22C55E] text-white' : active ? 'bg-[#2563EB] text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span className={`text-sm font-medium ${active ? 'text-[#0F172A]' : 'text-slate-400'}`}>{label}</span>
                {i < 2 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left — config panel */}
          <div className="lg:col-span-2 space-y-6">

            {/* Step 1 — Pages */}
            {step === 1 && (
              <div className="card p-8">
                <h2 className="text-xl font-bold text-[#0F172A] mb-2">How many pages do you need?</h2>
                <p className="text-sm text-slate-500 mb-8">
                  Pages are priced by complexity. You can adjust any time — the quote updates live.
                </p>
                <div className="space-y-5">
                  {PAGE_TYPES.map(pt => (
                    <div key={pt.id} className="flex items-center justify-between p-5 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-[#2563EB]/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <pt.icon className="w-5 h-5 text-[#2563EB]" />
                        </div>
                        <div>
                          <div className="font-semibold text-[#0F172A]">{pt.label}</div>
                          <div className="text-xs text-slate-400">{pt.desc}</div>
                          <div className="text-xs font-bold text-[#2563EB] mt-1">${pt.rate} / page</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setPages(pt.id as keyof Pages, config.pages[pt.id as keyof Pages] - 1)}
                          className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors font-bold text-lg leading-none"
                        >
                          −
                        </button>
                        <span className="text-xl font-black text-[#0F172A] w-8 text-center">
                          {config.pages[pt.id as keyof Pages]}
                        </span>
                        <button
                          onClick={() => setPages(pt.id as keyof Pages, config.pages[pt.id as keyof Pages] + 1)}
                          className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors font-bold text-lg leading-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-8">
                  <button
                    onClick={() => setStep(2)}
                    disabled={totalPages === 0}
                    className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next: Add-ons <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Add-ons */}
            {step === 2 && (
              <div className="card p-8">
                <h2 className="text-xl font-bold text-[#0F172A] mb-2">Any additional features?</h2>
                <p className="text-sm text-slate-500 mb-8">
                  These are one-time build costs. Toggle anything you need.
                </p>
                <div className="space-y-3">
                  {ADD_ONS.map(a => {
                    const active = config.addOns[a.id];
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleAddOn(a.id)}
                        className={`w-full flex items-center justify-between p-5 rounded-xl border-2 transition-all text-left ${
                          active
                            ? 'border-[#2563EB] bg-blue-50/50'
                            : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            active ? 'bg-[#2563EB]' : 'bg-slate-100'
                          }`}>
                            <a.icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-500'}`} />
                          </div>
                          <div>
                            <div className="font-semibold text-[#0F172A]">{a.label}</div>
                            <div className="text-xs text-slate-400">{a.desc}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="text-sm font-bold text-[#0F172A]">+${a.cost}</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            active ? 'bg-[#2563EB] border-[#2563EB]' : 'border-slate-300'
                          }`}>
                            {active && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-8">
                  <button onClick={() => setStep(1)} className="btn-ghost flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={() => setStep(3)} className="btn-primary px-8">
                    Next: Choose Plan <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Plan */}
            {step === 3 && (
              <div className="card p-8">
                <h2 className="text-xl font-bold text-[#0F172A] mb-2">Choose your monthly plan</h2>
                <p className="text-sm text-slate-500 mb-6">
                  Your plan covers hosting, support, and ongoing services after launch.
                </p>

                {/* Billing toggle */}
                <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 mb-8">
                  {(['monthly', 'annual'] as const).map(b => (
                    <button
                      key={b}
                      onClick={() => setConfig(prev => ({ ...prev, billing: b }))}
                      className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                        config.billing === b
                          ? 'bg-white text-[#0F172A] shadow-[var(--shadow-card)]'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {b === 'monthly' ? 'Monthly' : 'Annual (2 months free)'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PLAN_OPTIONS.map(p => {
                    const active = config.plan === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setConfig(prev => ({ ...prev, plan: p.id }))}
                        className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                          active
                            ? 'border-[#2563EB] bg-blue-50/50'
                            : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                        }`}
                      >
                        {p.recommended && (
                          <span className="absolute -top-2.5 left-4 bg-[#2563EB] text-white text-xs font-bold px-3 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-[#0F172A]">{p.label}</span>
                          {active && <Check className="w-4 h-4 text-[#2563EB]" />}
                        </div>
                        <div className="text-2xl font-black text-[#0F172A] mb-1">
                          {p.price > 0 ? (
                            <>
                              ${config.billing === 'annual' ? (p.price * 10 / 12).toFixed(0) : p.price}
                              <span className="text-sm font-normal text-slate-400">/mo</span>
                            </>
                          ) : (
                            <span className="text-lg">Custom</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mb-2">{p.desc}</div>
                        <div className="text-xs font-semibold text-[#14B8A6]">{p.uptime} uptime SLA</div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between mt-8">
                  <button onClick={() => setStep(2)} className="btn-ghost flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <Link href="/contact" className="btn-primary px-8">
                    Get Official Quote <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right — live price summary (sticky) */}
          <div className="lg:sticky lg:top-24 h-fit space-y-4">
            <div className="card p-6">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Live Estimate</div>

              {/* Build cost breakdown */}
              <div className="space-y-2 pb-4 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">One-time build</div>
                {PAGE_TYPES.map(pt => {
                  const qty = config.pages[pt.id as keyof Pages];
                  if (!qty) return null;
                  return (
                    <div key={pt.id} className="flex justify-between text-sm">
                      <span className="text-slate-500">{qty}× {pt.label}</span>
                      <span className="font-medium text-[#0F172A]">${qty * pt.rate}</span>
                    </div>
                  );
                })}
                {ADD_ONS.filter(a => config.addOns[a.id]).map(a => (
                  <div key={a.id} className="flex justify-between text-sm">
                    <span className="text-slate-500">{a.label}</span>
                    <span className="font-medium text-[#0F172A]">${a.cost}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-[#0F172A] pt-2 border-t border-slate-100 mt-2">
                  <span>Build total</span>
                  <span>${calc.buildTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Monthly plan */}
              <div className="py-4 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Ongoing plan</div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 capitalize">{config.plan} plan</span>
                  <span className="font-medium text-[#0F172A]">
                    {config.plan === 'enterprise' ? 'Custom' : (
                      config.billing === 'annual'
                        ? `$${calc.annual}/yr`
                        : `$${calc.monthly}/mo`
                    )}
                  </span>
                </div>
                {config.billing === 'annual' && calc.annualSaving > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-[#22C55E] font-semibold">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Save ${calc.annualSaving}/yr with annual billing
                  </div>
                )}
              </div>

              {/* Year 1 total */}
              <div className="pt-4">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm text-slate-500">Year 1 total</span>
                  <span className="text-3xl font-black text-[#0F172A]">
                    {config.plan === 'enterprise' ? 'Custom' : `$${calc.year1.toLocaleString()}`}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Build cost + {config.billing} subscription
                </p>
              </div>

              <div className="flex items-start gap-2 mt-4 p-3 bg-blue-50 rounded-xl">
                <Info className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
                <p className="text-xs text-[#2563EB]">
                  This is an estimate. Your official quote may differ based on your specific requirements.
                </p>
              </div>
            </div>

            <Link href="/contact" className="btn-primary w-full justify-center">
              Get Official Quote
              <ArrowRight className="w-4 h-4" />
            </Link>

            <p className="text-xs text-slate-400 text-center">
              No commitment required. Response within 24 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
