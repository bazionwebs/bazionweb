'use client';

import React from 'react';
import Link from 'next/link';
import {
  Check,
  CircleAlert,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  ArrowRight,
  Wrench,
  Server,
  Puzzle,
  Globe,
  Layout,
} from 'lucide-react';
import {
  type CartItem,
  isWebsiteItem,
  isDomainItem,
  isHostingItem,
  isCarePlanItem,
  isAddOnItem,
} from '@/lib/cart';
import { BILLING_CYCLES_META, getBillingCycleMeta } from '@/lib/priceBooks';

export interface StoreOrderSummaryProps {
  items: CartItem[];
  websiteSatisfied?: boolean;
  domainSatisfied?: boolean;
  careSatisfied?: boolean;
  hostingSatisfied: boolean;
  bundlePlanIncludesHosting?: boolean;
  activeCurrency?: 'KES' | 'USD';
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
  onSelectStep?: (stepId: 'websites' | 'domains' | 'hosting' | 'plans') => void;
}

const money = (item: CartItem) => {
  const total = item.unitPrice * item.qty;
  const prefix = item.currency === 'KES' ? 'KES ' : `${item.currency} `;
  if (total === 0) return `Included (${prefix}0)`;
  return `${prefix}${total.toLocaleString()}`;
};

const groupName = (item: CartItem) => {
  if (isWebsiteItem(item)) return 'Step 1 · Website / App Foundation';
  if (isAddOnItem(item)) return 'Step 1 · Add-On Enhancement';
  if (isDomainItem(item)) return item.meta ? `Step 2 · Domain (${item.meta})` : 'Step 2 · Domain Name';
  if (isHostingItem(item)) return 'Step 3 · Managed Hosting';
  if (isCarePlanItem(item)) return 'Step 4 · Care Plan (Optional)';
  return 'Add-on';
};

