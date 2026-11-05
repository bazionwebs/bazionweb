'use client';

import React from 'react';
import Link from 'next/link';
import { Check, CircleAlert, Minus, Plus, ShoppingCart, Trash2, ArrowRight, Wrench, Server, Puzzle } from 'lucide-react';
import type { CartItem } from '@/lib/cart';

export interface StoreOrderSummaryProps {
  items: CartItem[];
  careSatisfied: boolean;
  hostingSatisfied: boolean;
  bundlePlanIncludesHosting: boolean;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
}

const money = (item: CartItem) =>
  `${item.currency === 'KES' ? 'KES ' : item.currency + ' '}${(item.unitPrice * item.qty).toLocaleString()}`;

const groupName = (item: CartItem) =>
  item.kind === 'PLAN' ? 'Managed care plan' : item.id.startsWith('host-') ? 'Hosting' : 'Add-on';

export default function StoreOrderSummary({
  items,
  careSatisfied,
  hostingSatisfied,
  bundlePlanIncludesHosting,
  onQty,
  onRemove,
  onCheckout,
}: StoreOrderSummaryProps) {
  const planItem = items.find((i) => i.kind === 'PLAN');
  const catalogItems = items.filter((i) => i.kind === 'CATALOG');
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const currency = planItem?.currency || catalogItems[0]?.currency || 'KES';
  const anyKes = currency === 'KES';
  const ready = careSatisfied && hostingSatisfied;

  const HostIcon = Server;

  return (
    <section
      data-testid="store-order-summary"
      aria-label="Shopping cart summary"
      className="rounded-3xl border border-slate-200 bg-white shadow-md overflow-hidden"
    >
      <div className="bg-[#0F172A] px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#14B8A6]">
            <ShoppingCart className="h-4 w-4" /> Your Stack
          </span>
          <span className="text-[11px] font-semibold rounded-full bg-white/10 px-2 py-0.5 border border-white/10">
            {items.reduce((n, i) => n + i.qty, 0)} item{items.reduce((n, i) => n + i.qty, 0) === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Mandatory-stack checklist */}
        <ul className="space-y-2">
          <li
            data-testid="requirement-care"
            className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 border ${
              careSatisfied
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                : 'border-amber-200 bg-amber-50/70 text-amber-900'
            }`}
          >
            {careSatisfied ? (
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <CircleAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            )}
            <span className="font-semibold">
              {careSatisfied ? 'Care plan chosen' : 'Choose a care plan — required'}{' '}
              {!careSatisfied && (
                <Link href="/store#plans" className="text-[#2563EB] font-bold hover:underline">
                  (browse plans)
                </Link>
              )}
            </span>
            <Wrench className="h-3.5 w-3.5 ml-auto text-slate-400 shrink-0" />
          </li>
          <li
            data-testid="requirement-hosting"
            className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 border ${
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
            <span className="font-semibold">
              {hostingSatisfied
                ? bundlePlanIncludesHosting
                  ? 'Hosting included in your plan'
                  : 'Hosting configured'
                : 'Add hosting — required'}
              {!hostingSatisfied && (
                <Link href="/store#hosting" className="text-[#2563EB] font-bold hover:underline">
                  (browse hosting)
                </Link>
              )}
            </span>
            <HostIcon className="h-3.5 w-3.5 ml-auto text-slate-400 shrink-0" />
          </li>
        </ul>

        {/* Line items */}
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3">
            Nothing in cart yet — pick a care plan, hosting, and extras.
          </p>
        ) : (
          <ul className="space-y-3">
            {planItem && (
              <li className="text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{planItem.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Subscription anchor · {planItem.cycle === 'ANNUAL' ? 'billed yearly' : 'billed monthly'}
                    </p>
                  </div>
                  <span className="font-bold text-slate-900 whitespace-nowrap">{money(planItem)}</span>
                </div>
              </li>
            )}
            {catalogItems.map((item) => (
              <li key={item.key} className="text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-start gap-2">
                    {item.id.startsWith('host-') ? (
                      <HostIcon className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    ) : (
                      <Puzzle className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-500">{groupName(item)}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 whitespace-nowrap">{money(item)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  {item.cycle === 'one-time' ? (
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
                    <span className="text-[11px] text-slate-400">Qty 1</span>
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
          </ul>
        )}

        {/* Totals */}
        <div className="border-t border-slate-200 pt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span className="font-semibold">Subtotal (incl. VAT where applicable)</span>
            <span className="font-semibold">
              {anyKes ? 'KES ' : `${currency} `}
              {subtotal.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Recurring plan core · first invoice</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Server confirms final totals at checkout — display prices never replace the commercial schedule.
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          data-testid="store-checkout-cta"
          disabled={!ready || items.length === 0}
          onClick={onCheckout}
          title={!ready ? 'Add a care plan and hosting to continue' : 'Continue to secure checkout'}
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
            Every client stack needs at least a care plan and hosting — pick the zero-care baseline (Starter) or any
            paid tier, plus a managed hosting option.
          </p>
        )}
      </div>
    </section>
  );
}
