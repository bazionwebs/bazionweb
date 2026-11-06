'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  EXISTING_WEBSITE_PACKAGE,
  WEBSITE_PACKAGES,
  ECOMMERCE_PACKAGES,
  CUSTOM_SYSTEM_TIERS,
  DOMAIN_PACKAGES,
  CARE_PLANS,
  MANAGED_HOSTING_PLANS,
  ADD_ON_RATE_CARD,
} from '@/lib/pricingData';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { MarketCode } from '@/lib/marketEngine';
import AddonPriceCard from '@/components/pricing/AddonPriceCard';
import PricingPrinciplesSection from '@/components/pricing/PricingPrinciplesSection';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import ClientJourneyProgress from '@/components/navigation/ClientJourneyProgress';
import StoreOrderSummary from '@/components/store/StoreOrderSummary';
import {
  useCartStore,
  isWebsiteItem,
  isDomainItem,
  isHostingItem,
  isCarePlanItem,
  isAddOnItem,
} from '@/lib/cart';
import {
  getPriceBookForMarket,
  BILLING_CYCLES_META,
  CommitmentCycle,
} from '@/lib/priceBooks';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Globe,
  ShoppingCart,
  Cpu,
  Wrench,
  Server,
  Plus,
  Sparkles,
  Lock,
  HelpCircle,
} from 'lucide-react';

export type TabKey = 'websites' | 'ecommerce' | 'custom' | 'care' | 'hosting' | 'addons';

export const VALID_TABS: readonly TabKey[] = [
  'websites',
  'ecommerce',
  'custom',
  'care',
  'hosting',
  'addons',
] as const;

export interface PricingViewProps {
  initialMarket?: MarketCode;
}

function getStepForTab(tab: TabKey): 1 | 2 | 3 | 4 {
  if (tab === 'hosting') return 3;
  if (tab === 'care') return 4;
  return 1;
}

