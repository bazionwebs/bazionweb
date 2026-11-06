'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ADD_ON_RATE_CARD,
} from '@/lib/pricingData';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { getRegionalCountryOptions } from '@/lib/marketEngine';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  ShieldCheck,
  X,
  Loader2,
  Mail,
  User,
  Globe,
  Lock,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { buildWhatsAppLink, trackWhatsAppOpen } from '@/lib/contact';
import ClientJourneyProgress from '@/components/navigation/ClientJourneyProgress';
import ProposalPresentationView, { ProposalViewModel } from '@/components/quote/ProposalPresentationView';
import {
  type QuoteConfig,
  SERVICE_TO_QUOTE_CONFIG,
  PACKAGE_DEFAULTS,
  normalizeProposalPayload,
} from '@/lib/quote-flow';
import {
  BILLING_CYCLES_META,
  calculatePlanCyclePrice,
} from '@/lib/priceBooks';
import { toCleanUrl } from '@/lib/api-base';

function QuoteCalculatorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dismissedProposalRef = useRef<string | null>(null);
  const lastFetchedCodeRef = useRef<string | null>(null);

  const { market, marketCode, marketDef } = useMarketPreference();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [domainOption, setDomainOption] = useState<'domain-existing' | 'domain-co-ke' | 'domain-com' | 'domain-org'>('domain-existing');
  const [domainNameInput, setDomainNameInput] = useState('');
  const [config, setConfig] = useState<QuoteConfig>({
    market,
    packageType: (searchParams.get('package') as QuoteConfig['packageType']) || 'business',
    extraPages: 0,
    selectedAddOns: [],
    rushDelivery: false,
    care: 'none',
    hosting: 'host-business',
    billingCycle: (searchParams.get('cycle') as string) || 'annually',
  });

  // Get Started Modal State
  const [showModal, setShowModal] = useState(false);
  const [gName, setGName] = useState('');
  const [gEmail, setGEmail] = useState('');
  const [gCompany, setGCompany] = useState('');
  const quoteSubmissionRef = useRef(false);
  const initialCountryOptions = getRegionalCountryOptions(marketCode);
  const [gCountry, setGCountry] = useState(
    initialCountryOptions[0]?.code || (marketCode === 'KE' ? 'KE' : 'US')
  );
  const [gLoading, setGLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [activeProposal, setActiveProposal] = useState<ProposalViewModel | null>(null);
  const [isLoadingProposal, setIsLoadingProposal] = useState(false);
  const [proposalFetchError, setProposalFetchError] = useState<string | null>(null);

  // Sync config when market changes & clamp country to allowed regional options
  useEffect(() => {
    setConfig(prev => ({ ...prev, market }));
    const scopedOptions = getRegionalCountryOptions(marketCode);
    setGCountry(current => {
      const isValid = scopedOptions.some(opt => opt.code === current);
      return isValid ? current : (scopedOptions[0]?.code || (marketCode === 'KE' ? 'KE' : 'US'));
    });
  }, [market, marketCode]);

  async function fetchProposalByCode(code: string) {
    setIsLoadingProposal(true);
    setProposalFetchError(null);
    try {
      const res = await fetch(toCleanUrl(`/api/quote?code=${encodeURIComponent(code)}`));
      const envelope = await res.json().catch(() => ({}));
      if (!res.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.error || 'Proposal not found or reference code is invalid.');
      }
      const model = normalizeProposalPayload(envelope.data);
      setActiveProposal(model);
      if (model.clientName) setGName(model.clientName);
      if (model.clientEmail) setGEmail(model.clientEmail);
      if (model.clientCompany) setGCompany(model.clientCompany);
    } catch (err) {
      setProposalFetchError(err instanceof Error ? err.message : 'Could not retrieve proposal.');
    } finally {
      setIsLoadingProposal(false);
    }
  }

  const proposalParam = searchParams.get('proposal')?.trim() || null;
  const serviceParam = searchParams.get('service')?.toLowerCase().trim() || null;
  const pkgParam = searchParams.get('package')?.toLowerCase().trim() || null;
  const addonParam = searchParams.get('addon') || null;
  const cycleParam = searchParams.get('cycle')?.toLowerCase().trim() || null;

  // Hydrate proposal from URL parameter ?proposal=... on initial mount or URL change
  useEffect(() => {
    if (proposalParam) {
      const code = proposalParam.toUpperCase();
      if (dismissedProposalRef.current === code) {
        return;
      }
      if (!activeProposal || activeProposal.proposalCode !== code) {
        lastFetchedCodeRef.current = code;
        fetchProposalByCode(code);
      }
    } else {
      lastFetchedCodeRef.current = null;
      dismissedProposalRef.current = null;
      setActiveProposal(null);
    }
  }, [proposalParam, activeProposal]);

  // Support browser Back/Forward (popstate) between proposal view and calculator
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('proposal');
      if (code) {
        const clean = code.trim().toUpperCase();
        dismissedProposalRef.current = null;
        lastFetchedCodeRef.current = clean;
        fetchProposalByCode(clean);
      } else {
        lastFetchedCodeRef.current = null;
        dismissedProposalRef.current = null;
        setActiveProposal(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function handleResetToCalculator() {
    if (activeProposal) {
      dismissedProposalRef.current = activeProposal.proposalCode;
    } else if (proposalParam) {
      dismissedProposalRef.current = proposalParam.toUpperCase();
    }
    lastFetchedCodeRef.current = null;
    setActiveProposal(null);
    setProposalFetchError(null);
    router.replace('/quote', { scroll: false });
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/quote');
    }
  }

  // Map service parameter and explicit package/addon/cycle parameters
  useEffect(() => {
    if (!serviceParam && !pkgParam && !addonParam && !cycleParam) {
      return;
    }

    setConfig(prev => {
      let packageType = prev.packageType;
      let care = prev.care;
      let hosting = prev.hosting;
      let billingCycle = prev.billingCycle || 'annually';
      let selectedAddOns = [...prev.selectedAddOns];

      // 1. Map service slug to calculator defaults if present
      if (serviceParam && serviceParam in SERVICE_TO_QUOTE_CONFIG) {
        const mapping = SERVICE_TO_QUOTE_CONFIG[serviceParam];
        if (mapping.packageType) {
          packageType = mapping.packageType;
        }
        if (mapping.care) {
          care = mapping.care;
        }
        if (mapping.hosting) {
          hosting = mapping.hosting;
        }
        if (mapping.selectedAddOns) {
          selectedAddOns = Array.from(new Set([...selectedAddOns, ...mapping.selectedAddOns]));
        }
      }

      // 2. Explicit package parameter takes highest precedence for packageType
      if (pkgParam && pkgParam in PACKAGE_DEFAULTS) {
        packageType = pkgParam as QuoteConfig['packageType'];
      }

      // 3. Explicit add-on parameter
      if (addonParam && !selectedAddOns.includes(addonParam)) {
        selectedAddOns = [...selectedAddOns, addonParam];
      }

      // 4. Explicit cycle parameter
      if (cycleParam) {
        billingCycle = cycleParam;
      }

      const addonsUnchanged =
        selectedAddOns.length === prev.selectedAddOns.length &&
        selectedAddOns.every((val, idx) => val === prev.selectedAddOns[idx]);

      if (
        packageType === prev.packageType &&
        care === prev.care &&
        hosting === prev.hosting &&
        billingCycle === prev.billingCycle &&
        addonsUnchanged
      ) {
        return prev;
      }

      return {
        ...prev,
        packageType,
        care,
        hosting,
        billingCycle,
        selectedAddOns,
      };
    });
  }, [serviceParam, pkgParam, addonParam, cycleParam]);

  const currencySymbol = config.market === 'kenya' ? 'KSh' : '$';
  const pkgInfo = PACKAGE_DEFAULTS[config.packageType] || PACKAGE_DEFAULTS.business;

  // Calculation Logic — matches canonical priceBooks.ts (KE-2026-v1 & GLOBAL-2026-v1)
  const baseCost = config.market === 'kenya' ? pkgInfo.kenyaCost : pkgInfo.intlCost;
  const extraPageRate = config.market === 'kenya' ? 2000 : 40;
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

  const selectedCycleMeta = BILLING_CYCLES_META.find(
    m => m.cycle === config.billingCycle || m.enumValue === config.billingCycle
  ) || BILLING_CYCLES_META[3]; // default 1 Year / 'annually'

  // Care recurring costs — mapped from canonical single source of truth (priceBooks.ts)
  const CARE_BASE_MONTHLY: Record<string, { kenya: number; intl: number; canonicalAnnual: { kenya: number; intl: number } }> = {
    'care-essential': { kenya: 5000, intl: 75, canonicalAnnual: { kenya: 48000, intl: 720 } },
    'care-business': { kenya: 10000, intl: 150, canonicalAnnual: { kenya: 96000, intl: 1440 } },
    'care-professional': { kenya: 20000, intl: 300, canonicalAnnual: { kenya: 192000, intl: 2880 } },
    'care-enterprise': { kenya: 40000, intl: 400, canonicalAnnual: { kenya: 384000, intl: 3840 } },
    none: { kenya: 0, intl: 0, canonicalAnnual: { kenya: 0, intl: 0 } },
  };

  const careEntry = CARE_BASE_MONTHLY[config.care] ?? CARE_BASE_MONTHLY.none;
  const careMonthlyAmount = config.market === 'kenya' ? careEntry.kenya : careEntry.intl;
  const careAnnualCanonical = config.market === 'kenya' ? careEntry.canonicalAnnual.kenya : careEntry.canonicalAnnual.intl;

  const careCyclePricing = config.care !== 'none'
    ? calculatePlanCyclePrice(careMonthlyAmount, selectedCycleMeta.cycle, {
        isKes: config.market === 'kenya',
        canonicalAnnualAmount: careAnnualCanonical,
        annualDiscountPct: 20,
      })
    : { amount: 0, monthlyEquivalent: 0, discountPct: 0, durationMonths: 1 };

  const monthlyCare = careCyclePricing.monthlyEquivalent;

  // Hosting recurring costs — mapped from canonical single source of truth (priceBooks.ts)
  const HOSTING_BASE_MONTHLY: Record<string, { kenya: number; intl: number; canonicalAnnual: { kenya: number; intl: number } }> = {
    'host-essential': { kenya: 500, intl: 5.5, canonicalAnnual: { kenya: 4500, intl: 49 } },
    'host-business': { kenya: 950, intl: 11, canonicalAnnual: { kenya: 8500, intl: 99 } },
    'host-pro': { kenya: 1667, intl: 21, canonicalAnnual: { kenya: 15000, intl: 189 } },
    'host-professional': { kenya: 1667, intl: 21, canonicalAnnual: { kenya: 15000, intl: 189 } },
    'host-cloud': { kenya: 3200, intl: 32, canonicalAnnual: { kenya: 30000, intl: 300 } },
    none: { kenya: 0, intl: 0, canonicalAnnual: { kenya: 0, intl: 0 } },
  };

  const hostEntry = HOSTING_BASE_MONTHLY[config.hosting] ?? HOSTING_BASE_MONTHLY.none;
  const hostMonthlyAmount = config.market === 'kenya' ? hostEntry.kenya : hostEntry.intl;
  const hostAnnualCanonical = config.market === 'kenya' ? hostEntry.canonicalAnnual.kenya : hostEntry.canonicalAnnual.intl;

  const hostCyclePricing = config.hosting !== 'none'
    ? calculatePlanCyclePrice(hostMonthlyAmount, selectedCycleMeta.cycle, {
        isKes: config.market === 'kenya',
        canonicalAnnualAmount: hostAnnualCanonical,
        annualDiscountPct: config.hosting === 'host-cloud' ? 22 : 25,
      })
    : { amount: 0, monthlyEquivalent: 0, discountPct: 0, durationMonths: 1 };

  const annualHosting = hostAnnualCanonical;
  const cycleHostingTotal = hostCyclePricing.amount;

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
    if (!gName.trim() || !gEmail.trim() || quoteSubmissionRef.current) return;

    quoteSubmissionRef.current = true;
    setGLoading(true);
    setSubmissionError('');

    try {
      const response = await fetch(toCleanUrl('/api/quote'), {
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
          billingCycle: selectedCycleMeta.enumValue,
          clientName: gName.trim(),
          clientEmail: gEmail.trim().toLowerCase(),
          clientCompany: gCompany.trim(),
        }),
      });
      const quote = await response.json().catch(() => ({}));
      if (!response.ok || !quote.success || !quote.proposalCode) {
        throw new Error(quote.error || 'We could not save your proposal. Please retry.');
      }

      const model = normalizeProposalPayload(quote, {
        name: gName.trim(),
        email: gEmail.trim().toLowerCase(),
        company: gCompany.trim(),
      });

      setActiveProposal(model);
      setShowModal(false);

      if (typeof window !== 'undefined') {
        const nextUrl = `/quote?proposal=${encodeURIComponent(model.proposalCode)}`;
        window.history.pushState({ proposalCode: model.proposalCode }, '', nextUrl);
      }
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'We could not save your proposal. Please retry.');
    } finally {
      quoteSubmissionRef.current = false;
      setGLoading(false);
    }
  }

  if (isLoadingProposal) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="size-10 animate-spin text-[#2563EB] mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800">Retrieving official commercial proposal...</h2>
          <p className="text-xs text-slate-500 mt-1">Connecting to BazionWeb SSOT registry</p>
        </div>
      </main>
    );
  }

  if (activeProposal) {
    return (
      <ProposalPresentationView
        proposal={activeProposal}
        onReset={handleResetToCalculator}
        initialContact={{
          name: gName || activeProposal.clientName,
          email: gEmail || activeProposal.clientEmail,
          company: gCompany || activeProposal.clientCompany,
        }}
      />
    );
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

  const whatsappHref = buildWhatsAppLink(breakdownMessage);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-[#0F172A] pt-32 pb-14 text-white">
        <div className="container-default max-w-5xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Instant Quote Calculator' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mt-4 mb-3">
            Interactive Cost Estimator
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Build your custom project estimate
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed mb-4">
            Configure your website tier (existing or new build), domain name, managed hosting, and optional care plans on a single page with a live frozen summary.
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

      {/* Step-by-Step Client Journey Banner (Below Hero Banner with High Contrast) */}
      <div className="bg-[#0B1120] border-b border-slate-800 py-5">
        <div className="container-default max-w-5xl">
          <ClientJourneyProgress currentStep={2} variant="dark" />
        </div>
      </div>

      {/* Distinct Dark Slate Sticky Step Bar (Different from White Navbar) */}
      <div className="sticky top-20 z-30 bg-[#1E293B] backdrop-blur-md border-y border-slate-700/80 shadow-md text-white">
        <div className="container-default max-w-5xl py-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { num: 1, label: '1. Website / App Foundation (Mandatory)' },
              { num: 2, label: '2. Add-Ons & Domain Name (Mandatory)' },
              { num: 3, label: '3. Managed Hosting & Care Plan' },
            ].map((s) => {
              const active = step === s.num;
              const done = step > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num as 1 | 2 | 3)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    active
                      ? 'bg-[#14B8A6] text-slate-950 shadow-sm'
                      : done
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                        : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : active
                          ? 'bg-slate-950 text-[#14B8A6]'
                          : 'bg-slate-900 text-slate-300'
                    }`}
                  >
                    {done ? <Check className="w-3 h-3" /> : s.num}
                  </div>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {proposalFetchError && (
        <div className="container-default max-w-5xl mx-auto pt-6 px-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>{proposalFetchError} You can configure a new custom quote below.</span>
            </div>
            <button
              type="button"
              onClick={() => setProposalFetchError(null)}
              className="text-amber-800 hover:text-amber-950 font-bold underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="container-default max-w-5xl py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Step Configurator */}
          <div className="lg:col-span-2 space-y-6">
            {/* STEP 1: Core Package & Pages */}
            {step === 1 && (
              <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-[#0F172A] mb-1">
                  1. Select Your Website Foundation (Existing or New Build)
                </h2>
                <p className="text-xs text-slate-500 mb-6">
                  Start with an already-built website (0 base build fee) or select a new website, e-commerce store, or custom digital system.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {(
                    [
                      { id: 'existing', name: 'Existing Website (Bring Your Own)', desc: 'Already have a site? Add features, domain, or hosting', pages: 0 },
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

            {/* STEP 2: Domain Name & Add-Ons */}
            {step === 2 && (
              <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A] mb-1">
                    2. Domain Name &amp; Add-On Modules
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Choose whether you already own a domain or need a new registration, then select any optional add-on modules.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {[
                      { id: 'domain-existing' as const, label: 'I Already Own a Domain', price: `${currencySymbol} 0 (Free DNS/SSL Setup)` },
                      { id: 'domain-co-ke' as const, label: 'Register .co.ke Domain', price: config.market === 'kenya' ? 'KSh 1,500/yr' : '$15/yr' },
                      { id: 'domain-com' as const, label: 'Register .com Domain', price: config.market === 'kenya' ? 'KSh 2,500/yr' : '$20/yr' },
                      { id: 'domain-org' as const, label: 'Register .org Domain', price: config.market === 'kenya' ? 'KSh 3,500/yr' : '$28/yr' },
                    ].map((dom) => (
                      <button
                        key={dom.id}
                        type="button"
                        onClick={() => setDomainOption(dom.id)}
                        className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                          domainOption === dom.id
                            ? 'border-[#2563EB] bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold text-xs text-[#0F172A]">{dom.label}</div>
                        <div className="text-xs font-extrabold text-[#14B8A6] mt-0.5">{dom.price}</div>
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={domainNameInput}
                    onChange={(e) => setDomainNameInput(e.target.value)}
                    placeholder="Optional: Enter your existing or desired domain (e.g. mycompany.co.ke)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Optional Add-On Modules &amp; Integrations:
                  </div>
                <div className="space-y-3 mb-6">
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

            {/* STEP 3: Care, Hosting & Commitment Cycle */}
            {step === 3 && (
              <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A] mb-1">
                    3. Website Care &amp; Infrastructure
                  </h2>
                  <p className="text-xs text-slate-500 mb-6">
                    Choose your billing commitment cycle and ongoing maintenance/cloud hosting tier. Progressive multi-year commitments unlock up to 40% savings.
                  </p>

                  {/* Multi-cycle commitment selector pill */}
                  <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Select Commitment Billing Cycle:
                      </span>
                      <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        {selectedCycleMeta.discountPct > 0 ? `Save up to ${selectedCycleMeta.discountPct}%` : 'Standard 1-Month'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {BILLING_CYCLES_META.map(meta => {
                        const isSelected = (config.billingCycle || 'annually') === meta.cycle;
                        return (
                          <button
                            key={meta.cycle}
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, billingCycle: meta.cycle }))}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center relative ${
                              isSelected
                                ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {meta.popular && (
                              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#2563EB] text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider whitespace-nowrap">
                                Best Value
                              </span>
                            )}
                            <div>{meta.label}</div>
                            <div className={`text-[10px] mt-0.5 font-medium ${isSelected ? 'text-teal-300' : 'text-slate-500'}`}>
                              {meta.discountPct > 0 ? `-${meta.discountPct}% off` : '0% off'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Monthly Care options */}
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Proactive Website Care &amp; Support ({selectedCycleMeta.label}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                    {[
                      {
                        id: 'care-essential',
                        name: 'Care Essential',
                        desc: 'Core CMS updates, daily cloud backups, security scans + 1 hr engineer support',
                        baseMonthly: config.market === 'kenya' ? 5000 : 75,
                        canonicalAnnual: config.market === 'kenya' ? 48000 : 720,
                      },
                      {
                        id: 'care-business',
                        name: 'Care Business',
                        desc: 'Weekly updates, Web Vitals, SEO audits + 2 hrs priority engineer support',
                        rec: true,
                        baseMonthly: config.market === 'kenya' ? 10000 : 150,
                        canonicalAnnual: config.market === 'kenya' ? 96000 : 1440,
                      },
                      {
                        id: 'care-professional',
                        name: 'Care Professional',
                        desc: 'Continuous sprint dev, speed audits + 5 hrs dedicated engineering',
                        baseMonthly: config.market === 'kenya' ? 20000 : 300,
                        canonicalAnnual: config.market === 'kenya' ? 192000 : 2880,
                      },
                      {
                        id: 'care-enterprise',
                        name: 'Care Enterprise',
                        desc: 'Dedicated engineering pod, 24/7 SLA, and full-lifecycle cloud management',
                        baseMonthly: config.market === 'kenya' ? 40000 : 400,
                        canonicalAnnual: config.market === 'kenya' ? 384000 : 3840,
                      },
                      {
                        id: 'none',
                        name: 'No Care Plan (Warranty Only)',
                        desc: 'Standard defect warranty only; no proactive updates or reserved hours',
                        baseMonthly: 0,
                        canonicalAnnual: 0,
                      },
                    ].map(c => {
                      const isSelected = config.care === c.id;
                      const cycleP = c.id !== 'none'
                        ? calculatePlanCyclePrice(c.baseMonthly, selectedCycleMeta.cycle, {
                            isKes: config.market === 'kenya',
                            canonicalAnnualAmount: c.canonicalAnnual,
                            annualDiscountPct: 20,
                          })
                        : null;
                      const displayPrice = cycleP
                        ? selectedCycleMeta.durationMonths === 1
                          ? `${currencySymbol} ${cycleP.monthlyEquivalent.toLocaleString()}/mo`
                          : `${currencySymbol} ${cycleP.monthlyEquivalent.toLocaleString()}/mo (${currencySymbol} ${cycleP.amount.toLocaleString()} / ${selectedCycleMeta.durationMonths} mos)`
                        : 'Included Warranty';

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setConfig(prev => ({ ...prev, care: c.id }))}
                          className={`text-left p-4 rounded-xl border-2 transition-all relative ${
                            isSelected
                              ? 'border-[#2563EB] bg-blue-50/40 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {c.rec && (
                            <span className="absolute -top-2.5 right-3 bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Popular
                            </span>
                          )}
                          <div className="font-bold text-sm text-[#0F172A]">{c.name}</div>
                          <div className="text-xs text-slate-500 mb-1.5">{c.desc}</div>
                          <div className="text-xs font-extrabold text-[#14B8A6]">{displayPrice}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Managed Hosting options */}
                  <div className="pt-6 border-t border-slate-200">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Managed High-Performance Hosting ({selectedCycleMeta.label}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        {
                          id: 'host-essential',
                          name: 'Essential Hosting',
                          desc: 'Managed cloud container, automated SSL, weekly backups',
                          baseMonthly: config.market === 'kenya' ? 500 : 5.5,
                          canonicalAnnual: config.market === 'kenya' ? 4500 : 49,
                        },
                        {
                          id: 'host-business',
                          name: 'Business Hosting',
                          desc: 'Global Edge CDN, daily snapshots, staging slot, WAF protection',
                          rec: true,
                          baseMonthly: config.market === 'kenya' ? 950 : 11,
                          canonicalAnnual: config.market === 'kenya' ? 8500 : 99,
                        },
                        {
                          id: 'host-pro',
                          name: 'Host Professional',
                          desc: 'Dedicated compute, Redis object caching, 30-day snapshots',
                          baseMonthly: config.market === 'kenya' ? 1667 : 21,
                          canonicalAnnual: config.market === 'kenya' ? 15000 : 189,
                        },
                        {
                          id: 'host-cloud',
                          name: 'Managed Cloud Cluster',
                          desc: 'Isolated Docker cluster, dedicated PostgreSQL & Redis, 99.95% SLA',
                          baseMonthly: config.market === 'kenya' ? 3200 : 32,
                          canonicalAnnual: config.market === 'kenya' ? 30000 : 300,
                        },
                        {
                          id: 'none',
                          name: 'No Hosting (Client Hosted)',
                          desc: 'Deploy to your existing AWS, Vercel, or cPanel environment',
                          baseMonthly: 0,
                          canonicalAnnual: 0,
                        },
                      ].map(h => {
                        const isSelected = config.hosting === h.id;
                        const cycleP = h.id !== 'none'
                          ? calculatePlanCyclePrice(h.baseMonthly, selectedCycleMeta.cycle, {
                              isKes: config.market === 'kenya',
                              canonicalAnnualAmount: h.canonicalAnnual,
                              annualDiscountPct: h.id === 'host-cloud' ? 22 : 25,
                            })
                          : null;
                        const displayPrice = cycleP
                          ? selectedCycleMeta.durationMonths === 1
                            ? `${currencySymbol} ${cycleP.monthlyEquivalent.toLocaleString()}/mo`
                            : `${currencySymbol} ${cycleP.monthlyEquivalent.toLocaleString()}/mo (${currencySymbol} ${cycleP.amount.toLocaleString()} / ${selectedCycleMeta.durationMonths} mos)`
                          : 'Self-Hosted';

                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, hosting: h.id }))}
                            className={`text-left p-4 rounded-xl border-2 transition-all relative ${
                              isSelected
                                ? 'border-[#2563EB] bg-blue-50/40 shadow-xs'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {h.rec && (
                              <span className="absolute -top-2.5 right-3 bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Popular
                              </span>
                            )}
                            <div className="font-bold text-sm text-[#0F172A]">{h.name}</div>
                            <div className="text-xs text-slate-500 mb-1.5">{h.desc}</div>
                            <div className="text-xs font-extrabold text-[#2563EB]">{displayPrice}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-200">
                  {/* Primary CTA: Get Started */}
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 active:scale-[0.98] text-white text-sm font-black transition-all shadow-xl shadow-slate-900/10 group"
                  >
                    <FileText className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                    <span>Request Official Project Proposal</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <div className="flex justify-between items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackWhatsAppOpen('quote')}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Quote
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Authoritative Proposal & Scope Summary */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="bg-white border border-slate-200/90 shadow-xl shadow-slate-900/5 rounded-3xl p-6 relative overflow-hidden ring-1 ring-slate-900/5">
              {/* Subtle top accent bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#2563EB] via-indigo-600 to-teal-500" />

              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                    Proposal Summary
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  <Globe className="w-3 h-3 text-[#2563EB]" />
                  <span>{config.market === 'kenya' ? 'Kenya · KES' : 'Global · USD'}</span>
                </div>
              </div>

              {/* Scope Breakdown */}
              <div className="space-y-3 py-2 text-xs">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{pkgInfo.name}</span>
                    <span className="text-[11px] text-slate-400">
                      Baseline build ({pkgInfo.basePages} pages included)
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 text-sm shrink-0">
                    {currencySymbol} {baseCost.toLocaleString()}
                  </span>
                </div>

                {config.extraPages > 0 && (
                  <div className="flex justify-between items-center text-slate-600 py-1 border-t border-dashed border-slate-100">
                    <span>+{config.extraPages} Additional Custom Pages</span>
                    <span className="font-semibold text-slate-900">
                      +{currencySymbol} {extraPagesCost.toLocaleString()}
                    </span>
                  </div>
                )}

                {config.selectedAddOns.map(id => {
                  const item = ADD_ON_RATE_CARD.find(a => a.id === id);
                  if (!item) return null;
                  const itemPrice = config.market === 'kenya' ? item.rawKes : item.rawUsd;
                  return (
                    <div key={id} className="flex justify-between items-center text-slate-600 py-1 border-t border-dashed border-slate-100">
                      <span className="truncate pr-2">• {item.name}</span>
                      <span className="font-semibold text-slate-900 shrink-0">
                        +{currencySymbol} {itemPrice.toLocaleString()}
                      </span>
                    </div>
                  );
                })}

                {config.rushDelivery && (
                  <div className="flex justify-between items-center text-amber-700 py-1 border-t border-dashed border-slate-100 font-semibold">
                    <span>Priority Rush Delivery (+35%)</span>
                    <span>+{currencySymbol} {rushCost.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Recurring & Maintenance */}
              <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-[11px] font-medium text-slate-500">Billing Cycle:</span>
                  <span className="font-bold text-[#2563EB]">
                    {selectedCycleMeta.label} ({selectedCycleMeta.durationMonths} mos{selectedCycleMeta.discountPct > 0 ? `, -${selectedCycleMeta.discountPct}%` : ''})
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] font-medium text-slate-500">Website Care &amp; Support:</span>
                  <span className="font-bold text-slate-900">
                    {monthlyCare > 0 ? `${currencySymbol} ${monthlyCare.toLocaleString()}/mo` : 'Included Defect Warranty'}
                  </span>
                </div>
                {config.hosting !== 'none' && (
                  <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                    <span className="text-[11px] font-medium text-slate-500">Managed Hosting ({selectedCycleMeta.label}):</span>
                    <span className="font-bold text-slate-900">
                      +{currencySymbol} {cycleHostingTotal.toLocaleString()} / {selectedCycleMeta.durationMonths} mos
                    </span>
                  </div>
                )}
              </div>

              {/* Total Investment Block */}
              <div className="pt-2">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Estimated Build
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {currencySymbol} {totalBuild.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                  <span>50% Kickoff Deposit on approval:</span>
                  <span className="font-bold text-emerald-600">
                    {currencySymbol} {Math.round(totalBuild * 0.5).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons: HERO PROPOSAL BUTTON is prominent, others do NOT shout */}
              <div className="space-y-2.5 pt-2">
                {/* 1. HERO PROPOSAL CTA */}
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 active:scale-[0.99] text-white text-sm font-black transition-all shadow-xl shadow-slate-900/20 group"
                >
                  <FileText className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                  <span>Request Official Project Proposal</span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* 2. SUBTLE, DE-ESCALATED SECONDARY OPTIONS */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackWhatsAppOpen('quote')}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-600 hover:text-emerald-700 text-xs font-semibold transition-all text-center"
                    title="Share this estimate via WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Quote</span>
                  </a>

                  <Link
                    href={`/contact?source=quote-calculator&package=${config.packageType}`}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-all text-center"
                  >
                    <span>Free Consultation</span>
                  </Link>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>100% IP &amp; Code Ownership. Zero Vendor Lock-in.</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Price locked for 30 days upon proposal generation.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Get Started Modal Overlay ─────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proposal-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
            {/* Modal header - Clean, Executive Obsidian */}
            <div className="bg-[#0F172A] px-7 py-6 text-white relative">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close proposal form"
                className="absolute right-5 top-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-teal-400">
                  Instant Project Proposal
                </span>
              </div>
              <h2 id="proposal-modal-title" className="text-xl font-black text-white tracking-tight">
                Request Your Formal Proposal
              </h2>
              <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                We&apos;ll generate an official itemized proposal, milestone delivery schedule, and 30-day fixed price lock.
              </p>
            </div>

            {/* Configured Package Summary Chip inside modal */}
            <div className="px-7 pt-5 pb-1">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Target Build</span>
                  <span className="font-extrabold text-slate-900 text-sm">{pkgInfo.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Estimated Scope</span>
                  <span className="font-black text-[#2563EB] text-sm">{currencySymbol} {totalBuild.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal form - Clean, Straightforward, No Stuffy Overcrowding */}
            <form onSubmit={handleGetStarted} className="px-7 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="gs-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="gs-name"
                      type="text"
                      required
                      autoFocus
                      autoComplete="name"
                      maxLength={100}
                      value={gName}
                      onChange={e => setGName(e.target.value)}
                      placeholder="Jane Wanjiku"
                      className="w-full border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="gs-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="gs-email"
                      type="email"
                      required
                      autoComplete="email"
                      maxLength={254}
                      value={gEmail}
                      onChange={e => setGEmail(e.target.value)}
                      placeholder="jane@yourcompany.com"
                      className="w-full border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="gs-company" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Company or Organization <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="gs-company"
                  type="text"
                  maxLength={100}
                  value={gCompany}
                  onChange={e => setGCompany(e.target.value)}
                  placeholder="e.g. Acacia Healthcare Ltd"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                />
              </div>

              <div>
                <label htmlFor="gs-country" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Contracting Region &amp; Currency
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    id="gs-country"
                    value={gCountry}
                    onChange={e => {
                      setGCountry(e.target.value);
                    }}
                    className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium cursor-pointer"
                  >
                    {getRegionalCountryOptions(marketCode).map(option => (
                      <option key={option.code} value={option.code}>
                        {option.flag} {option.name} ({option.description})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <Lock className="w-3 h-3 text-emerald-600" /> Fixed Price Locked for 30 Days
                  </span>
                  <span className="text-slate-400">Zero Obligation</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={gLoading || !gName.trim() || !gEmail.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs transition-all shadow-xl shadow-slate-900/10 mt-3 group"
              >
                {gLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span>Preparing Official Proposal…</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                    <span>Generate Official Project Proposal</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {submissionError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submissionError}</span>
                </div>
              )}

              <p className="text-center text-[11px] text-slate-400 leading-relaxed pt-1">
                No credit card or upfront payment needed. By proceeding, you agree to our{' '}
                <Link href="/legal/terms" className="text-slate-600 hover:text-slate-900 underline font-medium">Terms of Service</Link>.
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
