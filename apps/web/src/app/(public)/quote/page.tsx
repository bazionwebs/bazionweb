'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  Market,
  ADD_ON_RATE_CARD,
} from '@/lib/pricingData';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { MARKETS, mapCountryToMarket } from '@/lib/marketEngine';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import {
  Check,
  ArrowRight,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
  ShieldCheck,
  UserPlus,
  X,
  Loader2,
  Mail,
  User,
  Sparkles,
  Globe,
  Lock,
} from 'lucide-react';

interface QuoteConfig {
  market: Market;
  packageType: 'launch' | 'business' | 'professional' | 'ecom-starter' | 'ecom-business' | 'custom';
  extraPages: number;
  selectedAddOns: string[];
  rushDelivery: boolean;
  care: string; // 'none' | 'care-essential' | 'care-business' | 'care-professional'
  hosting: string; // hosting option id, 'none' = self-managed
}

const PACKAGE_DEFAULTS = {
  launch: { name: 'Launch Website', basePages: 5, kenyaCost: 25000, intlCost: 495 },
  business: { name: 'Business Website', basePages: 10, kenyaCost: 90000, intlCost: 1500 },
  professional: { name: 'Professional Website', basePages: 15, kenyaCost: 160000, intlCost: 2850 },
  'ecom-starter': { name: 'E-Commerce Starter', basePages: 8, kenyaCost: 90000, intlCost: 1500 },
  'ecom-business': { name: 'E-Commerce Business', basePages: 15, kenyaCost: 175000, intlCost: 2950 },
  custom: { name: 'Custom Project Build', basePages: 5, kenyaCost: 180000, intlCost: 3200 },
};

function QuoteCalculatorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore(s => s.setSession);
  const setPendingPlan = useAuthStore(s => s.setPendingPlan);

  const { market, marketCode, marketDef } = useMarketPreference();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [config, setConfig] = useState<QuoteConfig>({
    market,
    packageType: (searchParams.get('package') as QuoteConfig['packageType']) || 'business',
    extraPages: 0,
    selectedAddOns: [],
    rushDelivery: false,
    care: 'none',
    hosting: 'none',
  });

  // Get Started Modal State
  const [showModal, setShowModal] = useState(false);
  const [gName, setGName] = useState('');
  const [gEmail, setGEmail] = useState('');
  const [gCompany, setGCompany] = useState('');
  const [gCountry, setGCountry] = useState(marketCode === 'KE' ? 'KE' : 'US');
  const [gLoading, setGLoading] = useState(false);

  // Sync config when market changes
  useEffect(() => {
    setConfig(prev => ({ ...prev, market }));
    setGCountry(marketCode === 'KE' ? 'KE' : 'US');
  }, [market, marketCode]);

  useEffect(() => {
    const pkgParam = searchParams.get('package');
    if (pkgParam && pkgParam in PACKAGE_DEFAULTS) {
      setConfig(prev => ({ ...prev, packageType: pkgParam as QuoteConfig['packageType'] }));
    }
    const addonParam = searchParams.get('addon');
    if (addonParam) {
      setConfig(prev => ({
        ...prev,
        selectedAddOns: prev.selectedAddOns.includes(addonParam)
          ? prev.selectedAddOns
          : [...prev.selectedAddOns, addonParam],
      }));
    }
  }, [searchParams]);

  const currencySymbol = config.market === 'kenya' ? 'KSh' : '$';
  const pkgInfo = PACKAGE_DEFAULTS[config.packageType] || PACKAGE_DEFAULTS.business;

  // Calculation Logic
  const baseCost = config.market === 'kenya' ? pkgInfo.kenyaCost : pkgInfo.intlCost;
  const extraPageRate = config.market === 'kenya' ? 2000 : 50;
  const extraPagesCost = config.extraPages * extraPageRate;

  // Add-ons cost
  const addOnsCost = config.selectedAddOns.reduce((total, id) => {
    const item = ADD_ON_RATE_CARD.find(a => a.id === id);
    if (!item) return total;
    return total + (config.market === 'kenya' ? item.rawKes : item.rawUsd);
  }, 0);

  const subtotalBuild = baseCost + extraPagesCost + addOnsCost;
  const rushMultiplier = config.rushDelivery ? 0.35 : 0; // +35% average rush
  const rushCost = Math.round(subtotalBuild * rushMultiplier);
  const totalBuild = subtotalBuild + rushCost;

  // Care recurring costs
  let monthlyCare = 0;
  if (config.care === 'care-essential') monthlyCare = config.market === 'kenya' ? 5000 : 75;
  else if (config.care === 'care-business') monthlyCare = config.market === 'kenya' ? 10000 : 150;
  else if (config.care === 'care-professional') monthlyCare = config.market === 'kenya' ? 20000 : 300;

  // Annual hosting cost (mirrors the hosting options card prices)
  const HOSTING_ANNUAL: Record<string, { kenya: number; intl: number }> = {
    'host-essential': { kenya: 4500, intl: 60 },
    'host-business': { kenya: 8500, intl: 120 },
    'host-pro': { kenya: 15000, intl: 240 },
    none: { kenya: 0, intl: 0 },
  };
  const annualHosting =
    (HOSTING_ANNUAL[config.hosting] ?? HOSTING_ANNUAL.none)[config.market === 'kenya' ? 'kenya' : 'intl'];

  const totalYearOne = totalBuild + annualHosting + (monthlyCare * 12);

  // Toggle addon helper
  function toggleAddOn(id: string) {
    setConfig(prev => ({
      ...prev,
      selectedAddOns: prev.selectedAddOns.includes(id)
        ? prev.selectedAddOns.filter(item => item !== id)
        : [...prev.selectedAddOns, id],
    }));
  }

  async function handleGetStarted(e: React.FormEvent) {
    e.preventDefault();
    if (!gName.trim() || !gEmail.trim()) return;

    setGLoading(true);

    try {
      // 1. Authoritative Level 4 Resolution via Declared Billing Country
      const authoritativeMarketCode = mapCountryToMarket(gCountry);
      const authoritativeMarketDef = MARKETS[authoritativeMarketCode] || MARKETS.GLOBAL;
      const priceBookId = authoritativeMarketDef.activePriceBookId;
      const authoritativeCurrency = authoritativeMarketDef.currency;

      // 2. Call server-side quote proposal API to lock quote
      const quoteRes = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingCountry: gCountry,
          packageType: config.packageType,
          extraPages: config.extraPages,
          selectedAddOns: config.selectedAddOns,
          rushDelivery: config.rushDelivery,
          care: config.care,
          hosting: config.hosting,
          clientName: gName.trim(),
          clientEmail: gEmail.trim(),
          clientCompany: gCompany.trim(),
        }),
      });

      const proposalData = quoteRes.ok ? await quoteRes.json() : null;

      // 3. Register commercial lead
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: gName.trim(),
          email: gEmail.trim(),
          company: gCompany.trim() || undefined,
          country: gCountry,
          proposalId: proposalData?.proposalId,
          serviceInterest: `Website - ${pkgInfo.name}`,
          estimatedBudget: totalYearOne,
        }),
      }).catch(() => {/* ignore background lead capture network drop */});

      // 4. Save locked proposal to localStorage
      localStorage.setItem('bazion_locked_proposal', JSON.stringify(proposalData || {
        proposalId: `PROP-LOCAL-${Date.now()}`,
        marketCode: authoritativeMarketCode,
        currency: authoritativeCurrency,
        priceBookId,
        country: gCountry,
        packageType: config.packageType,
        packageName: pkgInfo.name,
        totalBuild,
        monthlyCare,
        annualHosting,
        totalYearOne,
        savedAt: new Date().toISOString(),
      }));

      localStorage.setItem('bazion_saved_quote', JSON.stringify({
        packageType: config.packageType,
        packageName: pkgInfo.name,
        market: authoritativeMarketCode === 'KE' ? 'kenya' : 'international',
        marketCode: authoritativeMarketCode,
        priceBookId,
        currencySymbol: authoritativeMarketDef.currencySymbol,
        extraPages: config.extraPages,
        selectedAddOns: config.selectedAddOns,
        rushDelivery: config.rushDelivery,
        care: config.care,
        hosting: config.hosting,
        baseCost,
        extraPagesCost,
        addOnsCost,
        totalBuild,
        monthlyCare,
        annualHosting,
        totalYearOne,
        savedAt: new Date().toISOString(),
      }));
    } catch {
      // ignore storage errors
    }

    const parts = gName.trim().split(' ');
    const firstName = parts[0] || 'Client';
    const lastName = parts.slice(1).join(' ') || '';

    const chosenPlan = config.care !== 'none' ? config.care : null;
    setPendingPlan(chosenPlan);

    setSession(
      {
        id: `quote-${Date.now()}`,
        email: gEmail.trim(),
        firstName,
        lastName,
        company: gCompany.trim() || undefined,
        roles: ['CLIENT'],
        keycloakId: `quote-${Date.now()}`,
        subscriptionStatus: 'PENDING',
      },
      'provisional-quote-token',
      'provisional-quote-refresh',
      86400 * 7,
    );

    await new Promise(r => setTimeout(r, 600));
    setGLoading(false);
    setShowModal(false);

    if (chosenPlan) {
      router.push(`/portal/onboarding?plan=${chosenPlan}`);
    } else {
      router.push('/portal');
    }
  }

  // Pre-formatted message for WhatsApp or Form
  const breakdownMessage = `Hello BazionWeb, I configured an estimate on your website:
* Market: ${config.market === 'kenya' ? 'Kenya (KES)' : 'International (USD)'}
* Package: ${pkgInfo.name} (${currencySymbol} ${baseCost.toLocaleString()})
* Extra Pages: ${config.extraPages} (+${currencySymbol} ${extraPagesCost.toLocaleString()})
* Add-ons: ${config.selectedAddOns.join(', ') || 'None'} (+${currencySymbol} ${addOnsCost.toLocaleString()})
${config.rushDelivery ? '* Priority Rush Delivery: YES (+35%)\n' : ''}* Estimated One-Time Build: ${currencySymbol} ${totalBuild.toLocaleString()}
* Maintenance Care: ${config.care} (${currencySymbol} ${monthlyCare.toLocaleString()}/mo)
* Hosting: ${config.hosting} (${currencySymbol} ${annualHosting.toLocaleString()}/yr)
* Total Year 1 Estimate: ${currencySymbol} ${totalYearOne.toLocaleString()}

Please confirm availability and discuss next steps.`;

  const whatsappHref = `https://wa.me/254721287053?text=${encodeURIComponent(breakdownMessage)}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-[#0F172A] pt-32 pb-16 text-white">
        <div className="container-default max-w-5xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Instant Quote Calculator' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-3">
            Interactive Cost Estimator
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Build your custom project estimate
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed mb-4">
            Configure your website tier, extra pages, payment integrations, and managed care plans.
            Itemized transparency with zero hidden markups.
          </p>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-slate-200">
            <span>{marketDef.flag}</span>
            <span className="font-semibold text-white">{marketDef.currency} Commercial Schedule</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">
              {marketCode === 'KE' ? 'M-Pesa STK · 16% KRA VAT Inclusive' : 'Card / Wire · 0% Export'}
            </span>
          </div>
        </div>
      </div>

      <div className="container-default max-w-5xl py-12">
        {/* Progress Navigation */}
        <div className="flex items-center gap-3 mb-10 overflow-x-auto pb-2">
          {[
            { num: 1, label: 'Core Package & Pages' },
            { num: 2, label: 'Add-Ons & Integrations' },
            { num: 3, label: 'Care & Maintenance' },
          ].map(s => {
            const active = step === s.num;
            const done = step > s.num;
            return (
              <button
                key={s.num}
                onClick={() => setStep(s.num as 1 | 2 | 3)}
                className="flex items-center gap-2 shrink-0"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done
                      ? 'bg-[#22C55E] text-white'
                      : active
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span
                  className={`text-sm font-semibold ${
                    active ? 'text-[#0F172A]' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
                {s.num < 3 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left: Step Configurator */}
          <div className="lg:col-span-2 space-y-6">
            {/* STEP 1: Core Package & Pages */}
            {step === 1 && (
              <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-[#0F172A] mb-1">
                  1. Select Your Baseline Package
                </h2>
                <p className="text-xs text-slate-500 mb-6">
                  Each package includes mobile-first architecture, SSL, SEO setup, and included post-launch defect warranty.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {(
                    [
                      { id: 'launch', name: 'Launch', desc: 'Up to 5 pages, brochure setup', pages: 5 },
                      { id: 'business', name: 'Business', desc: 'Up to 10 pages + CMS + Blog', pages: 10, rec: true },
                      { id: 'professional', name: 'Professional', desc: 'Up to 15 pages + Advanced UX', pages: 15 },
                      { id: 'ecom-starter', name: 'E-Commerce Starter', desc: 'Store + M-Pesa/Card Checkout', pages: 8 },
                      { id: 'ecom-business', name: 'E-Commerce Business', desc: '100+ products, stock, coupons', pages: 15 },
                      { id: 'custom', name: 'Custom Architecture', desc: 'Bespoke web applications', pages: 5 },
                    ] as { id: keyof typeof PACKAGE_DEFAULTS; name: string; desc: string; pages: number; rec?: boolean }[]
                  ).map(pkg => {
                    const cost = config.market === 'kenya'
                      ? PACKAGE_DEFAULTS[pkg.id].kenyaCost
                      : PACKAGE_DEFAULTS[pkg.id].intlCost;
                    const isSelected = config.packageType === pkg.id;

                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, packageType: pkg.id }))}
                        className={`text-left p-4 rounded-xl border-2 transition-all relative ${
                          isSelected
                            ? 'border-[#2563EB] bg-blue-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {pkg.rec && (
                          <span className="absolute -top-2.5 right-3 bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                        <div className="font-bold text-[#0F172A] text-sm mb-0.5">{pkg.name}</div>
                        <div className="text-xs text-slate-500 mb-2">{pkg.desc}</div>
                        <div className="text-base font-extrabold text-[#2563EB]">
                          {currencySymbol} {cost.toLocaleString()}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Additional Pages Counter */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-sm text-[#0F172A]">Need Additional Pages?</div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Package baseline includes {pkgInfo.basePages} pages. Extra pages are {currencySymbol} {extraPageRate.toLocaleString()} each.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, extraPages: Math.max(0, prev.extraPages - 1) }))}
                        className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                      >
                        −
                      </button>
                      <span className="text-base font-black text-[#0F172A] w-6 text-center">
                        {config.extraPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, extraPages: prev.extraPages + 1 }))}
                        className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-primary text-xs px-6 py-3"
                  >
                    Next: Add-Ons & Integrations <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Add-Ons & Integrations */}
            {step === 2 && (
              <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-[#0F172A] mb-1">
                  2. Choose Add-Ons & Functional Modules
                </h2>
                <p className="text-xs text-slate-500 mb-6">
                  Select additional features or integrations to bundle into your build quotation.
                </p>

                <div className="space-y-3 mb-8">
                  {ADD_ON_RATE_CARD.filter(a => a.id !== 'extra-page' && a.id !== 'rush-delivery').map(addon => {
                    const isChecked = config.selectedAddOns.includes(addon.id);
                    const price = config.market === 'kenya' ? addon.kenyaPrice : addon.intlPrice;

                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddOn(addon.id)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                          isChecked
                            ? 'border-[#2563EB] bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-[#0F172A]">{addon.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{addon.description}</div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="text-xs font-bold text-[#2563EB]">{price}</span>
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'bg-[#2563EB] border-[#2563EB] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Priority Rush Delivery Option */}
                <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/70 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-amber-900">Priority Rush Delivery (+35%)</div>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Fast-track your timeline by assigning dedicated senior engineering sprints.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, rushDelivery: !prev.rushDelivery }))}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      config.rushDelivery
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    {config.rushDelivery ? 'Rush Enabled' : 'Add Rush'}
                  </button>
                </div>

                <div className="flex justify-between mt-8">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary text-xs px-5 py-2.5 flex items-center gap-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn-primary text-xs px-6 py-3"
                  >
                    Next: Care & Maintenance <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Care & Maintenance */}
            {step === 3 && (
              <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A] mb-1">
                    3. Website Care & Ongoing Maintenance
                  </h2>
                  <p className="text-xs text-slate-500 mb-6">
                    Choose monthly proactive maintenance, software updates, security scanning, and developer support for your website after launch.
                  </p>

                  {/* Monthly Care options */}
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Website Care & Maintenance (Monthly):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'care-essential', name: 'Care Essential', price: config.market === 'kenya' ? 'KSh 5,000/mo' : '$75/mo', desc: 'Updates, backups, monitoring + 1 hr support' },
                      { id: 'care-business', name: 'Care Business', price: config.market === 'kenya' ? 'KSh 10,000/mo' : '$150/mo', desc: 'Weekly updates, SEO reviews + 2 hr support', rec: true },
                      { id: 'care-professional', name: 'Care Professional', price: config.market === 'kenya' ? 'KSh 20,000/mo' : '$300/mo', desc: 'Proactive dev, speed audits + 5 hr support' },
                      { id: 'none', name: 'No Care Plan (Warranty only)', price: 'Included Warranty', desc: 'Post-launch free defect warranty only' },
                    ].map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, care: c.id }))}
                        className={`text-left p-4 rounded-xl border-2 transition-all relative ${
                          config.care === c.id
                            ? 'border-[#2563EB] bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {c.rec && (
                          <span className="absolute -top-2.5 right-3 bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                        <div className="font-bold text-sm text-[#0F172A]">{c.name}</div>
                        <div className="text-xs text-slate-500 mb-1">{c.desc}</div>
                        <div className="text-sm font-extrabold text-[#14B8A6]">{c.price}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-200">
                  {/* Primary CTA: Get Started — always available, triggers modal */}
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-extrabold transition-all shadow-lg shadow-blue-900/30"
                  >
                    <UserPlus className="w-4 h-4" />
                    Get Started — Create Free Account
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="flex justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="btn-secondary text-xs px-5 py-2.5 flex items-center gap-2"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-xs px-6 py-3 flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A]"
                    >
                      <MessageSquare className="w-4 h-4" /> Send to WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Quotation Summary */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="card p-6 bg-white border border-slate-200 shadow-md rounded-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Itemized Estimate
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#2563EB]">
                  {config.market === 'kenya' ? 'KES' : 'USD'}
                </span>
              </div>

              {/* Build Breakdown */}
              <div className="space-y-2 pb-4 border-b border-slate-100 text-xs">
                <div className="flex justify-between font-semibold text-[#0F172A]">
                  <span>{pkgInfo.name}</span>
                  <span>{currencySymbol} {baseCost.toLocaleString()}</span>
                </div>
                {config.extraPages > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>{config.extraPages}× Extra Pages</span>
                    <span>+{currencySymbol} {extraPagesCost.toLocaleString()}</span>
                  </div>
                )}
                {config.selectedAddOns.map(id => {
                  const item = ADD_ON_RATE_CARD.find(a => a.id === id);
                  if (!item) return null;
                  const itemPrice = config.market === 'kenya' ? item.rawKes : item.rawUsd;
                  return (
                    <div key={id} className="flex justify-between text-slate-500">
                      <span>{item.name}</span>
                      <span>+{currencySymbol} {itemPrice.toLocaleString()}</span>
                    </div>
                  );
                })}
                {config.rushDelivery && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Rush Production (+35%)</span>
                    <span>+{currencySymbol} {rushCost.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between font-extrabold text-[#0F172A] text-sm pt-2 border-t border-slate-100">
                  <span>One-Time Build Total</span>
                  <span className="text-[#2563EB]">{currencySymbol} {totalBuild.toLocaleString()}</span>
                </div>
              </div>

              {/* Ongoing Recurring Services */}
              <div className="py-3 border-b border-slate-100 space-y-1.5 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Recurring Services:
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Care Maintenance</span>
                  <span className="font-semibold text-[#0F172A]">
                    {monthlyCare > 0 ? `${currencySymbol} ${monthlyCare.toLocaleString()}/mo` : 'Warranty only'}
                  </span>
                </div>
              </div>

              {/* Year 1 Total */}
              <div className="pt-3">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs font-bold text-slate-500 uppercase">Year 1 Total</span>
                  <span className="text-2xl font-black text-[#0F172A]">
                    {currencySymbol} {totalYearOne.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {monthlyCare > 0 ? 'Includes one-time build + 12 months ongoing care' : 'Includes one-time build + included defect warranty'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 mt-6">
                {/* PRIMARY: Get Started — always visible, opens modal */}
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-extrabold transition-all shadow-lg shadow-blue-900/30"
                >
                  <UserPlus className="w-4 h-4" />
                  Get Started — Free Account
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-bold transition-colors"
                >
                  <MessageSquare className="w-4 h-4" /> Send Quote to WhatsApp
                </a>
                <Link
                  href={`/contact?source=quote-calculator&package=${config.packageType}`}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
                >
                  Book Free Consultation <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="flex items-start gap-2 mt-4 p-3 bg-blue-50/70 rounded-xl text-[11px] text-[#2563EB] leading-tight">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>100% Client Ownership guaranteed. Zero vendor lock-in.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Get Started Modal Overlay ─────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Modal header */}
            <div className="bg-gradient-to-br from-[#2563EB] to-indigo-700 px-6 py-6 relative">
              <button
                onClick={() => setShowModal(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-blue-200">Step 1 of 2</p>
                  <h2 className="text-lg font-extrabold text-white">Create your free account</h2>
                </div>
              </div>
              <p className="text-blue-200 text-xs leading-relaxed">
                Your quote is saved automatically. Choose a care plan and pay from your dashboard — no payment needed now.
              </p>
            </div>

            {/* Modal form */}
            <form onSubmit={handleGetStarted} className="px-6 py-6 space-y-4">
              <div>
                <label htmlFor="gs-name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="gs-name"
                    type="text"
                    required
                    autoFocus
                    value={gName}
                    onChange={e => setGName(e.target.value)}
                    placeholder="Jane Wanjiku"
                    className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="gs-email" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="gs-email"
                    type="email"
                    required
                    value={gEmail}
                    onChange={e => setGEmail(e.target.value)}
                    placeholder="jane@yourcompany.com"
                    className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="gs-company" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Company <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    id="gs-company"
                    type="text"
                    value={gCompany}
                    onChange={e => setGCompany(e.target.value)}
                    placeholder="Acacia Healthcare Ltd"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="gs-country" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Billing Country &amp; Contracting Entity</span>
                  <span className="text-[10px] font-bold text-[#2563EB]">Authoritative Market</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    id="gs-country"
                    value={gCountry}
                    onChange={e => setGCountry(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  >
                    <optgroup label="East Africa (Kenya Price Book & Terms)">
                      <option value="KE">🇰🇪 Kenya (KES · M-Pesa &amp; Paystack)</option>
                      <option value="UG">🇺🇬 Uganda (East Africa Region)</option>
                      <option value="TZ">🇹🇿 Tanzania (East Africa Region)</option>
                      <option value="RW">🇷🇼 Rwanda (East Africa Region)</option>
                    </optgroup>
                    <optgroup label="International (Global Price Book & Master SLA)">
                      <option value="US">🇺🇸 United States (USD · Stripe &amp; Wire)</option>
                      <option value="GB">🇬🇧 United Kingdom (USD · International Rails)</option>
                      <option value="CA">🇨🇦 Canada (USD · Global Rails)</option>
                      <option value="AU">🇦🇺 Australia (USD · Global Rails)</option>
                      <option value="DE">🇩🇪 Germany / Europe (USD · International)</option>
                      <option value="OTHER">🌍 Other International (USD · Global Master SLA)</option>
                    </optgroup>
                  </select>
                </div>
                <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Authoritative Price Book: <strong className="text-slate-700">{mapCountryToMarket(gCountry) === 'KE' ? 'KE-2026-v1 (KES)' : 'GLOBAL-2026-v1 (USD)'}</strong></span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1"><Lock className="w-3 h-3" /> Price Guaranteed 30 Days</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={gLoading || !gName.trim() || !gEmail.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-sm transition-all shadow-lg shadow-blue-900/30 mt-2"
              >
                {gLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Create Account &amp; Enter Dashboard <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <p className="text-center text-[11px] text-slate-400 leading-relaxed pt-1">
                No credit card required. Your quote is pre-loaded in the dashboard.
                By continuing you agree to our{' '}
                <a href="/legal/terms" className="text-[#2563EB] hover:underline">Terms</a>.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuoteCalculatorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0F172A] pt-40 flex items-center justify-center text-white">
        Loading interactive quote calculator...
      </div>
    }>
      <QuoteCalculatorContent />
    </Suspense>
  );
}
