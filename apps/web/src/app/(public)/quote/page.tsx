'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Market,
  ADD_ON_RATE_CARD,
} from '@/lib/pricingData';
import MarketToggle from '@/components/ui/MarketToggle';
import { readStoredMarket, detectMarket, MARKET_STORAGE_KEY } from '@/hooks/useMarketPreference';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import {
  Check,
  ArrowRight,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
  ShieldCheck,
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
  business: { name: 'Business Website', basePages: 10, kenyaCost: 50000, intlCost: 1250 },
  professional: { name: 'Professional Website', basePages: 15, kenyaCost: 85000, intlCost: 2250 },
  'ecom-starter': { name: 'E-Commerce Starter', basePages: 8, kenyaCost: 90000, intlCost: 1500 },
  'ecom-business': { name: 'E-Commerce Business', basePages: 15, kenyaCost: 160000, intlCost: 2500 },
  custom: { name: 'Custom Project Build', basePages: 5, kenyaCost: 25000, intlCost: 495 },
};

function QuoteCalculatorContent() {
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [config, setConfig] = useState<QuoteConfig>({
    market: (searchParams.get('market') === 'kenya' ? 'kenya' : 'international'),
    packageType: (searchParams.get('package') as QuoteConfig['packageType']) || 'business',
    extraPages: 0,
    selectedAddOns: [],
    rushDelivery: false,
    care: 'none',
    hosting: 'none',
  });

  useEffect(() => {
    const marketParam = searchParams.get('market');
    if (marketParam === 'international' || marketParam === 'kenya') {
      setConfig(prev => ({ ...prev, market: marketParam }));
    }
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

  // Returning visitors: stored market wins unless a deep-link ?market= is present.
  // New visitors: East-African timezones start on Kenya pricing (same URL, no redirect).
  useEffect(() => {
    if (searchParams.get('market')) return;
    const stored = readStoredMarket();
    if (stored) {
      setConfig(prev => (prev.market === stored ? prev : { ...prev, market: stored }));
      return;
    }
    if (detectMarket() === 'kenya') {
      setConfig(prev => (prev.market === 'kenya' ? prev : { ...prev, market: 'kenya' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed mb-6">
            Configure your website tier, extra pages, payment integrations, and managed care plans.
            Itemized transparency with zero hidden markups.
          </p>

          <MarketToggle
            currentMarket={config.market}
            onChange={m => {
              try { window.localStorage.setItem(MARKET_STORAGE_KEY, m); } catch { /* preference won't persist */ }
              setConfig(prev => ({ ...prev, market: m }));
            }}
            className="items-start"
          />
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

                <div className="flex justify-between pt-6 border-t border-slate-200">
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
              <div className="space-y-2 mt-6">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-bold transition-colors shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" /> Send Quote to WhatsApp
                </a>
                <Link
                  href={`/contact?source=quote-calculator&market=${config.market}&package=${config.packageType}`}
                  className="btn-primary w-full justify-center text-xs py-3"
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
