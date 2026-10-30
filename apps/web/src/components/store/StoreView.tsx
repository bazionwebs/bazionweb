'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  Check,
  Plus,
  Server,
  Wrench,
  Puzzle,
  Globe,
  LayoutList,
  ArrowRight,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { resolveApiV1Base } from '@/lib/api-base';
import { usePlans, PLAN_MARKETING } from '@/lib/plans';
import { useCartStore } from '@/lib/cart';

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

/** Presentation-only copy per price-book product ID (prices always come from the API). */
const PRODUCT_MARKETING: Record<string, { name: string; description: string; features: string[] }> = {
  'host-essential': {
    name: 'Host Essential',
    description: 'Managed NVMe web hosting with SSL, Cloudflare Edge DNS, and automated weekly backups.',
    features: ['High-Speed SSD NVMe Storage', 'Free Automated SSL Certificate', 'Cloudflare Edge DNS & CDN', '99.9% Uptime Monitoring', 'Standard Technical Support'],
  },
  'host-business': {
    name: 'Host Business',
    description: 'Enhanced hosting with 5 corporate email inboxes, daily backups, and staging testing.',
    features: ['3x CPU & Memory Allocation', 'Up to 5 Business Email Inboxes', 'Automated Daily Backups (14-Day)', 'Staging Environment Slot', 'Free Zero-Downtime Migration'],
  },
  'host-pro': {
    name: 'Host Professional',
    description: 'High-resource managed cloud hosting with Redis object caching and 30-day snapshots.',
    features: ['Dedicated Compute & Redis Cache', '30-Day Snapshot Retention', 'Continuous Malware & WAF Defense', 'Automated Staging & Git Hooks', 'Priority Phone & Ticket Support'],
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
  description: 'Configured for the Kenyan market in the active price book.',
  features: [] as string[],
});

const CATEGORIES = [
  { id: 'plans', label: 'Care Plans', icon: Wrench, match: () => true, source: 'plans' as const },
  { id: 'hosting', label: 'Hosting', icon: Server, match: (p: string) => p.startsWith('host-'), source: 'catalog' as const },
  { id: 'addons', label: 'Add-ons', icon: Puzzle, match: (p: string) => p.startsWith('addon-'), source: 'catalog' as const },
];

