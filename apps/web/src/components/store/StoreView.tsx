'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  Check,
  Plus,
  Globe,
  ArrowRight,
  Loader2,
  ChevronDown,
  Layout,
  Server,
  Wrench,
  Puzzle,
  Sparkles,
} from 'lucide-react';
import { WhatsAppLink } from '@/components/ui/WhatsAppChat';
import { resolveApiV1Base } from '@/lib/api-base';
import { usePlans, PLAN_MARKETING } from '@/lib/plans';
import {
  useCartStore,
  type CartItem,
  isWebsiteItem,
  isDomainItem,
  isHostingItem,
  isCarePlanItem,
  isAddOnItem,
} from '@/lib/cart';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import {
  BILLING_CYCLES_META,
  calculatePlanCyclePrice,
  getPriceBookForMarket,
} from '@/lib/priceBooks';
import {
  EXISTING_WEBSITE_PACKAGE,
  WEBSITE_PACKAGES,
  ECOMMERCE_PACKAGES,
  DOMAIN_PACKAGES,
  ADD_ON_RATE_CARD,
  COMMERCIAL_FLOW_STEPS,
} from '@/lib/pricingData';
import ClientJourneyProgress from '@/components/navigation/ClientJourneyProgress';
import StoreCategoryNav, { type StoreCategoryItem } from './StoreCategoryNav';
import StoreOrderSummary from './StoreOrderSummary';

const PLAN_HEADER_STYLES: Record<string, string> = {
  starter: 'bg-slate-800 text-white',
  growth: 'bg-blue-600 text-white',
  business: 'bg-indigo-700 text-white',
  enterprise: 'bg-amber-700 text-white',
  'care-essential': 'bg-teal-700 text-white',
  'care-business': 'bg-blue-700 text-white',
  'care-professional': 'bg-purple-700 text-white',
  'care-enterprise': 'bg-amber-700 text-white',
};

/** Bundle tiers already carry managed hosting — no separate host-* line required. */
const BUNDLE_PLAN_SLUGS = new Set(['starter', 'growth', 'business', 'enterprise']);

interface CatalogPrice {
  id: string;
  productId: string;
  amount: number;
  billingPeriod: string | null;
}

interface CatalogResponse {
  market: { code: string; currencyCode: string; currencySymbol: string; vatRate: number };
  prices: CatalogPrice[];
}

/** Presentation-only copy per price-book product ID (prices always come from the API/priceBook). */
const PRODUCT_MARKETING: Record<string, { name: string; description: string; features: string[] }> = {
  'host-essential': {
    name: 'Host Essential',
    description:
      'Isolated container hosting (0.5 vCPU / 384 MB RAM) with 10 GB NVMe, SSL, Cloudflare CDN, and weekly R2 backups.',
    features: [
      '0.5 vCPU / 384 MB RAM Container',
      '10 GB NVMe SSD & 100 GB/mo Bandwidth',
      'Free Automated SSL & Cloudflare CDN',
      'Email Forwarding (@yourcompany.com)',
      'Weekly R2 Off-Site Backups',
    ],
  },
  'host-business': {
    name: 'Host Business',
    description:
      '3x compute power (1.5 vCPU / 768 MB RAM) with 25 GB NVMe, 5 corporate email inboxes, and daily R2 backups.',
    features: [
      '1.5 vCPU / 768 MB RAM Allocation',
      '25 GB NVMe SSD & 500 GB/mo Bandwidth',
      'Up to 5 Corporate Email Inboxes',
      'Shared DB + Redis Object Cache',
      'Daily R2 Backups (14-Day) & Staging',
    ],
  },
  'host-pro': {
    name: 'Host Professional',
    description:
      'High-concurrency container hosting (2.0 vCPU / 1.5 GB RAM) with 50 GB NVMe, isolated Redis 7 cache, and 10 emails.',
    features: [
      '2.0 vCPU / 1.5 GB RAM Allocation',
      '50 GB NVMe SSD & 1 TB/mo Bandwidth',
      'Up to 10 Corporate Email Inboxes',
      'Isolated Redis 7 Cache & 30-Day Backups',
      'Automated Staging & Priority Support',
    ],
  },
  'host-professional': {
    name: 'Host Professional',
    description:
      'High-concurrency container hosting (2.0 vCPU / 1.5 GB RAM) with 50 GB NVMe, isolated Redis 7 cache, and 10 emails.',
    features: [
      '2.0 vCPU / 1.5 GB RAM Allocation',
      '50 GB NVMe SSD & 1 TB/mo Bandwidth',
      'Up to 10 Corporate Email Inboxes',
      'Isolated Redis 7 Cache & 30-Day Backups',
      'Automated Staging & Priority Support',
    ],
  },
  'host-cloud': {
    name: 'Managed Cloud',
    description:
      'Dedicated multi-container cloud cluster (4.0 vCPU / 2 GB+ RAM) with 100 GB NVMe, standalone PostgreSQL 16 & Redis 7.',
    features: [
      '4.0 vCPU / 2 GB+ RAM Dedicated Cluster',
      '100 GB NVMe SSD & 2 TB/mo Bandwidth',
      'Dedicated PostgreSQL 16 & Redis 7',
      'Multi-Cycle Flexible Billing',
      'Zero-Downtime CI/CD & DevOps SLA',
    ],
  },
  'host-cloud-monthly': {
    name: 'Managed Cloud (Monthly)',
    description:
      'Dedicated multi-container cloud cluster (4.0 vCPU / 2 GB+ RAM) with 100 GB NVMe, PostgreSQL 16 & Redis 7. Monthly rolling term.',
    features: [
      '4.0 vCPU / 2 GB+ RAM Dedicated Cluster',
      '100 GB NVMe SSD & 2 TB/mo Bandwidth',
      'Dedicated PostgreSQL 16 & Redis 7',
      'Monthly Flexible Term',
      'DevOps SLA & Daily R2 Backups',
    ],
  },
  'host-cloud-quarterly': {
    name: 'Managed Cloud (3 Months / Quarterly)',
    description: 'Dedicated multi-container cloud cluster billed quarterly with 5% commitment discount.',
    features: [
      '4.0 vCPU / 2 GB+ RAM Dedicated Cluster',
      '100 GB NVMe SSD & 2 TB/mo Bandwidth',
      'Save 5% vs Monthly',
      'Quarterly Commitment',
      'DevOps SLA & Daily R2 Backups',
    ],
  },
  'host-cloud-semiannual': {
    name: 'Managed Cloud (6 Months / Semi-Annual)',
    description: 'Dedicated multi-container cloud cluster billed semi-annually with 10% commitment discount.',
    features: [
      '4.0 vCPU / 2 GB+ RAM Dedicated Cluster',
      '100 GB NVMe SSD & 2 TB/mo Bandwidth',
      'Save 10% vs Monthly',
      'Semi-Annual Commitment',
      'DevOps SLA & Daily R2 Backups',
    ],
  },
  'host-cloud-annual': {
    name: 'Managed Cloud (Annual / 12 Months)',
    description: 'Dedicated multi-container cloud cluster billed annually with 22% commitment discount (~2.6 months free).',
    features: [
      '4.0 vCPU / 2 GB+ RAM Dedicated Cluster',
      '100 GB NVMe SSD & 2 TB/mo Bandwidth',
      'Save 22% (Best Value)',
      'Annual Commitment',
      'DevOps SLA & Daily R2 Backups',
    ],
  },
  'addon-blog-news': {
    name: 'Blog / News Engine',
    description: 'Full article CMS, categories, author bios, social sharing, and instant search.',
    features: [],
  },
  'addon-advanced-form': {
    name: 'Advanced Form / Survey',
    description: 'Multi-step conditional logic, secure file uploads, and email/CRM webhook dispatch.',
    features: [],
  },
  'addon-booking': {
    name: 'Online Booking System',
    description: 'Calendar appointment scheduling, automated client reminders, and calendar sync.',
    features: [],
  },
  'addon-payment-gateway': {
    name: 'Card Payment Gateway',
    description: 'Paystack, Stripe, or PesaPal 3D-Secure Visa/Mastercard checkout integration.',
    features: [],
  },
  'addon-mpesa': {
    name: 'M-Pesa STK Push Integration',
    description: 'Direct Safaricom Daraja STK Push prompt with instant webhook reconciliation.',
    features: [],
  },
  'addon-newsletter': {
    name: 'Newsletter Integration',
    description: 'Mailchimp or Brevo opt-in forms, footer capture, and automated welcome emails.',
    features: [],
  },
  'addon-seo-advanced': {
    name: 'Advanced SEO Foundation',
    description: 'Structured Schema.org markup, keyword research, meta tuning, and canonical audit.',
    features: [],
  },
  'addon-copywriting': {
    name: 'Professional Copywriting',
    description: 'Conversion-engineered commercial copy for core landing pages and service decks.',
    features: [],
  },
  'addon-migration': {
    name: 'Website Migration',
    description: 'Zero-downtime transfer of files, database, SSL, and DNS from your previous host.',
    features: [],
  },
  'addon-extra-revision': {
    name: 'Additional Revision Round',
    description: 'One structured design & content revision round beyond the package allocation.',
    features: [],
  },
  'addon-custom-api': {
    name: 'Custom API Integration',
    description: 'Connect third-party ERP, CRM, accounting, or external REST/webhook pipelines.',
    features: [],
  },
  'addon-multilingual': {
    name: 'Multilingual Support (i18n)',
    description: 'Locale routing (/en, /sw, /fr) with language switcher and localized SEO tags.',
    features: [],
  },
  'addon-document-hub': {
    name: 'Document Download Hub',
    description: 'Filterable PDF library for policies, tenders, reports, and corporate brochures.',
    features: [],
  },
};