export default function PricingView({ initialMarket }: PricingViewProps = {}) {
  const { market, marketCode, marketDef } = useMarketPreference(initialMarket);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get('tab') as TabKey | null;
  const initialTab: TabKey =
    tabParam && (VALID_TABS as readonly string[]).includes(tabParam) ? tabParam : 'websites';

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [expandedStep, setExpandedStep] = useState<1 | 2 | 3 | 4>(() => getStepForTab(initialTab));
  const [showAddonsInStep1, setShowAddonsInStep1] = useState<boolean>(initialTab === 'addons');
  const [domainInput, setDomainInput] = useState<string>('');
  const [careCycle, setCareCycle] = useState<CommitmentCycle>('monthly');
  const [hostingCycle, setHostingCycle] = useState<CommitmentCycle>('annually');

  const priceBook = getPriceBookForMarket(marketCode);
  const {
    items: cartItems,
    add: addToCart,
    remove: removeFromCart,
    setQty: setCartQty,
  } = useCartStore();

  const selectedWebsite = cartItems.find(isWebsiteItem);
  const selectedDomain = cartItems.find(isDomainItem);
  const selectedHosting = cartItems.find(isHostingItem);
  const selectedCare = cartItems.find(isCarePlanItem);
  const selectedAddons = cartItems.filter(isAddOnItem);

  const normalizeWebsiteCartId = (slug: string) => {
    if (slug.startsWith('website-') || slug.startsWith('ecommerce-') || slug.startsWith('custom-tier-')) {
      return slug;
    }
    if (slug.startsWith('ecom-')) {
      return `ecommerce-${slug.replace('ecom-', '')}`;
    }
    if (slug === 'professional') return 'website-pro';
    return `website-${slug}`;
  };

  useEffect(() => {
    const currentTab = searchParams.get('tab') as TabKey | null;
    if (currentTab && (VALID_TABS as readonly string[]).includes(currentTab) && currentTab !== activeTab) {
      setActiveTab(currentTab);
      setExpandedStep(getStepForTab(currentTab));
      if (currentTab === 'addons') {
        setShowAddonsInStep1(true);
      }
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (newTab: TabKey) => {
    setActiveTab(newTab);
    setExpandedStep(getStepForTab(newTab));
    if (newTab === 'addons') {
      setShowAddonsInStep1(true);
    }
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('tab', newTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggleAccordionStep = (step: 1 | 2 | 3 | 4) => {
    setExpandedStep(step);
    if (step === 1 && (activeTab === 'hosting' || activeTab === 'care')) {
      setActiveTab('websites');
    } else if (step === 3 && activeTab !== 'hosting') {
      setActiveTab('hosting');
    } else if (step === 4 && activeTab !== 'care') {
      setActiveTab('care');
    }
  };

  const resolveBookAmount = (slug: string, fallbackKes: number, fallbackUsd: number): number => {
    const item = priceBook.items[slug];
    if (item) return item.amount;
    return marketCode === 'KE' ? fallbackKes : fallbackUsd;
  };

  const handleSelectWebsitePackage = (
    slug: string,
    name: string,
    fallbackKes: number,
    fallbackUsd: number,
    autoAdvance = false
  ) => {
    const canonicalId = normalizeWebsiteCartId(slug);
    const unitPrice = resolveBookAmount(canonicalId, fallbackKes, fallbackUsd);
    addToCart({
      kind: 'CATALOG',
      id: canonicalId,
      name,
      cycle: 'one-time',
      qty: 1,
      unitPrice,
      currency: marketDef.currency,
    });
    if (autoAdvance) {
      setExpandedStep(2);
    }
  };

  const handleSelectDomainPackage = (
    slug: string,
    name: string,
    fallbackKes: number,
    fallbackUsd: number
  ) => {
    const unitPrice = resolveBookAmount(slug, fallbackKes, fallbackUsd);
    const trimmedDomain = domainInput.trim();
    addToCart({
      kind: 'CATALOG',
      id: slug,
      name: trimmedDomain ? `${name} (${trimmedDomain})` : name,
      cycle: slug === 'domain-existing' ? 'one-time' : 'year',
      qty: 1,
      unitPrice,
      currency: marketDef.currency,
      meta: trimmedDomain || undefined,
    });
    setExpandedStep(3);
    setActiveTab('hosting');
  };

  const handleSelectHostingPlan = (
    slug: string,
    name: string,
    fallbackKes: number,
    fallbackUsd: number
  ) => {
    const bookItem = priceBook.items[slug];
    const opt = bookItem?.billingOptions?.find((o) => o.cycle === hostingCycle);
    const unitPrice = opt ? opt.amount : resolveBookAmount(slug, fallbackKes, fallbackUsd);
    addToCart({
      kind: 'CATALOG',
      id: slug,
      name: `${name} (${opt?.label || 'Annual'})`,
      cycle: hostingCycle === 'monthly' ? 'month' : 'year',
      qty: 1,
      unitPrice,
      currency: marketDef.currency,
    });
    setExpandedStep(4);
    setActiveTab('care');
  };

  const handleSelectCarePlan = (
    slug: string,
    name: string,
    fallbackKes: number,
    fallbackUsd: number
  ) => {
    const bookItem = priceBook.items[slug];
    const opt = bookItem?.billingOptions?.find((o) => o.cycle === careCycle);
    const unitPrice = opt ? opt.amount : resolveBookAmount(slug, fallbackKes, fallbackUsd);
    addToCart({
      kind: 'PLAN',
      id: slug,
      name: `${name} (${opt?.label || 'Monthly'})`,
      cycle: careCycle === 'monthly' ? 'MONTHLY' : 'ANNUAL',
      qty: 1,
      unitPrice,
      currency: marketDef.currency,
    });
  };

  return (
    <>
      {/* ─── Hero Section ─── */}
      <section className="section bg-[#0F172A] pt-32 pb-14 text-white">
        <div className="container-default text-center max-w-4xl mx-auto">
          <div className="flex justify-center mb-4">
            <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Pricing Architecture' }]} />
          </div>

          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            2026 Commercial Price Book
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-5 tracking-tight">
            Transparent engineering pricing
          </h1>

          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-6 leading-relaxed">
            Configure your complete digital stack on one page — start with an existing or new website, attach your domain, select managed hosting, and optionally add ongoing care while watching your live cart total.
          </p>

          {/* Clean, Localized Schedule Indicator */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-slate-300">
            <span>{marketDef.flag}</span>
            <span className="font-semibold text-white">{marketDef.currency} Commercial Schedule</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">
              {marketCode === 'KE' ? 'M-Pesa STK · 16% KRA VAT Inclusive' : 'Card / Wire · 0% Export'}
            </span>
          </div>
        </div>
      </section>

      {/* ─── Step-by-Step Client Journey Banner (Below Hero Banner with High Contrast) ─── */}
      <section className="bg-[#0B1120] border-b border-slate-800 py-5">
        <div className="container-default max-w-6xl mx-auto">
          <ClientJourneyProgress currentStep={1} variant="dark" />
        </div>
      </section>

      {/* ─── Distinct Dark Slate Sticky Navigation Bar (Different from White Navbar) ─── */}
      <section className="sticky top-20 z-30 bg-[#1E293B] backdrop-blur-md border-y border-slate-700/80 shadow-md text-white">
        <div className="container-default py-3 space-y-2.5">
          {/* Mandatory 4-Step Stack Flow Pills */}
          <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar pb-1 border-b border-slate-700/70">
            {[
              {
                step: 1 as const,
                label: '1. Website & Add-Ons',
                badge: 'Mandatory',
                done: Boolean(selectedWebsite),
              },
              {
                step: 2 as const,
                label: '2. Domain Name',
                badge: 'Mandatory',
                done: Boolean(selectedDomain),
              },
              {
                step: 3 as const,
                label: '3. Managed Hosting',
                badge: 'Mandatory',
                done: Boolean(selectedHosting),
              },
              {
                step: 4 as const,
                label: '4. Care Plan',
                badge: 'Optional',
                done: Boolean(selectedCare),
              },
            ].map((item) => {
              const isOpen = expandedStep === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  aria-label={`Jump to Step ${item.step}`}
                  onClick={() => toggleAccordionStep(item.step)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isOpen
                      ? 'bg-[#14B8A6] text-slate-950 shadow-sm ring-2 ring-[#14B8A6]/40'
                      : item.done
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900/80'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-700 hover:bg-slate-700/80'
                  }`}
                >
                  {item.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-900/60 text-[10px] flex items-center justify-center font-black">
                      {item.step}
                    </span>
                  )}
                  <span>{item.label}</span>
                  <span
                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold ${
                      isOpen
                        ? 'bg-slate-950/20 text-slate-950'
                        : item.badge === 'Mandatory'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'websites', label: 'Websites', icon: Globe },
              { id: 'ecommerce', label: 'E-Commerce', icon: ShoppingCart },
              { id: 'custom', label: 'Custom Digital Systems', icon: Cpu },
              { id: 'care', label: 'Website Care & Maintenance', icon: Wrench },
              { id: 'hosting', label: 'Managed Hosting', icon: Server },
              { id: 'addons', label: 'Add-On Price Card', icon: Wrench },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabKey)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/30 ring-1 ring-blue-400'
                      : 'text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Single-Page Collapsible 4-Step Configurator + Frozen Cart ─── */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT COLUMN: 4-Step Collapsible Accordion Menu */}
            <div className="lg:col-span-8 space-y-5">
              {/* ══════════════════════════════════════════════════════════════════
                  STEP 1: WEBSITE / APP FOUNDATION & ADD-ONS (MANDATORY)
                 ══════════════════════════════════════════════════════════════════ */}
              <div className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-xs overflow-hidden">
                <button
                  type="button"
                  aria-label="Toggle Step 1 Accordion"
                  onClick={() => toggleAccordionStep(1)}
                  aria-expanded={expandedStep === 1}
                  className={`w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left transition-colors ${
                    expandedStep === 1 ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50 text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        selectedWebsite
                          ? 'bg-emerald-500 text-white'
                          : expandedStep === 1
                            ? 'bg-[#14B8A6] text-slate-950'
                            : 'bg-blue-50 text-[#2563EB]'
                      }`}
                    >
                      {selectedWebsite ? <Check className="w-5 h-5" /> : '1'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base sm:text-lg font-extrabold">
                          Step 1: Website / App Foundation &amp; Add-Ons
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            selectedWebsite
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-400/30'
                          }`}
                        >
                          {selectedWebsite ? `✓ ${selectedWebsite.name}` : 'Mandatory Step 1'}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 ${
                          expandedStep === 1 ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Start with your existing website/app OR select a new build tier, plus any optional add-ons.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold hidden sm:inline">
                      {expandedStep === 1 ? 'Collapse' : 'Expand'}
                    </span>
                    {expandedStep === 1 ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </button>

                {expandedStep === 1 && (
                  <div className="p-5 sm:p-7 space-y-8 border-t border-slate-200">
                    {/* Option A: Client Coming With an Already-Built Website */}
                    <div
                      className={`rounded-2xl border-2 p-5 sm:p-6 transition-all ${
                        selectedWebsite?.id === EXISTING_WEBSITE_PACKAGE.id
                          ? 'border-emerald-500 bg-emerald-50/40 shadow-sm'
                          : 'border-teal-500/40 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                        <div className="space-y-1.5 max-w-xl">
                          <div className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#14B8A6]/20 text-[#14B8A6]">
                            <Sparkles className="w-3.5 h-3.5" />
                            {EXISTING_WEBSITE_PACKAGE.badge}
                          </div>
                          <h3
                            className={`text-lg sm:text-xl font-extrabold ${
                              selectedWebsite?.id === EXISTING_WEBSITE_PACKAGE.id
                                ? 'text-slate-900'
                                : 'text-white'
                            }`}
                          >
                            {EXISTING_WEBSITE_PACKAGE.name}
                          </h3>
                          <p
                            className={`text-xs leading-relaxed ${
                              selectedWebsite?.id === EXISTING_WEBSITE_PACKAGE.id
                                ? 'text-slate-600'
                                : 'text-slate-300'
                            }`}
                          >
                            {EXISTING_WEBSITE_PACKAGE.description}
                          </p>
                          <div className="flex flex-wrap gap-3 pt-1">
                            {EXISTING_WEBSITE_PACKAGE.deliverables.slice(0, 3).map((d, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                  selectedWebsite?.id === EXISTING_WEBSITE_PACKAGE.id
                                    ? 'text-emerald-700'
                                    : 'text-teal-300'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" /> {d}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0">
                          <div className="sm:text-right">
                            <div
                              className={`text-2xl font-black ${
                                selectedWebsite?.id === EXISTING_WEBSITE_PACKAGE.id
                                  ? 'text-emerald-700'
                                  : 'text-white'
                              }`}
                            >
                              {market === 'kenya'
                                ? EXISTING_WEBSITE_PACKAGE.kenyaPrice
                                : EXISTING_WEBSITE_PACKAGE.intlPrice}
                            </div>
                            <div
                              className={`text-[11px] ${
                                selectedWebsite?.id === EXISTING_WEBSITE_PACKAGE.id
                                  ? 'text-slate-500'
                                  : 'text-slate-400'
                              }`}
                            >
                              Base Build Fee (Pay only for Add-Ons, Domain &amp; Hosting)
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectWebsitePackage(
                                  EXISTING_WEBSITE_PACKAGE.id,
                                  EXISTING_WEBSITE_PACKAGE.name,
                                  0,
                                  0,
                                  false
                                )
                              }
                              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                                selectedWebsite?.id === EXISTING_WEBSITE_PACKAGE.id
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-[#14B8A6] text-slate-950 hover:bg-teal-400'
                              }`}
                            >
                              {selectedWebsite?.id === EXISTING_WEBSITE_PACKAGE.id ? (
                                <>
                                  <Check className="w-4 h-4" /> Existing Website Selected
                                </>
                              ) : (
                                <>
                                  Use My Existing Website <ArrowRight className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectWebsitePackage(
                                  EXISTING_WEBSITE_PACKAGE.id,
                                  EXISTING_WEBSITE_PACKAGE.name,
                                  0,
                                  0,
                                  false
                                );
                                setShowAddonsInStep1(true);
                              }}
                              className="px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-500/50 hover:bg-white/10 transition-all"
                            >
                              + Pick Add-Ons
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* TAB 1: WEBSITES */}
                    {(activeTab === 'websites' || activeTab === 'care' || activeTab === 'hosting') && (
                      <div className="space-y-6">
                        <div className="text-center max-w-2xl mx-auto">
                          <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2">
                            Business &amp; Organizational Websites
                          </h2>
                          <p className="text-sm text-slate-500">
                            Need a brand-new website built? Select a package below to add it to your stack, then customize with optional add-ons.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {WEBSITE_PACKAGES.map((pkg) => {
                            const price = market === 'kenya' ? pkg.kenyaPrice : pkg.intlPrice;
                            const canonicalId = normalizeWebsiteCartId(pkg.id);
                            const isSelected = selectedWebsite?.id === canonicalId;
                            const bookItem = priceBook.items[canonicalId];
                            const fallbackKes = bookItem?.amount ?? 25000;
                            const fallbackUsd = bookItem?.amount ?? 450;

                            return (
                              <div
                                key={pkg.id}
                                className={`relative bg-white rounded-2xl border-2 pt-8 pb-6 px-5 flex flex-col transition-all hover:shadow-lg ${
                                  isSelected
                                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                    : pkg.popular
                                      ? 'border-[#2563EB] shadow-[0_0_0_3px_rgba(37,99,235,0.08)]'
                                      : 'border-slate-200/80 hover:border-slate-300'
                                }`}
                              >
                                {pkg.badge && (
                                  <div className="absolute -top-3 left-5 z-10">
                                    <span
                                      className={`inline-block whitespace-nowrap text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white'
                                          : pkg.popular
                                            ? 'bg-[#2563EB] text-white'
                                            : 'bg-[#0F172A] text-white'
                                      }`}
                                    >
                                      {isSelected ? '✓ Selected in Cart' : pkg.badge}
                                    </span>
                                  </div>
                                )}

                                <div className="mb-4">
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                    {pkg.name}
                                  </div>
                                  <div className="text-2xl sm:text-3xl font-black text-[#0F172A] mb-1.5 tracking-tight">
                                    {price}
                                  </div>
                                  <p className="text-xs text-slate-500 leading-relaxed">
                                    {pkg.description}
                                  </p>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 mb-5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSelectWebsitePackage(
                                        pkg.id,
                                        pkg.name,
                                        fallbackKes,
                                        fallbackUsd,
                                        true
                                      )
                                    }
                                    className={`flex-1 justify-center text-xs py-2.5 px-3 rounded-xl font-bold inline-flex items-center gap-1.5 transition-all ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white'
                                        : pkg.popular
                                          ? 'btn-primary shadow-sm'
                                          : 'btn-secondary'
                                    }`}
                                  >
                                    {isSelected ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" /> Selected
                                      </>
                                    ) : (
                                      <>
                                        Select {pkg.name} <ArrowRight className="w-3.5 h-3.5" />
                                      </>
                                    )}
                                  </button>
                                  <Link
                                    href={pkg.ctaHref}
                                    className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold"
                                  >
                                    {pkg.ctaText}
                                  </Link>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mb-4 pb-4 border-b border-slate-100 text-xs">
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Pages</span>
                                    <span className="font-semibold text-[#0F172A]">{pkg.pages}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Turnaround</span>
                                    <span className="font-semibold text-[#0F172A]">{pkg.timeline}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Revisions</span>
                                    <span className="font-semibold text-[#0F172A]">{pkg.revisions}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Warranty</span>
                                    <span className="font-semibold text-emerald-600">{pkg.support}</span>
                                  </div>
                                </div>

                                <div className="space-y-1.5 flex-1">
                                  {pkg.deliverables.slice(0, 5).map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-2 text-xs text-slate-600 leading-tight"
                                    >
                                      <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                                      <span>{item}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* TAB 2: E-COMMERCE */}
                    {activeTab === 'ecommerce' && (
                      <div className="space-y-6">
                        <div className="text-center max-w-2xl mx-auto">
                          <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2">
                            Online Stores &amp; E-Commerce Platforms
                          </h2>
                          <p className="text-sm text-slate-500">
                            Transactional stores with instant M-Pesa STK Push, card gateways, inventory management, and SEO conversion tuning.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          {ECOMMERCE_PACKAGES.map((pkg) => {
                            const price = market === 'kenya' ? pkg.kenyaPrice : pkg.intlPrice;
                            const canonicalId = normalizeWebsiteCartId(pkg.id);
                            const isSelected = selectedWebsite?.id === canonicalId;
                            const bookItem = priceBook.items[canonicalId];
                            const fallbackKes = bookItem?.amount ?? 90000;
                            const fallbackUsd = bookItem?.amount ?? 890;

                            return (
                              <div
                                key={pkg.id}
                                className={`relative bg-white rounded-2xl border-2 pt-8 pb-6 px-5 flex flex-col transition-all hover:shadow-lg ${
                                  isSelected
                                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                    : pkg.popular
                                      ? 'border-[#2563EB] shadow-[0_0_0_3px_rgba(37,99,235,0.08)]'
                                      : 'border-slate-200/80 hover:border-slate-300'
                                }`}
                              >
                                {pkg.badge && (
                                  <div className="absolute -top-3 left-5 z-10">
                                    <span
                                      className={`inline-block whitespace-nowrap text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white'
                                          : pkg.popular
                                            ? 'bg-[#2563EB] text-white'
                                            : 'bg-[#0F172A] text-white'
                                      }`}
                                    >
                                      {isSelected ? '✓ Selected in Cart' : pkg.badge}
                                    </span>
                                  </div>
                                )}

                                <div className="mb-4">
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                    {pkg.name}
                                  </div>
                                  <div className="text-2xl font-black text-[#0F172A] mb-1.5 tracking-tight">
                                    {price}
                                  </div>
                                  <p className="text-xs text-slate-500 leading-relaxed">
                                    {pkg.description}
                                  </p>
                                </div>

                                <div className="flex flex-col gap-2 mb-5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSelectWebsitePackage(
                                        pkg.id,
                                        pkg.name,
                                        fallbackKes,
                                        fallbackUsd,
                                        true
                                      )
                                    }
                                    className={`w-full justify-center text-xs py-2.5 px-3 rounded-xl font-bold inline-flex items-center gap-1.5 ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white'
                                        : pkg.popular
                                          ? 'btn-primary shadow-sm'
                                          : 'btn-secondary'
                                    }`}
                                  >
                                    {isSelected ? '✓ Selected' : `Select ${pkg.name}`}
                                  </button>
                                  <Link
                                    href={pkg.ctaHref}
                                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                                  >
                                    {pkg.ctaText}
                                  </Link>
                                </div>

                                <div className="space-y-1.5 mb-4 pb-4 border-b border-slate-100 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Scale</span>
                                    <span className="font-semibold text-[#0F172A]">{pkg.products}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Warranty</span>
                                    <span className="font-semibold text-emerald-600">{pkg.support}</span>
                                  </div>
                                </div>

                                <div className="space-y-1.5 flex-1">
                                  {(pkg.features ?? []).slice(0, 5).map((feature, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-2 text-xs text-slate-600 leading-tight"
                                    >
                                      <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                                      <span>{feature}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* TAB 3: CUSTOM DIGITAL SYSTEMS */}
                    {activeTab === 'custom' && (
                      <div className="space-y-6">
                        <div className="text-center max-w-2xl mx-auto">
                          <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2">
                            Custom Digital Systems &amp; Portals
                          </h2>
                          <p className="text-sm text-slate-500">
                            Engineered through formal discovery, database modeling, and milestone delivery.
                          </p>
                        </div>

                        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-[#0F172A] text-white rounded-2xl p-6 border border-blue-800/40">
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="max-w-xl">
                              <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6] mb-1 block">
                                Phase 01 — Mandatory Discovery &amp; Specification
                              </span>
                              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2">
                                Discovery &amp; Technical Blueprint
                              </h3>
                              <p className="text-xs text-slate-300 leading-relaxed">
                                Every custom web system begins with formal discovery: user roles, workflows, database architecture, and a binding milestone roadmap.
                              </p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 text-center shrink-0 w-full md:w-auto">
                              <div className="text-xs text-slate-300 font-medium">Discovery Investment</div>
                              <div className="text-xl font-black text-white my-1">
                                {market === 'kenya' ? 'KSh 25,000 – 75,000' : '$500 – $1,500'}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectWebsitePackage(
                                    'custom-discovery',
                                    'Custom System Discovery & Blueprint',
                                    25000,
                                    500,
                                    true
                                  )
                                }
                                className="btn-primary text-xs px-5 py-2 w-full justify-center mt-2"
                              >
                                Select Discovery Phase
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {CUSTOM_SYSTEM_TIERS.slice(1).map((tier, idx) => {
                            const starting = market === 'kenya' ? tier.kenyaStarting : tier.intlStarting;
                            return (
                              <div
                                key={idx}
                                className="bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-[#2563EB]/40 transition-all flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <h4 className="text-base font-bold text-[#0F172A]">{tier.category}</h4>
                                    <span className="text-xs font-black text-[#2563EB] bg-blue-50 px-2.5 py-1 rounded-full whitespace-nowrap">
                                      {starting}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                                    {tier.description}
                                  </p>
                                  <div className="space-y-1 mb-4">
                                    {tier.examples.map((ex, i) => (
                                      <div
                                        key={i}
                                        className="flex items-center gap-2 text-xs text-slate-600 font-medium"
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                                        <span>{ex}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                  <Link
                                    href={`/contact?service=custom-systems&tier=${encodeURIComponent(tier.category)}`}
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

                    {/* ADD-ONS DRAWER INSIDE STEP 1 */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2563EB] block">
                            Step 1B — Optional Enhancements
                          </span>
                          <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">
                            Standardized Add-On Price Card
                          </h2>
                          <p className="text-xs text-slate-500">
                            Have an existing website or building a new one? Select any extra pages, integrations, or SEO add-ons to include in your live cart.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddonsInStep1((prev) => !prev)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
                          {showAddonsInStep1 || activeTab === 'addons'
                            ? 'Hide Full Add-On Table'
                            : `Browse All Add-Ons (${selectedAddons.length} selected)`}
                        </button>
                      </div>

                      {/* Quick Interactive Add-On Pills */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                        {ADD_ON_RATE_CARD.slice(0, 6).map((addon) => {
                          const addonId = addon.id;
                          const isAdded = cartItems.some((i) => i.id === addonId);
                          const unitPrice = marketCode === 'KE' ? addon.rawKes : addon.rawUsd;
                          const displayPrice =
                            market === 'kenya' ? addon.kenyaPrice : addon.intlPrice;

                          return (
                            <button
                              key={addonId}
                              type="button"
                              onClick={() => {
                                if (isAdded) {
                                  const existing = cartItems.find((i) => i.id === addonId);
                                  if (existing) removeFromCart(existing.key);
                                } else {
                                  addToCart({
                                    kind: 'CATALOG',
                                    id: addonId,
                                    name: addon.name,
                                    cycle: 'one-time',
                                    qty: 1,
                                    unitPrice,
                                    currency: marketDef.currency,
                                  });
                                }
                              }}
                              className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-all ${
                                isAdded
                                  ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950'
                                  : 'border-slate-200 bg-white hover:border-blue-300 text-slate-700'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate">{addon.name}</div>
                                <div className="text-[11px] text-slate-500">{displayPrice}</div>
                              </div>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-1 rounded-lg shrink-0 ${
                                  isAdded
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {isAdded ? '✓ Added' : '+ Add'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {(showAddonsInStep1 || activeTab === 'addons') && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <AddonPriceCard market={market} />
                        </div>
                      )}

                      <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {selectedWebsite
                            ? `Step 1 complete: ${selectedWebsite.name}`
                            : 'Select a website option above to unlock Step 2.'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedStep(2)}
                          className="btn-primary text-xs px-5 py-2.5"
                        >
                          Continue to Step 2: Domain Name <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════════════
                  STEP 2: DOMAIN NAME (EXISTING OR NEW) — MANDATORY
                 ══════════════════════════════════════════════════════════════════ */}
              <div className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-xs overflow-hidden">
                <button
                  type="button"
                  aria-label="Toggle Step 2 Accordion"
                  onClick={() => toggleAccordionStep(2)}
                  aria-expanded={expandedStep === 2}
                  className={`w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left transition-colors ${
                    expandedStep === 2 ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50 text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        selectedDomain
                          ? 'bg-emerald-500 text-white'
                          : expandedStep === 2
                            ? 'bg-[#14B8A6] text-slate-950'
                            : 'bg-blue-50 text-[#2563EB]'
                      }`}
                    >
                      {selectedDomain ? <Check className="w-5 h-5" /> : '2'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base sm:text-lg font-extrabold">
                          Step 2: Domain Name (Already Bought or New Registration)
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            selectedDomain
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-400/30'
                          }`}
                        >
                          {selectedDomain ? `✓ ${selectedDomain.name}` : 'Mandatory Step 2'}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 ${
                          expandedStep === 2 ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Connect a domain you already own for free DNS/SSL configuration, or register a brand-new domain name.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold hidden sm:inline">
                      {expandedStep === 2 ? 'Collapse' : 'Expand'}
                    </span>
                    {expandedStep === 2 ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </button>

                {expandedStep === 2 && (
                  <div className="p-5 sm:p-7 space-y-6 border-t border-slate-200">
                    {!selectedWebsite && (
                      <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            <strong>Step 1 Required First:</strong> Please select either an Existing Website or a New Website Package in Step 1 before finalizing your stack.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedStep(1)}
                          className="font-extrabold underline shrink-0"
                        >
                          Go to Step 1
                        </button>
                      </div>
                    )}

                    <div className="max-w-xl">
                      <label
                        htmlFor="pricing-domain-input"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                      >
                        Enter Your Domain Name (Optional — existing or desired):
                      </label>
                      <input
                        id="pricing-domain-input"
                        type="text"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        placeholder="e.g. mycompany.co.ke or mybusiness.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {DOMAIN_PACKAGES.map((dom) => {
                        const isSelected = selectedDomain?.id === dom.id;
                        const price = market === 'kenya' ? dom.kenyaPrice : dom.intlPrice;
                        const fallbackKes =
                          dom.id === 'domain-existing'
                            ? 0
                            : dom.id === 'domain-co-ke'
                              ? 1500
                              : dom.id === 'domain-com'
                                ? 2500
                                : 3500;
                        const fallbackUsd =
                          dom.id === 'domain-existing'
                            ? 0
                            : dom.id === 'domain-co-ke'
                              ? 15
                              : dom.id === 'domain-com'
                                ? 20
                                : 28;

                        return (
                          <div
                            key={dom.id}
                            className={`rounded-2xl border-2 p-5 flex flex-col justify-between transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/40 shadow-sm'
                                : dom.popular
                                  ? 'border-[#2563EB] bg-white shadow-xs'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-[#2563EB]">
                                  {dom.isExisting ? 'Existing Domain' : 'New Registration'}
                                </span>
                                {dom.badge && (
                                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB]">
                                    {dom.badge}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-base font-bold text-[#0F172A] mb-1">{dom.name}</h3>
                              <div className="text-2xl font-black text-[#0F172A] mb-2">{price}</div>
                              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                                {dom.description}
                              </p>
                              <div className="space-y-1.5 mb-5">
                                {dom.features.map((f, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                    <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                                    <span>{f}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleSelectDomainPackage(dom.id, dom.name, fallbackKes, fallbackUsd)
                              }
                              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : dom.popular
                                    ? 'btn-primary'
                                    : 'btn-secondary'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Selected Domain Option
                                </>
                              ) : (
                                <>
                                  {dom.isExisting ? 'Use My Existing Domain' : `Select ${dom.name}`}{' '}
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════════════
                  STEP 3: MANAGED CLOUD & WEBSITE HOSTING — MANDATORY
                 ══════════════════════════════════════════════════════════════════ */}
              <div className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-xs overflow-hidden">
                <button
                  type="button"
                  aria-label="Toggle Step 3 Accordion"
                  onClick={() => toggleAccordionStep(3)}
                  aria-expanded={expandedStep === 3}
                  className={`w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left transition-colors ${
                    expandedStep === 3 ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50 text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        selectedHosting
                          ? 'bg-emerald-500 text-white'
                          : expandedStep === 3
                            ? 'bg-[#14B8A6] text-slate-950'
                            : 'bg-blue-50 text-[#2563EB]'
                      }`}
                    >
                      {selectedHosting ? <Check className="w-5 h-5" /> : '3'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base sm:text-lg font-extrabold">
                          Step 3: Managed Cloud &amp; Website Hosting
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            selectedHosting
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-400/30'
                          }`}
                        >
                          {selectedHosting ? `✓ ${selectedHosting.name}` : 'Mandatory Step 3'}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 ${
                          expandedStep === 3 ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Choose your managed hosting tier for online visibility, SSL security, automated backups, and 99.9% uptime.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold hidden sm:inline">
                      {expandedStep === 3 ? 'Collapse' : 'Expand'}
                    </span>
                    {expandedStep === 3 ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </button>

                {(expandedStep === 3 || activeTab === 'hosting') && (
                  <div className="p-5 sm:p-7 space-y-6 border-t border-slate-200">
                    <div className="text-center max-w-3xl mx-auto">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB] mb-1 block">
                        Infrastructure &amp; Operations
                      </span>
                      <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2">
                        Managed Cloud &amp; Website Hosting
                      </h2>
                      <p className="text-xs md:text-sm text-slate-500 mb-5">
                        BazionWeb delivers managed hosting: infrastructure, configuration, SSL certificates, automated daily backups, and ongoing monitoring.
                      </p>

                      {/* Interactive Commitment Cycle Selector */}
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Select Commitment Term &amp; Unlock Progressive Discounts
                        </div>
                        <div className="inline-flex flex-wrap items-center justify-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 gap-1 shadow-inner">
                          {BILLING_CYCLES_META.map((meta) => {
                            const isSelected = hostingCycle === meta.cycle;
                            return (
                              <button
                                key={meta.cycle}
                                type="button"
                                onClick={() => setHostingCycle(meta.cycle)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-[#2563EB] text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                                }`}
                              >
                                <span>{meta.pillLabel}</span>
                                {meta.popular && !isSelected && (
                                  <span className="text-[9px] bg-blue-100 text-[#2563EB] px-1.5 py-0.5 rounded-full font-extrabold">
                                    Popular
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {MANAGED_HOSTING_PLANS.map((host) => {
                        const bookItem = priceBook.items[host.id];
                        const opt = bookItem?.billingOptions?.find((o) => o.cycle === hostingCycle);
                        const displayMonthly = opt
                          ? opt.formattedMonthly
                          : market === 'kenya'
                            ? host.kenyaPrice
                            : host.intlPrice;
                        const displayTotal = opt ? opt.formatted : undefined;
                        const discountPct = opt?.discountPct ?? 0;
                        const isSelected = selectedHosting?.id === host.id;

                        return (
                          <div
                            key={host.id}
                            className={`bg-white rounded-2xl border-2 p-5 flex flex-col ${
                              isSelected
                                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                : host.popular
                                  ? 'border-[#2563EB] shadow-md'
                                  : 'border-slate-200/80'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              {host.badge && (
                                <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#2563EB]">
                                  {host.badge}
                                </span>
                              )}
                              {discountPct > 0 && (
                                <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 ml-auto">
                                  Save {discountPct}%
                                </span>
                              )}
                            </div>

                            <h3 className="font-bold text-[#0F172A] text-base mb-1">{host.name}</h3>
                            <div className="text-2xl font-black text-[#0F172A]">{displayMonthly}</div>
                            {displayTotal && (
                              <div className="text-[11px] text-slate-500 font-semibold mb-1">
                                Total: {displayTotal} ({opt?.label || 'Annual'} commitment)
                              </div>
                            )}
                            <div className="text-xs font-semibold text-[#14B8A6] mb-2 mt-1">
                              {host.resources}
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mb-4">
                              {host.description}
                            </p>

                            <div className="mb-4">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectHostingPlan(
                                    host.id,
                                    host.name,
                                    bookItem?.amount ?? 15000,
                                    bookItem?.amount ?? 120
                                  )
                                }
                                className={`w-full justify-center text-xs py-2.5 px-4 rounded-xl font-bold inline-flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : host.popular
                                      ? 'btn-primary'
                                      : 'btn-secondary'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" /> Selected Hosting
                                  </>
                                ) : (
                                  <>
                                    {host.ctaText} <ArrowRight className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="space-y-1.5 border-t border-slate-100 pt-3 flex-1">
                              {(host.features ?? []).map((feat, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                  <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                                  <span>{feat}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════════════
                  STEP 4: WEBSITE CARE & ONGOING MAINTENANCE — OPTIONAL
                 ══════════════════════════════════════════════════════════════════ */}
              <div className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-xs overflow-hidden">
                <button
                  type="button"
                  aria-label="Toggle Step 4 Accordion"
                  onClick={() => toggleAccordionStep(4)}
                  aria-expanded={expandedStep === 4}
                  className={`w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left transition-colors ${
                    expandedStep === 4 ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50 text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        selectedCare
                          ? 'bg-emerald-500 text-white'
                          : expandedStep === 4
                            ? 'bg-[#14B8A6] text-slate-950'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {selectedCare ? <Check className="w-5 h-5" /> : '4'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base sm:text-lg font-extrabold">
                          Step 4: Website Care &amp; Maintenance Plan
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            selectedCare
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                              : 'bg-slate-500/20 text-slate-300 border border-slate-400/30'
                          }`}
                        >
                          {selectedCare ? `✓ ${selectedCare.name}` : 'Optional Step 4'}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 ${
                          expandedStep === 4 ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Optional ongoing maintenance, WAF security, backups, and dedicated monthly engineering support hours.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold hidden sm:inline">
                      {expandedStep === 4 ? 'Collapse' : 'Expand'}
                    </span>
                    {expandedStep === 4 ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </button>

                {(expandedStep === 4 || activeTab === 'care') && (
                  <div className="p-5 sm:p-7 space-y-6 border-t border-slate-200">
                    <div className="text-center max-w-3xl mx-auto">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB] mb-1 block">
                        Recurring Peace of Mind (Optional)
                      </span>
                      <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2">
                        Website Care &amp; Ongoing Maintenance
                      </h2>
                      <p className="text-xs md:text-sm text-slate-500 mb-5">
                        Websites are living software. Our optional care plans guarantee updates, daily backups, WAF defense, SEO health checks, and included engineering support hours.
                      </p>

                      {/* Interactive Commitment Cycle Selector */}
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Select Commitment Term &amp; Unlock Progressive Discounts
                        </div>
                        <div className="inline-flex flex-wrap items-center justify-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 gap-1 shadow-inner">
                          {BILLING_CYCLES_META.map((meta) => {
                            const isSelected = careCycle === meta.cycle;
                            return (
                              <button
                                key={meta.cycle}
                                type="button"
                                onClick={() => setCareCycle(meta.cycle)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-[#2563EB] text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                                }`}
                              >
                                <span>{meta.pillLabel}</span>
                                {meta.popular && !isSelected && (
                                  <span className="text-[9px] bg-blue-100 text-[#2563EB] px-1.5 py-0.5 rounded-full font-extrabold">
                                    Popular
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {CARE_PLANS.map((care) => {
                        const bookItem = priceBook.items[care.id];
                        const opt = bookItem?.billingOptions?.find((o) => o.cycle === careCycle);
                        const displayMonthly = opt
                          ? opt.formattedMonthly
                          : market === 'kenya'
                            ? care.kenyaPrice
                            : care.intlPrice;
                        const displayTotal = opt ? opt.formatted : undefined;
                        const discountPct = opt?.discountPct ?? 0;
                        const isSelected = selectedCare?.id === care.id;

                        return (
                          <div
                            key={care.id}
                            className={`bg-white rounded-2xl border-2 p-5 flex flex-col ${
                              isSelected
                                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                : care.popular
                                  ? 'border-[#2563EB] shadow-md'
                                  : 'border-slate-200/80'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              {care.badge && (
                                <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#2563EB]">
                                  {care.badge}
                                </span>
                              )}
                              {discountPct > 0 && (
                                <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 ml-auto">
                                  Save {discountPct}%
                                </span>
                              )}
                            </div>

                            <h3 className="font-bold text-[#0F172A] text-base mb-1">{care.name}</h3>
                            <div className="text-2xl font-black text-[#0F172A]">{displayMonthly}</div>
                            {displayTotal && opt?.periodMonths && opt.periodMonths > 1 && (
                              <div className="text-[11px] text-slate-500 font-semibold mb-1">
                                Total: {displayTotal} ({opt.label} commitment)
                              </div>
                            )}
                            <div className="text-xs font-bold text-[#14B8A6] mb-2 mt-1">{care.hours}</div>
                            <p className="text-xs text-slate-500 leading-relaxed mb-4">
                              {care.description}
                            </p>

                            <div className="mb-4">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectCarePlan(
                                    care.id,
                                    care.name,
                                    bookItem?.amount ?? 5000,
                                    bookItem?.amount ?? 75
                                  )
                                }
                                className={`w-full justify-center text-xs py-2.5 px-4 rounded-xl font-bold inline-flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : care.popular
                                      ? 'btn-primary'
                                      : 'btn-secondary'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" /> Added to Stack
                                  </>
                                ) : (
                                  <>Subscribe to Care</>
                                )}
                              </button>
                            </div>

                            <div className="space-y-1.5 border-t border-slate-100 pt-3 flex-1">
                              {(care.features ?? []).map((feat, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                  <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                                  <span>{feat}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedCare && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeFromCart(selectedCare.key)}
                          className="text-xs font-semibold text-slate-500 hover:text-rose-600 underline"
                        >
                          Remove optional Care Plan (use included post-launch warranty only)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Frozen Live Cart Summary */}
            <aside className="lg:col-span-4">
              <div className="sticky top-28">
                <StoreOrderSummary
                  items={cartItems}
                  websiteSatisfied={Boolean(selectedWebsite)}
                  domainSatisfied={Boolean(selectedDomain)}
                  hostingSatisfied={Boolean(selectedHosting)}
                  careSatisfied={Boolean(selectedCare)}
                  activeCurrency={marketCode === 'KE' ? 'KES' : 'USD'}
                  onQty={setCartQty}
                  onRemove={removeFromCart}
                  onCheckout={() => {
                    const planParam = selectedCare?.id || 'none';
                    const cycleParam = selectedCare?.cycle || 'MONTHLY';
                    router.push(`/checkout?plan=${encodeURIComponent(planParam)}&cycle=${encodeURIComponent(cycleParam)}&cart=1`);
                  }}
                  onSelectStep={(sectionId) => {
                    if (sectionId === 'websites') toggleAccordionStep(1);
                    else if (sectionId === 'domains') toggleAccordionStep(2);
                    else if (sectionId === 'hosting') toggleAccordionStep(3);
                    else if (sectionId === 'plans') toggleAccordionStep(4);
                  }}
                />
              </div>
            </aside>
          </div>
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
                q: 'Do I own my website and domain completely?',
                a: 'Yes, 100%. Clients retain absolute ownership of their domain, source code, business data, content, and credentials. BazionWeb will never hold your digital assets hostage if you decide to self-host or transfer.',
              },
              {
                q: 'What if I already have a website built and only need add-ons, domain, or hosting?',
                a: 'Select "Existing Website / Web App (Bring Your Own)" in Step 1 at zero base build cost. From there, you can attach any add-on upgrades, connect or register your domain in Step 2, choose your Managed Hosting package in Step 3, and optionally add a Care Plan in Step 4.',
              },
              {
                q: 'What are the standard payment terms?',
                a: `For standard projects under ${marketCode === 'KE' ? 'KSh 100,000' : '$5,000'}, we require a 50% deposit before commencement and 50% upon final acceptance before production launch. For larger enterprise systems, payments follow transparent milestones: 40% deposit → 30% design sign-off → 20% staging test approval → 10% launch.`,
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
            Use our interactive quote calculator to configure your exact page count, add-ons, domain, hosting, and care plan, or book a free discovery consultation with our engineers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/quote" className="btn-primary px-8 py-3.5 text-sm">
              Open Interactive Quote Calculator
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
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