const formatMoney = (amount: number, symbol: string) =>
  `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function StoreView() {
  const apiBase = resolveApiV1Base();
  const { plans, loading: plansLoading } = usePlans();
  const [addedKey, setAddedKey] = useState<string | null>(null);

  const catalog = useQuery<CatalogResponse>({
    queryKey: ['store-catalog', 'KE'],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/pricing/catalog?market=KE`, { cache: 'no-store' });
      const envelope = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(envelope?.message || 'Could not load the store catalog.');
      return envelope?.data ?? envelope;
    },
    staleTime: 5 * 60 * 1000,
  });

  const add = useCartStore((s) => s.add);
  const items = useCartStore((s) => s.items);
  const inCart = (key: string) => items.some((i) => i.key === key);

  const symbol = catalog.data?.market.currencySymbol ?? 'KES ';

  const handleAdd = (item: Parameters<typeof add>[0], key: string) => {
    add(item);
    setAddedKey(key);
    setTimeout(() => setAddedKey(null), 1500);
  };

  // Deep-link support: /store?add=<plan-slug|productId> drops the item straight
  // into the cart and scrolls to its section, so pricing-page CTAs land mid-flow.
  const searchParams = useSearchParams();
  const router = useRouter();
  const addParam = searchParams.get('add');
  useEffect(() => {
    if (!addParam || plansLoading || catalog.isLoading) return;
    const plan = (plans ?? []).find((p) => p.slug === addParam);
    if (plan && PLAN_MARKETING[plan.slug]) {
      add({
        kind: 'PLAN',
        id: plan.slug,
        name: plan.name,
        cycle: 'MONTHLY',
        qty: 1,
        unitPrice: plan.priceMonthlyKes,
        currency: 'KES',
      });
      setAddedKey(`PLAN:${plan.slug}:MONTHLY`);
      document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' });
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
          currency: catalog.data?.market.currencyCode ?? 'KES',
        });
        setAddedKey(`CATALOG:${price.productId}:${price.billingPeriod ?? 'one-time'}`);
        document
          .getElementById(price.productId.startsWith('host-') ? 'hosting' : 'addons')
          ?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    // Clean the param so a refresh doesn't re-trigger the add.
    router.replace('/store', { scroll: false });
  }, [addParam, plans, plansLoading, catalog.data, catalog.isLoading, add, router]);

  const hostingItems = useMemo(
    () => (catalog.data?.prices ?? []).filter((p) => p.productId.startsWith('host-')),
    [catalog.data],
  );
  const addonItems = useMemo(
    () => (catalog.data?.prices ?? []).filter((p) => p.productId.startsWith('addon-')),
    [catalog.data],
  );

  return (
    <main className="bg-white">
      {/* Hero — mirrors the site's dark navy band */}
      <section className="bg-[#0F172A] pt-32 pb-16 text-white">
        <div className="container-default max-w-7xl mx-auto px-4">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            <ShoppingCart className="h-4 w-4" /> BazionWeb Store
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Build your stack, your way</h1>
          <p className="text-base md:text-lg text-slate-300 max-w-2xl leading-relaxed">
            Pick a care plan, add hosting and extras, and check out once with M-Pesa or card.
            Every price is pulled live from our commercial schedule — no stale numbers.
          </p>
        </div>
      </section>

      <div className="container-default max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar — categories & actions, Braysons-style */}
          <aside className="lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-28 space-y-6">
              <nav aria-label="Store categories" className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <LayoutList className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-800">Categories</span>
                </div>
                <ul>
                  {CATEGORIES.map((cat) => (
                    <li key={cat.id}>
                      <a
                        href={`#${cat.id}`}
                        className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600 hover:text-[#2563EB] hover:bg-blue-50/60 border-b border-slate-100 last:border-0 transition-colors"
                      >
                        <cat.icon className="h-4 w-4" /> {cat.label}
                      </a>
                    </li>
                  ))}
                  <li>
                    <a
                      href="#websites"
                      className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600 hover:text-[#2563EB] hover:bg-blue-50/60 transition-colors"
                    >
                      <Globe className="h-4 w-4" /> Website Builds
                    </a>
                  </li>
                </ul>
              </nav>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-800">Actions</div>
                <div className="p-3">
                  <Link
                    href="/cart"
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" /> View Cart
                    </span>
                    <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
                      {items.reduce((n, i) => n + i.qty, 0)}
                    </span>
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900 mb-1">Not sure what you need?</p>
                <p className="text-xs text-emerald-700 mb-3">Talk to us and we&apos;ll scope it for you.</p>
                <a
                  href="https://wa.me/254733338989"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp support
                </a>
              </div>
            </div>
          </aside>

          {/* Product sections */}
          <div className="flex-1 min-w-0 space-y-14">
            {/* Care plans — the subscription anchor */}
            <section id="plans" aria-labelledby="plans-heading" className="scroll-mt-32">
              <h2 id="plans-heading" className="text-2xl font-extrabold text-slate-900 mb-2">Managed Care Plans</h2>
              <p className="text-sm text-slate-500 mb-6">
                The subscription that keeps your site updated, backed up, and secure. One per order.
              </p>
              {plansLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading plans…
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {(plans ?? []).filter((p) => PLAN_MARKETING[p.slug]).map((plan) => {
                    const marketing = PLAN_MARKETING[plan.slug];
                    const key = `PLAN:${plan.slug}:MONTHLY`;
                    return (
                      <article
                        key={plan.id}
                        className={`rounded-2xl border overflow-hidden bg-white shadow-sm flex flex-col transition-shadow hover:shadow-md ${
                          plan.tier === 'RECOMMENDED' ? 'border-[#2563EB] ring-1 ring-[#2563EB]/30' : 'border-slate-200'
                        }`}
                      >
                        <div className={`bg-gradient-to-r ${marketing.color} px-5 py-4`}>
                          <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <p className="text-xs text-slate-500 mb-4">{marketing.description}</p>
                          <ul className="space-y-2 mb-5 flex-1">
                            {marketing.features.slice(0, 5).map((f) => (
                              <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                                <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> {f}
                              </li>
                            ))}
                          </ul>
                          <div className="flex items-end justify-between mb-4">
                            <div>
                              <span className="text-2xl font-extrabold text-slate-900">
                                {formatMoney(plan.priceMonthlyKes, 'KES ')}
                              </span>
                              <span className="text-xs text-slate-500"> /month</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdd(
                                {
                                  kind: 'PLAN',
                                  id: plan.slug,
                                  name: plan.name,
                                  cycle: 'MONTHLY',
                                  qty: 1,
                                  unitPrice: plan.priceMonthlyKes,
                                  currency: 'KES',
                                },
                                key,
                              )
                            }
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
            </section>

            {/* Hosting */}
            <section id="hosting" aria-labelledby="hosting-heading" className="scroll-mt-32">
              <h2 id="hosting-heading" className="text-2xl font-extrabold text-slate-900 mb-2">Hosting</h2>
              <p className="text-sm text-slate-500 mb-6">Annual hosting billed with your first invoice — no separate signup.</p>
              {catalog.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading catalog…
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {hostingItems.map((item) => {
                    const marketing = PRODUCT_MARKETING[item.productId] ?? fallbackMarketing(item.productId);
                    const key = `CATALOG:${item.productId}:${item.billingPeriod ?? 'one-time'}`;
                    return (
                      <article key={item.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm flex flex-col hover:shadow-md transition-shadow">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4">
                          <h3 className="text-white font-bold text-lg">{marketing.name}</h3>
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <p className="text-xs text-slate-500 mb-4">{marketing.description}</p>
                          <ul className="space-y-2 mb-5 flex-1">
                            {marketing.features.map((f) => (
                              <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                                <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> {f}
                              </li>
                            ))}
                          </ul>
                          <div className="mb-4">
                            <span className="text-2xl font-extrabold text-slate-900">{formatMoney(item.amount, symbol)}</span>
                            <span className="text-xs text-slate-500"> /{item.billingPeriod ?? 'one-time'}</span>
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
                                  currency: catalog.data?.market.currencyCode ?? 'KES',
                                },
                                key,
                              )
                            }
                            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                              addedKey === key || inCart(key)
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-white hover:bg-slate-900'
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
            </section>

            {/* Add-ons */}
            <section id="addons" aria-labelledby="addons-heading" className="scroll-mt-32">
              <h2 id="addons-heading" className="text-2xl font-extrabold text-slate-900 mb-2">Add-ons</h2>
              <p className="text-sm text-slate-500 mb-6">Bolt extras onto any plan — billed once with your first invoice.</p>
              {catalog.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading catalog…
                </div>
              ) : addonItems.length === 0 ? (
                <p className="text-sm text-slate-500 py-6">No add-ons published in the current price book.</p>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {addonItems.map((item) => {
                    const marketing = PRODUCT_MARKETING[item.productId] ?? fallbackMarketing(item.productId);
                    const key = `CATALOG:${item.productId}:${item.billingPeriod ?? 'one-time'}`;
                    return (
                      <article key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-bold text-slate-900">{marketing.name}</h3>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                            {item.billingPeriod ?? 'one-time'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-4 flex-1">{marketing.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-extrabold text-slate-900">{formatMoney(item.amount, symbol)}</span>
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
                                  currency: catalog.data?.market.currencyCode ?? 'KES',
                                },
                                key,
                              )
                            }
                            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                              addedKey === key || inCart(key)
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-white hover:bg-slate-900'
                            }`}
                          >
                            {addedKey === key || inCart(key) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            {addedKey === key || inCart(key) ? 'Added' : 'Add'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Website builds route to the quote flow — custom-priced, not cart items */}
            <section id="websites" aria-labelledby="websites-heading" className="scroll-mt-32 rounded-2xl bg-[#0F172A] text-white p-8 md:p-10">
              <h2 id="websites-heading" className="text-2xl font-extrabold mb-2">Need a website built?</h2>
              <p className="text-sm text-slate-300 max-w-xl mb-6">
                Website builds are scoped and priced per project. Answer a few questions and get a
                fixed quote with a deposit invoice in minutes.
              </p>
              <Link
                href="/quote"
                className="inline-flex items-center gap-2 rounded-xl bg-[#14B8A6] px-5 py-3 text-sm font-bold text-[#0F172A] hover:bg-teal-400 transition-colors"
              >
                Get a quote <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