const fallbackMarketing = (productId: string) => ({
  name: productId
    .split('-')
    .slice(1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '),
  description: 'Configured for your active regional market in the official price book.',
  features: [] as string[],
});

const formatMoney = (amount: number, symbol: string) =>
  `${symbol}${(Number(amount) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

type WebsiteSubCategory = 'existing' | 'websites' | 'ecommerce';

export default function StoreView() {
  const apiBase = resolveApiV1Base();
  const { marketCode, marketDef } = useMarketPreference();
  const isKenya = marketCode === 'KE';
  const priceBook = useMemo(() => getPriceBookForMarket(marketCode), [marketCode]);
  const { plans, loading: plansLoading } = usePlans();

  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [activeNavStep, setActiveNavStep] = useState<string>('websites');
  const [websiteSubTab, setWebsiteSubTab] = useState<WebsiteSubCategory>('existing');
  const [domainNameInput, setDomainNameInput] = useState<string>('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    websites: true,
    addons: false,
    domains: true,
    hosting: true,
    plans: true,
  });

  const toggleSection = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const openOnlyStep = (stepId: 'websites' | 'domains' | 'hosting' | 'plans') => {
    setActiveNavStep(stepId);
    setOpenSections((prev) => ({
      ...prev,
      websites: stepId === 'websites',
      domains: stepId === 'domains',
      hosting: stepId === 'hosting',
      plans: stepId === 'plans',
    }));
    document.getElementById(stepId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const catalog = useQuery<CatalogResponse>({
    queryKey: ['store-catalog', marketCode],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/pricing/catalog?market=${marketCode}`, { cache: 'no-store' });
      const envelope = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(envelope?.message || 'Could not load the store catalog.');
      return envelope?.data ?? envelope;
    },
    staleTime: 5 * 60 * 1000,
  });

  const add = useCartStore((s) => s.add);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.remove);
  const items = useCartStore((s) => s.items);
  const inCart = (key: string) => items.some((i) => i.key === key);

  // Mandatory 4-Step Commercial Stack State
  const selectedWebsiteItem = items.find(isWebsiteItem);
  const selectedDomainItem = items.find(isDomainItem);
  const selectedHostingItem = items.find(isHostingItem);
  const cartPlanItem = items.find(isCarePlanItem);
  const selectedAddOnsCount = items.filter(isAddOnItem).reduce((sum, i) => sum + i.qty, 0);

  const websiteSatisfied = Boolean(selectedWebsiteItem);
  const domainSatisfied = Boolean(selectedDomainItem);
  const careSatisfied = Boolean(cartPlanItem);
  const bundlePlanIncludesHosting = Boolean(cartPlanItem && BUNDLE_PLAN_SLUGS.has(cartPlanItem.id));
  const hostingInCart = Boolean(selectedHostingItem);
  const hostingSatisfied = bundlePlanIncludesHosting || hostingInCart;

  const defaultCurrency = marketDef?.currency ?? (isKenya ? 'KES' : 'USD');
  const defaultSymbol = marketDef?.currencySymbol ?? (isKenya ? 'KES ' : '$');
  const symbol = catalog.data?.market.currencySymbol ?? defaultSymbol;
  const activeCurrency = (catalog.data?.market.currencyCode ?? defaultCurrency) as 'KES' | 'USD';

  const isDataReady = !plansLoading && !catalog.isLoading;

  const scrollToSectionId = (id: string) => {
    setActiveNavStep(id);
    setOpenSections((prev) => ({ ...prev, [id]: true }));
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAdd = (item: Parameters<typeof add>[0], key: string) => {
    add(item);
    setAddedKey(key);
    setTimeout(() => setAddedKey(null), 1500);
  };

  // Deep-link support: /store?add=<plan-slug|productId>
  const searchParams = useSearchParams();
  const router = useRouter();
  const addParam = searchParams.get('add');
  const cycleParam = searchParams.get('cycle');
  useEffect(() => {
    if (!addParam || plansLoading || catalog.isLoading) return;
    const plan = (plans ?? []).find((p) => p.slug === addParam);
    if (plan && PLAN_MARKETING[plan.slug]) {
      const norm = String(cycleParam || 'MONTHLY').toUpperCase().replace('-', '_');
      const validCycle = BILLING_CYCLES_META.find(
        (m) => m.enumValue === norm || m.cycle === cycleParam?.toLowerCase()
      );
      const planCycle = validCycle ? validCycle.enumValue : 'MONTHLY';
      const baseMonthly = isKenya ? plan.priceMonthlyKes : plan.priceMonthly;
      const baseAnnual = isKenya ? plan.priceAnnualKes : plan.priceAnnual;
      const cyclePrice = calculatePlanCyclePrice(baseMonthly, planCycle, {
        canonicalAnnualAmount: baseAnnual,
        isKes: isKenya,
      }).amount;
      const planCurrency = isKenya ? 'KES' : activeCurrency;
      add({
        kind: 'PLAN',
        id: plan.slug,
        name: plan.name,
        cycle: planCycle,
        qty: 1,
        unitPrice: cyclePrice,
        currency: planCurrency,
      });
      setAddedKey(`PLAN:${plan.slug}:${planCycle}`);
      scrollToSectionId('plans');
    } else {
      const price = (catalog.data?.prices ?? []).find((p) => p.productId === addParam);
      if (price) {
        const marketing = PRODUCT_MARKETING[price.productId] ?? fallbackMarketing(price.productId);
        add({
          kind: 'CATALOG',
          id: price.productId,
          name: marketing.name,
          cycle: price.billingPeriod ?? 'one-time',
          qty: 1,
          unitPrice: price.amount,
          currency: activeCurrency,
        });
        setAddedKey(`CATALOG:${price.productId}:${price.billingPeriod ?? 'one-time'}`);
        scrollToSectionId(price.productId.startsWith('host-') ? 'hosting' : 'addons');
      }
    }
    router.replace('/store', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addParam, plans, plansLoading, catalog.data, catalog.isLoading, add, router, isKenya, activeCurrency]);

  const hostingItems = useMemo(
    () => (catalog.data?.prices ?? []).filter((p) => p.productId.startsWith('host-')),
    [catalog.data],
  );

  const addonItems = useMemo(() => {
    const apiAddons = (catalog.data?.prices ?? []).filter((p) => p.productId.startsWith('addon-'));
    if (apiAddons.length > 0) return apiAddons;
    return ADD_ON_RATE_CARD.filter((a) => a.rawKes > 0).map((a) => ({
      id: a.id,
      productId: a.id.startsWith('addon-') ? a.id : `addon-${a.id}`,
      amount: isKenya ? a.rawKes : a.rawUsd,
      billingPeriod: 'one-time',
    }));
  }, [catalog.data, isKenya]);

  const navCategories: StoreCategoryItem[] = useMemo(
    () => [
      {
        id: 'websites',
        label: '1. Website & Add-Ons',
        icon: Layout,
        badge: websiteSatisfied ? 'Done' : 'Required',
        href: '#websites',
      },
      {
        id: 'domains',
        label: '2. Domain Name',
        icon: Globe,
        badge: domainSatisfied ? 'Done' : 'Required',
        href: '#domains',
      },
      {
        id: 'hosting',
        label: '3. Managed Hosting',
        icon: Server,
        count: hostingItems.length || undefined,
        badge: hostingSatisfied ? 'Done' : 'Required',
        href: '#hosting',
      },
      {
        id: 'plans',
        label: '4. Care Plans',
        icon: Wrench,
        badge: careSatisfied ? 'Done' : 'Optional',
        href: '#plans',
      },
    ],
    [websiteSatisfied, domainSatisfied, hostingSatisfied, careSatisfied, hostingItems.length]
  );

  const websiteBuildOptions = useMemo(() => {
    const mapWebsitePkg = (pkgId: string) => {
      const bookKey =
        pkgId === 'launch'
          ? 'website-launch'
          : pkgId === 'business'
            ? 'website-business'
            : pkgId === 'professional'
              ? 'website-professional'
              : 'website-enterprise';
      const bookItem = priceBook.items[bookKey];
      return {
        productId: bookKey,
        amount: bookItem ? bookItem.amount : isKenya ? 90000 : 950,
      };
    };

    const mapEcomPkg = (pkgId: string) => {
      const bookKey =
        pkgId === 'ecom-starter'
          ? 'ecommerce-starter'
          : pkgId === 'ecom-business'
            ? 'ecommerce-business'
            : 'ecommerce-enterprise';
      const bookItem = priceBook.items[bookKey];
      return {
        productId: bookKey,
        amount: bookItem ? bookItem.amount : isKenya ? 90000 : 890,
      };
    };

    return { mapWebsitePkg, mapEcomPkg };
  }, [priceBook, isKenya]);

  return (
    <main className="bg-[#F8FAFC] min-h-screen">
      {/* 1. Hero Banner */}
      <section className="bg-[#0F172A] pt-28 pb-10 md:pb-12 text-white border-b border-slate-800">
        <div className="container-default max-w-7xl mx-auto px-4">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-3">
            <ShoppingCart className="h-4 w-4" /> BazionWeb Single-Page Stack Configurator
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
            Build Your Complete Digital Stack in 4 Guided Steps
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
            Follow our unified commercial sequence on one page: <strong>1. Website / App &amp; Add-Ons</strong> (bring your existing site or build a new one) &rarr;{' '}
            <strong>2. Domain Name</strong> (existing or new) &rarr; <strong>3. Managed Hosting</strong> &rarr;{' '}
            <strong>4. Care Plan (Optional)</strong>, with your live total pinned in the frozen cart.
          </p>
        </div>
      </section>

      {/* 2. High-Contrast Client Journey Steps Positioned BELOW the Hero Banner */}
      <section
        aria-label="Client journey steps bar"
        className="bg-slate-900/95 border-b border-slate-800 py-5 px-4 shadow-md"
      >
        <div className="container-default max-w-7xl mx-auto">
          <ClientJourneyProgress currentStep={1} variant="dark" />
        </div>
      </section>

      {/* 3. Sticky Step Navigation Bar (Distinct Dark Slate-Indigo Background #1E293B) */}
      <StoreCategoryNav
        categories={navCategories}
        activeId={activeNavStep}
        onSelectCategory={(id) => scrollToSectionId(id)}
        cartCount={items.reduce((n, i) => n + i.qty, 0)}
      />

      {/* 4. Two-Column Single-Page Builder: Collapsible Accordion Steps (Left) + Frozen Cart (Right) */}
      <div className="container-default max-w-7xl mx-auto px-4 py-8 pb-28">
        {/* Quick Accordion View Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Sparkles className="h-4 w-4 text-[#2563EB]" />
            <span>
              Guided Collapsible Menu — Click any step header to expand or collapse and avoid long scrolling.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setOpenSections({ websites: true, addons: true, domains: true, hosting: true, plans: true })
              }
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() =>
                setOpenSections({
                  websites: !websiteSatisfied,
                  addons: false,
                  domains: websiteSatisfied && !domainSatisfied,
                  hosting: websiteSatisfied && domainSatisfied && !hostingSatisfied,
                  plans: websiteSatisfied && domainSatisfied && hostingSatisfied,
                })
              }
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              Focus Current Step
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          {/* Frozen Shopping Cart Summary Rail */}
          <aside
            data-testid="store-summary-rail"
            className="order-first md:order-2 md:w-[330px] lg:w-[370px] shrink-0"
          >
            <div
              data-testid="store-summary-sticky"
              className="md:sticky md:top-24 z-30 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto"
            >
              <StoreOrderSummary
                items={items as CartItem[]}
                websiteSatisfied={websiteSatisfied}
                domainSatisfied={domainSatisfied}
                careSatisfied={careSatisfied}
                hostingSatisfied={hostingSatisfied}
                bundlePlanIncludesHosting={bundlePlanIncludesHosting}
                activeCurrency={activeCurrency}
                onQty={setQty}
                onRemove={removeItem}
                onCheckout={() => router.push('/checkout?cart=1')}
                onSelectStep={(stepId) => scrollToSectionId(stepId)}
              />
              {!isDataReady && (
                <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Syncing live prices…
                </p>
              )}
            </div>
          </aside>

          {/* Left Column: 4-Step Collapsible Accordion Menu */}
          <div className="order-last md:order-1 flex-1 min-w-0 max-w-4xl space-y-5">
            {/* ══════════════════════════════════════════════════════════════════
                STEP 1: WEBSITE / APP FOUNDATION & ADD-ONS (MANDATORY)
               ══════════════════════════════════════════════════════════════════ */}
            <section
              id="websites"
              aria-labelledby="websites-heading"
              className={`scroll-mt-44 rounded-3xl border-2 bg-white shadow-sm overflow-hidden transition-colors ${
                websiteSatisfied ? 'border-emerald-300' : 'border-[#2563EB]/40'
              }`}
            >
              <button
                type="button"
                aria-expanded={openSections['websites']}
                aria-controls="websites-panel"
                onClick={() => toggleSection('websites')}
                className="w-full flex items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                <span className="flex flex-wrap items-center gap-3 text-left">
                  <span
                    className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-black ${
                      websiteSatisfied ? 'bg-emerald-500 text-slate-950' : 'bg-[#14B8A6] text-slate-950'
                    }`}
                  >
                    {websiteSatisfied ? <Check className="h-4 w-4 stroke-[3]" /> : '1'}
                  </span>
                  <span id="websites-heading" className="text-base font-extrabold text-white">
                    {COMMERCIAL_FLOW_STEPS[0].title}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${
                      websiteSatisfied
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    }`}
                  >
                    {websiteSatisfied ? 'Completed' : 'Step 1 · Required'}
                  </span>
                  {selectedWebsiteItem && (
                    <span className="text-xs font-bold text-teal-300 bg-white/10 px-2.5 py-0.5 rounded-full">
                      {selectedWebsiteItem.name}
                      {selectedAddOnsCount > 0 ? ` + ${selectedAddOnsCount} Add-On(s)` : ''}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-300 shrink-0 transition-transform ${
                    openSections['websites'] ? '' : '-rotate-90'
                  }`}
                />
              </button>

              <div id="websites-panel" hidden={!openSections['websites']}>
                <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs sm:text-sm text-slate-600">
                      Every business starts with a website or app. Select <strong>I Already Have a Website</strong> to
                      onboard your existing site, or choose a new build tier below.
                    </p>
                    {/* Compact Sub-Category Switcher */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => setWebsiteSubTab('existing')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          websiteSubTab === 'existing'
                            ? 'bg-[#0F172A] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Existing Website
                      </button>
                      <button
                        type="button"
                        onClick={() => setWebsiteSubTab('websites')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          websiteSubTab === 'websites'
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        New Websites
                      </button>
                      <button
                        type="button"
                        onClick={() => setWebsiteSubTab('ecommerce')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          websiteSubTab === 'ecommerce'
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        E-Commerce
                      </button>
                    </div>
                  </div>

                  {/* Sub-Tab 1A: Existing Website (Bring Your Own Website) + Quick Build Cards */}
                  {websiteSubTab === 'existing' && (
                    <div className="grid md:grid-cols-2 gap-5">
                      {/* Existing Website Package Card */}
                      {(() => {
                        const key = 'CATALOG:website-existing:one-time';
                        const isSelected = addedKey === key || inCart(key);
                        return (
                          <article
                            className={`rounded-2xl border-2 p-5 flex flex-col justify-between transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                                : 'border-[#14B8A6] bg-gradient-to-br from-teal-50/50 to-white hover:shadow-md'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#14B8A6] text-slate-950">
                                  {EXISTING_WEBSITE_PACKAGE.badge}
                                </span>
                                <span className="text-xs font-bold text-teal-700">Zero Build Fee</span>
                              </div>
                              <h3 className="text-lg font-extrabold text-slate-900 mb-1">
                                {EXISTING_WEBSITE_PACKAGE.name}
                              </h3>
                              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                                {EXISTING_WEBSITE_PACKAGE.description}
                              </p>
                              <ul className="space-y-1.5 mb-5">
                                {EXISTING_WEBSITE_PACKAGE.deliverables.slice(0, 4).map((d) => (
                                  <li key={d} className="flex items-start gap-2 text-xs text-slate-700">
                                    <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" /> {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
                              <div>
                                <span className="text-xl font-black text-slate-900">
                                  {isKenya ? 'KSh 0' : '$0'}
                                </span>
                                <span className="block text-[10px] text-slate-500">Included Onboarding</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdd(
                                    {
                                      kind: 'CATALOG',
                                      id: 'website-existing',
                                      name: EXISTING_WEBSITE_PACKAGE.name,
                                      cycle: 'one-time',
                                      qty: 1,
                                      unitPrice: 0,
                                      currency: activeCurrency,
                                    },
                                    key
                                  )
                                }
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#0F172A] text-white hover:bg-slate-800'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="h-4 w-4" /> Selected
                                  </>
                                ) : (
                                  <>Use My Existing Website</>
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })()}

                      {/* Most Popular New Website Build Card (Quick Comparison) */}
                      {(() => {
                        const businessPkg = WEBSITE_PACKAGES.find((p) => p.id === 'business') || WEBSITE_PACKAGES[0];
                        const { productId, amount } = websiteBuildOptions.mapWebsitePkg(businessPkg.id);
                        const key = `CATALOG:${productId}:one-time`;
                        const isSelected = addedKey === key || inCart(key);
                        return (
                          <article
                            className={`rounded-2xl border-2 p-5 flex flex-col justify-between transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                  Need a New Website Built?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setWebsiteSubTab('websites')}
                                  className="text-xs font-bold text-[#2563EB] hover:underline"
                                >
                                  Compare all {WEBSITE_PACKAGES.length} build tiers &rarr;
                                </button>
                              </div>
                              <h3 className="text-lg font-extrabold text-slate-900 mb-1">
                                {businessPkg.name} Website Build
                              </h3>
                              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                                {businessPkg.description}
                              </p>
                              <ul className="space-y-1.5 mb-5">
                                {businessPkg.deliverables.slice(0, 4).map((d) => (
                                  <li key={d} className="flex items-start gap-2 text-xs text-slate-700">
                                    <Check className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" /> {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
                              <div>
                                <span className="text-xl font-black text-slate-900">
                                  {formatMoney(amount, symbol)}
                                </span>
                                <span className="block text-[10px] text-slate-500">{businessPkg.pages} · one-time</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdd(
                                    {
                                      kind: 'CATALOG',
                                      id: productId,
                                      name: `${businessPkg.name} Website`,
                                      cycle: 'one-time',
                                      qty: 1,
                                      unitPrice: amount,
                                      currency: activeCurrency,
                                    },
                                    key
                                  )
                                }
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#2563EB] text-white hover:bg-blue-700'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="h-4 w-4" /> Selected
                                  </>
                                ) : (
                                  <>Select Business Build</>
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })()}
                    </div>
                  )}

                  {/* Sub-Tab 1B: New Website Builds */}
                  {websiteSubTab === 'websites' && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {WEBSITE_PACKAGES.map((pkg) => {
                        const { productId, amount } = websiteBuildOptions.mapWebsitePkg(pkg.id);
                        const key = `CATALOG:${productId}:one-time`;
                        const isSelected = addedKey === key || inCart(key);
                        return (
                          <article
                            key={pkg.id}
                            className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                                : pkg.popular
                                  ? 'border-[#2563EB] ring-1 ring-[#2563EB]/20 bg-white'
                                  : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-2">
                                <h3 className="font-extrabold text-slate-900 text-sm">{pkg.name}</h3>
                                {pkg.badge && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                    {pkg.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mb-3">{pkg.pages} · {pkg.timeline}</p>
                              <ul className="space-y-1.5 mb-4">
                                {pkg.deliverables.slice(0, 4).map((d) => (
                                  <li key={d} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                                    <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="mb-3">
                                <span className="text-lg font-extrabold text-slate-900">
                                  {formatMoney(amount, symbol)}
                                </span>
                                <span className="text-[10px] text-slate-500 block">One-time build</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdd(
                                    {
                                      kind: 'CATALOG',
                                      id: productId,
                                      name: `${pkg.name} Website`,
                                      cycle: 'one-time',
                                      qty: 1,
                                      unitPrice: amount,
                                      currency: activeCurrency,
                                    },
                                    key
                                  )
                                }
                                className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#2563EB] text-white hover:bg-blue-700'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" /> Selected
                                  </>
                                ) : (
                                  <>Select {pkg.name}</>
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {/* Sub-Tab 1C: E-Commerce Stores */}
                  {websiteSubTab === 'ecommerce' && (
                    <div className="grid sm:grid-cols-3 gap-4">
                      {ECOMMERCE_PACKAGES.map((pkg) => {
                        const { productId, amount } = websiteBuildOptions.mapEcomPkg(pkg.id);
                        const key = `CATALOG:${productId}:one-time`;
                        const isSelected = addedKey === key || inCart(key);
                        return (
                          <article
                            key={pkg.id}
                            className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                                : pkg.popular
                                  ? 'border-[#2563EB] ring-1 ring-[#2563EB]/20 bg-white'
                                  : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-2">
                                <h3 className="font-extrabold text-slate-900 text-sm">{pkg.name}</h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                                  {pkg.products}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mb-3">{pkg.description}</p>
                              <ul className="space-y-1.5 mb-4">
                                {pkg.features.slice(0, 4).map((f) => (
                                  <li key={f} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                                    <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> {f}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="mb-3">
                                <span className="text-lg font-extrabold text-slate-900">
                                  {formatMoney(amount, symbol)}
                                </span>
                                <span className="text-[10px] text-slate-500 block">One-time store build</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdd(
                                    {
                                      kind: 'CATALOG',
                                      id: productId,
                                      name: pkg.name,
                                      cycle: 'one-time',
                                      qty: 1,
                                      unitPrice: amount,
                                      currency: activeCurrency,
                                    },
                                    key
                                  )
                                }
                                className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#2563EB] text-white hover:bg-blue-700'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" /> Selected
                                  </>
                                ) : (
                                  <>Select {pkg.name}</>
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {/* Nested Add-Ons Collapsible Sub-Section inside Step 1 */}
                  <div
                    id="addons"
                    aria-labelledby="addons-heading"
                    className="scroll-mt-44 rounded-2xl border border-slate-200 bg-slate-50/80 overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={openSections['addons']}
                      aria-controls="addons-panel"
                      onClick={() => toggleSection('addons')}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-100/80 transition-colors"
                    >
                      <span className="flex flex-wrap items-center gap-2.5">
                        <Puzzle className="h-4 w-4 text-[#2563EB]" />
                        <span id="addons-heading" className="text-sm font-extrabold text-slate-900">
                          Step 1B · Add Optional Website Add-Ons &amp; Integrations
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-white text-slate-600 border border-slate-200 px-2 py-0.5">
                          Optional ({addonItems.length})
                        </span>
                        {selectedAddOnsCount > 0 && (
                          <span className="text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5">
                            {selectedAddOnsCount} selected
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-500 transition-transform ${
                          openSections['addons'] ? '' : '-rotate-90'
                        }`}
                      />
                    </button>

                    <div id="addons-panel" hidden={!openSections['addons']}>
                      <div className="px-5 pb-5 pt-3 border-t border-slate-200/80">
                        <p className="text-xs text-slate-600 mb-4">
                          Bolt feature modules (M-Pesa STK Push, Booking, SEO, Copywriting, Migration) onto your new or
                          existing website.
                        </p>
                        {catalog.isLoading ? (
                          <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading add-ons…
                          </div>
                        ) : (
                          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                            {addonItems.map((item) => {
                              const marketing =
                                PRODUCT_MARKETING[item.productId] ?? fallbackMarketing(item.productId);
                              const key = `CATALOG:${item.productId}:${item.billingPeriod ?? 'one-time'}`;
                              return (
                                <article
                                  key={item.id}
                                  className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between hover:shadow-xs transition-shadow"
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                                        {marketing.name}
                                      </h3>
                                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">
                                        {item.billingPeriod ?? 'one-time'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-3">{marketing?.description ?? ''}</p>
                                  </div>
                                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <span className="text-sm font-extrabold text-slate-900">
                                      {formatMoney(item.amount, symbol)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAdd(
                                          {
                                            kind: 'CATALOG',
                                            id: item.productId,
                                            name: marketing.name,
                                            cycle: item.billingPeriod ?? 'one-time',
                                            qty: 1,
                                            unitPrice: item.amount,
                                            currency: activeCurrency,
                                          },
                                          key
                                        )
                                      }
                                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                                        addedKey === key || inCart(key)
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-800 text-white hover:bg-slate-900'
                                      }`}
                                    >
                                      {addedKey === key || inCart(key) ? (
                                        <Check className="h-3.5 w-3.5" />
                                      ) : (
                                        <Plus className="h-3.5 w-3.5" />
                                      )}
                                      {addedKey === key || inCart(key) ? 'Added' : 'Add'}
                                    </button>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Step 1 Footer Navigation */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      {websiteSatisfied
                        ? `Selected: ${selectedWebsiteItem?.name}`
                        : 'Select an existing website or a new build tier above to complete Step 1.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openOnlyStep('domains')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                    >
                      Continue to Step 2: Domain <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════════
                STEP 2: DOMAIN NAME (MANDATORY — EXISTING OR NEW)
               ══════════════════════════════════════════════════════════════════ */}
            <section
              id="domains"
              aria-labelledby="domains-heading"
              className={`scroll-mt-44 rounded-3xl border-2 bg-white shadow-sm overflow-hidden transition-colors ${
                domainSatisfied ? 'border-emerald-300' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                aria-expanded={openSections['domains']}
                aria-controls="domains-panel"
                onClick={() => toggleSection('domains')}
                className="w-full flex items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                <span className="flex flex-wrap items-center gap-3 text-left">
                  <span
                    className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-black ${
                      domainSatisfied ? 'bg-emerald-500 text-slate-950' : 'bg-[#14B8A6] text-slate-950'
                    }`}
                  >
                    {domainSatisfied ? <Check className="h-4 w-4 stroke-[3]" /> : '2'}
                  </span>
                  <span id="domains-heading" className="text-base font-extrabold text-white">
                    {COMMERCIAL_FLOW_STEPS[1].title}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${
                      domainSatisfied
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    }`}
                  >
                    {domainSatisfied ? 'Completed' : 'Step 2 · Required'}
                  </span>
                  {selectedDomainItem && (
                    <span className="text-xs font-bold text-teal-300 bg-white/10 px-2.5 py-0.5 rounded-full">
                      {selectedDomainItem.name}
                      {selectedDomainItem.meta ? ` (${selectedDomainItem.meta})` : ''}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-300 shrink-0 transition-transform ${
                    openSections['domains'] ? '' : '-rotate-90'
                  }`}
                />
              </button>

              <div id="domains-panel" hidden={!openSections['domains']}>
                <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs sm:text-sm text-slate-600">
                      After having a website, you need a domain name. Connect a domain you already bought or register a
                      new one below.
                    </p>
                    <div className="flex items-center gap-2">
                      <label htmlFor="store-domain-input" className="sr-only">
                        Your domain name
                      </label>
                      <input
                        id="store-domain-input"
                        type="text"
                        value={domainNameInput}
                        onChange={(e) => setDomainNameInput(e.target.value)}
                        placeholder="e.g. yourbusiness.co.ke"
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] w-full sm:w-56"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {DOMAIN_PACKAGES.map((dom) => {
                      const amount = isKenya ? dom.rawKes : dom.rawUsd;
                      const cycle = dom.billingPeriod === 'year' ? 'year' : 'one-time';
                      const key = `CATALOG:${dom.id}:${cycle}`;
                      const isSelected = addedKey === key || inCart(key);

                      return (
                        <article
                          key={dom.id}
                          className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                              : dom.isExisting
                                ? 'border-[#14B8A6] bg-teal-50/30'
                                : dom.popular
                                  ? 'border-[#2563EB] bg-white'
                                  : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div>
                            {dom.badge && (
                              <span
                                className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 ${
                                  dom.isExisting
                                    ? 'bg-[#14B8A6] text-slate-950'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {dom.badge}
                              </span>
                            )}
                            <h3 className="font-extrabold text-slate-900 text-sm mb-1">{dom.name}</h3>
                            <p className="text-xs text-slate-500 mb-3">{dom.description}</p>
                            <ul className="space-y-1.5 mb-4">
                              {dom.features.map((f) => (
                                <li key={f} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                                  <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <div className="mb-3">
                              <span className="text-lg font-extrabold text-slate-900">
                                {amount === 0 ? (isKenya ? 'KSh 0' : '$0') : formatMoney(amount, symbol)}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {dom.billingPeriod === 'year' ? 'Per year' : 'Included DNS setup'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleAdd(
                                  {
                                    kind: 'CATALOG',
                                    id: dom.id,
                                    name: dom.name,
                                    cycle,
                                    qty: 1,
                                    unitPrice: amount,
                                    currency: activeCurrency,
                                    ...(domainNameInput.trim() ? { meta: domainNameInput.trim() } : {}),
                                  },
                                  key
                                )
                              }
                              className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : dom.isExisting
                                    ? 'bg-[#0F172A] text-white hover:bg-slate-800'
                                    : 'bg-[#2563EB] text-white hover:bg-blue-700'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="h-3.5 w-3.5" /> Selected
                                </>
                              ) : dom.isExisting ? (
                                <>Use Existing Domain</>
                              ) : (
                                <>Select Domain</>
                              )}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Step 2 Footer Navigation */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      {domainSatisfied
                        ? `Selected: ${selectedDomainItem?.name}`
                        : 'Choose an existing domain or new registration to complete Step 2.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openOnlyStep('hosting')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                    >
                      Continue to Step 3: Hosting <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════════
                STEP 3: MANAGED HOSTING PACKAGE (MANDATORY)
               ══════════════════════════════════════════════════════════════════ */}
            <section
              id="hosting"
              aria-labelledby="hosting-heading"
              className={`scroll-mt-44 rounded-3xl border-2 bg-white shadow-sm overflow-hidden transition-colors ${
                hostingSatisfied ? 'border-emerald-300' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                aria-expanded={openSections['hosting']}
                aria-controls="hosting-panel"
                onClick={() => toggleSection('hosting')}
                className="w-full flex items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                <span className="flex flex-wrap items-center gap-3 text-left">
                  <span
                    className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-black ${
                      hostingSatisfied ? 'bg-emerald-500 text-slate-950' : 'bg-[#14B8A6] text-slate-950'
                    }`}
                  >
                    {hostingSatisfied ? <Check className="h-4 w-4 stroke-[3]" /> : '3'}
                  </span>
                  <span id="hosting-heading" className="text-base font-extrabold text-white">
                    {COMMERCIAL_FLOW_STEPS[2].title}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${
                      hostingSatisfied
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    }`}
                  >
                    {hostingSatisfied ? 'Completed' : 'Step 3 · Required'}
                  </span>
                  {selectedHostingItem && (
                    <span className="text-xs font-bold text-teal-300 bg-white/10 px-2.5 py-0.5 rounded-full">
                      {selectedHostingItem.name}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-300 shrink-0 transition-transform ${
                    openSections['hosting'] ? '' : '-rotate-90'
                  }`}
                />
              </button>

              <div id="hosting-panel" hidden={!openSections['hosting']}>
                <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-5">
                  <p className="text-xs sm:text-sm text-slate-600">
                    Choose a managed cloud hosting package for fast online visibility, automated SSL, and daily offsite
                    R2 backups.
                  </p>
                  {catalog.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading hosting packages…
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {hostingItems.map((item) => {
                        const marketing = PRODUCT_MARKETING[item.productId] ?? fallbackMarketing(item.productId);
                        const key = `CATALOG:${item.productId}:${item.billingPeriod ?? 'one-time'}`;
                        const isSelected = addedKey === key || inCart(key);
                        return (
                          <article
                            key={item.id}
                            className={`rounded-2xl border overflow-hidden bg-white shadow-sm flex flex-col hover:shadow-md transition-all ${
                              isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
                            }`}
                          >
                            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3.5">
                              <h3 className="text-white font-bold text-base">{marketing.name}</h3>
                            </div>
                            <div className="p-5 flex flex-col flex-1">
                              <p className="text-xs text-slate-500 mb-4">{marketing?.description ?? ''}</p>
                              <ul className="space-y-2 mb-5 flex-1">
                                {(marketing?.features ?? []).map((f) => (
                                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                                    <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> {f}
                                  </li>
                                ))}
                              </ul>
                              <div className="mb-4">
                                <span className="text-2xl font-extrabold text-slate-900">
                                  {formatMoney(item.amount, symbol)}
                                </span>
                                <span className="text-xs text-slate-500"> /{item.billingPeriod ?? 'year'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdd(
                                    {
                                      kind: 'CATALOG',
                                      id: item.productId,
                                      name: marketing.name,
                                      cycle: item.billingPeriod ?? 'one-time',
                                      qty: 1,
                                      unitPrice: item.amount,
                                      currency: activeCurrency,
                                    },
                                    key
                                  )
                                }
                                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-800 text-white hover:bg-slate-900'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="h-4 w-4" /> In Cart
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4" /> Select Hosting
                                  </>
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {/* Step 3 Footer Navigation */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      {hostingSatisfied
                        ? `Selected: ${selectedHostingItem?.name ?? 'Included in Plan'}`
                        : 'Select a hosting package above to complete Step 3.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openOnlyStep('plans')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                    >
                      Continue to Step 4: Care Plan (Optional) <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════════
                STEP 4: WEBSITE CARE & MAINTENANCE PLAN (OPTIONAL)
               ══════════════════════════════════════════════════════════════════ */}
            <section
              id="plans"
              aria-labelledby="plans-heading"
              className={`scroll-mt-44 rounded-3xl border-2 bg-white shadow-sm overflow-hidden transition-colors ${
                careSatisfied ? 'border-emerald-300' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                aria-expanded={openSections['plans']}
                aria-controls="plans-panel"
                onClick={() => toggleSection('plans')}
                className="w-full flex items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                <span className="flex flex-wrap items-center gap-3 text-left">
                  <span
                    className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-black ${
                      careSatisfied ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-white'
                    }`}
                  >
                    {careSatisfied ? <Check className="h-4 w-4 stroke-[3]" /> : '4'}
                  </span>
                  <span id="plans-heading" className="text-base font-extrabold text-white">
                    {COMMERCIAL_FLOW_STEPS[3].title}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/40 px-2.5 py-0.5">
                    Step 4 · Optional
                  </span>
                  {cartPlanItem && (
                    <span className="text-xs font-bold text-teal-300 bg-white/10 px-2.5 py-0.5 rounded-full">
                      {cartPlanItem.name}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-300 shrink-0 transition-transform ${
                    openSections['plans'] ? '' : '-rotate-90'
                  }`}
                />
              </button>

              <div id="plans-panel" hidden={!openSections['plans']}>
                <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs sm:text-sm text-slate-600">
                      Optional ongoing maintenance that keeps your site updated, backed up, and secure. You can add a
                      care plan below or proceed with the standard post-launch warranty.
                    </p>
                    {cartPlanItem && (
                      <button
                        type="button"
                        onClick={() => removeItem(cartPlanItem.key)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 shrink-0"
                      >
                        Skip Care Plan (Warranty Only)
                      </button>
                    )}
                  </div>

                  {plansLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading care plans…
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
                      {(plans ?? [])
                        .filter((p) => PLAN_MARKETING[p.slug])
                        .map((plan) => {
                          const marketing = PLAN_MARKETING[plan.slug];
                          const key = `PLAN:${plan.slug}:MONTHLY`;
                          const headerStyle = PLAN_HEADER_STYLES[plan.slug] ?? 'bg-slate-800 text-white';
                          const displayName =
                            plan.name ||
                            plan.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                          return (
                            <article
                              key={plan.id}
                              className={`rounded-2xl border overflow-hidden bg-white shadow-sm flex flex-col transition-shadow hover:shadow-md ${
                                plan.tier === 'RECOMMENDED'
                                  ? 'border-[#2563EB] ring-1 ring-[#2563EB]/30'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className={`px-5 py-4 flex items-center justify-between ${headerStyle}`}>
                                <h3 className="text-white font-extrabold text-lg tracking-tight">{displayName}</h3>
                                {plan.tier === 'RECOMMENDED' ||
                                plan.slug === 'growth' ||
                                plan.slug === 'care-business' ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                                    Popular
                                  </span>
                                ) : null}
                              </div>
                              <div className="p-5 flex flex-col flex-1">
                                <p className="text-xs text-slate-500 mb-4">{marketing?.description ?? ''}</p>
                                <ul className="space-y-2 mb-5 flex-1">
                                  {(marketing?.features ?? []).slice(0, 5).map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                                      <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> {f}
                                    </li>
                                  ))}
                                </ul>
                                <div className="flex items-end justify-between mb-4">
                                  <div>
                                    <span className="text-2xl font-extrabold text-slate-900">
                                      {formatMoney(isKenya ? plan.priceMonthlyKes : plan.priceMonthly, symbol)}
                                    </span>
                                    <span className="text-xs text-slate-500"> /month</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const planPrice = isKenya ? plan.priceMonthlyKes : plan.priceMonthly;
                                    const planCurrency = isKenya ? 'KES' : activeCurrency;
                                    handleAdd(
                                      {
                                        kind: 'PLAN',
                                        id: plan.slug,
                                        name: plan.name,
                                        cycle: 'MONTHLY',
                                        qty: 1,
                                        unitPrice: planPrice,
                                        currency: planCurrency,
                                      },
                                      key
                                    );
                                  }}
                                  className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                                    addedKey === key || inCart(key)
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-[#2563EB] text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {addedKey === key || inCart(key) ? (
                                    <>
                                      <Check className="h-4 w-4" /> In Cart
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-4 w-4" /> Add to Cart
                                    </>
                                  )}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Contextual WhatsApp Support Banner */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <p className="text-sm font-bold text-emerald-950">Need a custom enterprise scope or proposal?</p>
                <p className="text-xs text-emerald-700">
                  Generate a formal PDF proposal in our Quote Calculator or chat directly with our solutions engineering
                  team on WhatsApp.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link
                  href="/quote"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Formal Proposal Builder <ArrowRight className="h-4 w-4" />
                </Link>
                <WhatsAppLink
                  source="store"
                  message="Hello BazionWeb, I'm configuring my stack and need help choosing the right package."
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                  iconClassName="h-4 w-4"
                >
                  Chat on WhatsApp
                </WhatsAppLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