export default function StoreOrderSummary({
  items,
  websiteSatisfied,
  domainSatisfied,
  careSatisfied,
  hostingSatisfied,
  bundlePlanIncludesHosting = false,
  activeCurrency,
  onQty,
  onRemove,
  onCheckout,
  onSelectStep,
}: StoreOrderSummaryProps) {
  const planItem = items.find((i) => i.kind === 'PLAN');
  const catalogItems = items.filter((i) => i.kind === 'CATALOG');

  const resolvedWebsiteSatisfied = websiteSatisfied ?? items.some(isWebsiteItem);
  const resolvedDomainSatisfied = domainSatisfied ?? items.some(isDomainItem);
  const resolvedCareSatisfied = careSatisfied ?? items.some(isCarePlanItem);

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const currency = activeCurrency || planItem?.currency || catalogItems[0]?.currency || 'KES';
  const anyKes = currency === 'KES';
  const ready = resolvedWebsiteSatisfied && resolvedDomainSatisfied && hostingSatisfied;

  // Sort catalog items in canonical 1 -> 2 -> 3 -> 4 order
  const stepRank = (item: CartItem) => {
    if (isWebsiteItem(item)) return 1;
    if (isAddOnItem(item)) return 2;
    if (isDomainItem(item)) return 3;
    if (isHostingItem(item)) return 4;
    if (isCarePlanItem(item)) return 5;
    return 6;
  };
  const sortedCatalogItems = [...catalogItems].sort((a, b) => stepRank(a) - stepRank(b));

  const handleStepClick = (e: React.MouseEvent, stepId: 'websites' | 'domains' | 'hosting' | 'plans') => {
    if (onSelectStep) {
      e.preventDefault();
      onSelectStep(stepId);
    }
  };

  return (
    <section
      data-testid="store-order-summary"
      aria-label="Shopping cart summary"
      className="rounded-3xl border-2 border-slate-200 bg-white shadow-xl overflow-hidden"
    >
      <div className="bg-[#0F172A] px-5 py-4 text-white border-b border-slate-800">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#14B8A6]">
            <ShoppingCart className="h-4 w-4" /> Frozen Cart · Live Total
          </span>
          <span className="text-[11px] font-bold rounded-full bg-white/10 px-2.5 py-0.5 border border-white/15">
            {items.reduce((n, i) => n + i.qty, 0)} item{items.reduce((n, i) => n + i.qty, 0) === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between pt-2 border-t border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-300">Current Total:</span>
          <span className="text-lg font-black text-white">
            {anyKes ? 'KES ' : `${currency} `}
            {subtotal.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Mandatory 4-step stack checklist */}
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
            Mandatory Step-by-Step Stack Flow
          </p>
          <ul className="space-y-2">
            {/* Step 1: Website / App (Mandatory) */}
            <li
              data-testid="requirement-website"
              className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 border transition-colors ${
                resolvedWebsiteSatisfied
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                  : 'border-amber-200 bg-amber-50/70 text-amber-900'
              }`}
            >
              {resolvedWebsiteSatisfied ? (
                <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <CircleAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <span className="font-semibold flex-1">
                {resolvedWebsiteSatisfied
                  ? '1. Website / App configured'
                  : '1. Choose Website (New or Existing) — required'}{' '}
                {!resolvedWebsiteSatisfied && (
                  <Link
                    href="#websites"
                    onClick={(e) => handleStepClick(e, 'websites')}
                    className="text-[#2563EB] font-bold hover:underline"
                  >
                    (Step 1)
                  </Link>
                )}
              </span>
              <Layout className="h-3.5 w-3.5 ml-auto text-slate-400 shrink-0" />
            </li>

            {/* Step 2: Domain Name (Mandatory) */}
            <li
              data-testid="requirement-domain"
              className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 border transition-colors ${
                resolvedDomainSatisfied
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                  : 'border-amber-200 bg-amber-50/70 text-amber-900'
              }`}
            >
              {resolvedDomainSatisfied ? (
                <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <CircleAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <span className="font-semibold flex-1">
                {resolvedDomainSatisfied
                  ? '2. Domain configured'
                  : '2. Choose Domain (Existing or New) — required'}{' '}
                {!resolvedDomainSatisfied && (
                  <Link
                    href="#domains"
                    onClick={(e) => handleStepClick(e, 'domains')}
                    className="text-[#2563EB] font-bold hover:underline"
                  >
                    (Step 2)
                  </Link>
                )}
              </span>
              <Globe className="h-3.5 w-3.5 ml-auto text-slate-400 shrink-0" />
            </li>

            {/* Step 3: Managed Hosting (Mandatory) */}
            <li
              data-testid="requirement-hosting"
              className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 border transition-colors ${
                hostingSatisfied
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                  : 'border-amber-200 bg-amber-50/70 text-amber-900'
              }`}
            >
              {hostingSatisfied ? (
                <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <CircleAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <span className="font-semibold flex-1">
                {hostingSatisfied
                  ? bundlePlanIncludesHosting
                    ? '3. Hosting included in your plan'
                    : '3. Hosting configured'
                  : '3. Add hosting — required'}{' '}
                {!hostingSatisfied && (
                  <Link
                    href="#hosting"
                    onClick={(e) => handleStepClick(e, 'hosting')}
                    className="text-[#2563EB] font-bold hover:underline"
                  >
                    (browse hosting)
                  </Link>
                )}
              </span>
              <Server className="h-3.5 w-3.5 ml-auto text-slate-400 shrink-0" />
            </li>

            {/* Step 4: Care Plan (Optional) */}
            <li
              data-testid="requirement-care"
              className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 border transition-colors ${
                resolvedCareSatisfied
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {resolvedCareSatisfied ? (
                <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <Wrench className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              )}
              <span className="font-semibold flex-1">
                {resolvedCareSatisfied
                  ? '4. Care plan chosen (Optional)'
                  : '4. Care plan — optional (Warranty included)'}{' '}
                {!resolvedCareSatisfied && (
                  <Link
                    href="#plans"
                    onClick={(e) => handleStepClick(e, 'plans')}
                    className="text-[#2563EB] font-bold hover:underline"
                  >
                    (add care)
                  </Link>
                )}
              </span>
            </li>
          </ul>
        </div>

        {/* Line items */}
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3">
            Start at Step 1 (Website/App), then pick your Domain (Step 2), Hosting (Step 3), and optional Care Plan (Step 4).
          </p>
        ) : (
          <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {sortedCatalogItems.map((item) => (
              <li key={item.key} className="text-xs border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-start gap-2">
                    {isWebsiteItem(item) ? (
                      <Layout className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                    ) : isDomainItem(item) ? (
                      <Globe className="h-3.5 w-3.5 text-teal-600 mt-0.5 shrink-0" />
                    ) : isHostingItem(item) ? (
                      <Server className="h-3.5 w-3.5 text-indigo-600 mt-0.5 shrink-0" />
                    ) : (
                      <Puzzle className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span>{groupName(item)}</span>
                        {isHostingItem(item) && item.cycle && item.cycle !== 'one-time' && (
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                            {item.cycle === 'year'
                              ? 'Billed annually'
                              : item.cycle === 'month'
                                ? 'Billed monthly'
                                : `Billed ${item.cycle}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 whitespace-nowrap">{money(item)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  {isAddOnItem(item) && item.cycle === 'one-time' ? (
                    <span className="inline-flex items-center rounded-lg border border-slate-300">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.name}`}
                        onClick={() => onQty(item.key, item.qty - 1)}
                        disabled={item.qty <= 1}
                        className="px-2 py-1 text-slate-600 hover:text-slate-900 disabled:opacity-40"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-2 font-bold text-slate-900" aria-live="polite">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.name}`}
                        onClick={() => onQty(item.key, item.qty + 1)}
                        disabled={item.qty >= 10}
                        className="px-2 py-1 text-slate-600 hover:text-slate-900 disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Selected</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => onRemove(item.key)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </li>
            ))}
            {planItem && (
              <li className="text-xs border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-start gap-2">
                    <Wrench className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{planItem.name}</p>
                      {(() => {
                        const cycleMeta =
                          BILLING_CYCLES_META.find(
                            (m) =>
                              m.enumValue === planItem.cycle ||
                              m.cycle === (planItem.cycle || '').toLowerCase()
                          ) ||
                          (planItem.cycle === 'ANNUAL' ? BILLING_CYCLES_META[3] : BILLING_CYCLES_META[0]);
                        return (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>Step 4 · Care Plan</span>
                            <span className="font-bold text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                              {cycleMeta.label}
                            </span>
                            {cycleMeta.discountPct > 0 && (
                              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                                Save {cycleMeta.discountPct}%
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 whitespace-nowrap">{money(planItem)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Optional Retainer</span>
                  <button
                    type="button"
                    aria-label={`Remove ${planItem.name}`}
                    onClick={() => onRemove(planItem.key)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </li>
            )}
          </ul>
        )}

        {/* Totals */}
        <div className="border-t border-slate-200 pt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-800">
            <span className="font-bold">Total in Cart</span>
            <span className="font-black text-sm text-slate-900">
              {anyKes ? 'KES ' : `${currency} `}
              {subtotal.toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Server confirms final totals at checkout — display prices follow the official commercial schedule.
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          data-testid="store-checkout-cta"
          disabled={!ready || items.length === 0}
          onClick={onCheckout}
          title={
            !ready
              ? 'Complete Mandatory Steps 1 (Website), 2 (Domain), and 3 (Hosting) to continue'
              : 'Continue to secure checkout'
          }
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          Continue to Secure Checkout <ArrowRight className="h-4 w-4" />
        </button>
        <div className="text-center">
          <Link href="/cart" className="text-[11px] font-semibold text-[#2563EB] hover:underline">
            View full cart &rarr;
          </Link>
        </div>
        {!ready && (
          <p className="text-[11px] rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 px-3 py-2 leading-relaxed">
            Mandatory order: <strong>1. Website/App</strong> (new build or existing website) &rarr;{' '}
            <strong>2. Domain</strong> (existing or new) &rarr; <strong>3. Hosting</strong>. Step 4 (Care Plan) is optional.
          </p>
        )}
      </div>
    </section>
  );
}
