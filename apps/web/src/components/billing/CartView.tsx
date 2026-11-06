'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, Wrench, Server, Puzzle, Info } from 'lucide-react';
import { useCartStore, type CartItem } from '@/lib/cart';
import { getProductPrice } from '@/lib/priceBooks';
import { usePlans } from '@/lib/plans';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import ClientJourneyProgress from '@/components/navigation/ClientJourneyProgress';

const kindIcon = (item: CartItem) =>
  item.kind === 'PLAN' ? Wrench : item.cycle === 'one-time' ? Puzzle : Server;

const cycleLabel = (cycle: string) =>
  cycle === 'MONTHLY' ? 'per month' : cycle === 'ANNUAL' ? 'per year' : cycle === 'one-time' ? 'one-time' : cycle;

export default function CartView() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const add = useCartStore((s) => s.add);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);

  const { plans } = usePlans();
  const { marketCode } = useMarketPreference();

  const plan = items.find((i) => i.kind === 'PLAN');
  const extras = items.filter((i) => i.kind !== 'PLAN');

  const isKes = marketCode
    ? marketCode === 'KE'
    : (extras[0]?.currency ?? plan?.currency ?? 'USD') === 'KES';
  const activeCurrency = isKes ? 'KES' : 'USD';

  const resolveItemTotal = (item: CartItem) => {
    if ((item.currency || '').toUpperCase() === activeCurrency) {
      return item.unitPrice * item.qty;
    }
    if (item.kind === 'PLAN') {
      const matched = plans.find((p) => p.slug === item.id);
      if (matched) {
        const isAnnual = item.cycle === 'ANNUAL';
        const price = isKes
          ? (isAnnual ? matched.priceAnnualKes : matched.priceMonthlyKes)
          : (isAnnual ? matched.priceAnnual : matched.priceMonthly);
        if (price > 0) return price * item.qty;
      }
    } else {
      const bookItem = getProductPrice(item.id, isKes ? 'KE' : 'GLOBAL');
      if (bookItem && bookItem.amount > 0) {
        return bookItem.amount * item.qty;
      }
    }
    return isKes
      ? Math.round(item.unitPrice * item.qty * 129.5)
      : Math.round((item.unitPrice * item.qty) / 129.5);
  };

  const total = items.reduce((sum, item) => sum + resolveItemTotal(item), 0);

  const handleAddEssentialPlan = () => {
    const target = plans.find((p) => p.slug === 'care-essential' || p.slug === 'starter');
    const price = target ? (isKes ? target.priceMonthlyKes : target.priceMonthly) : (isKes ? 5000 : 75);
    add({
      kind: 'PLAN',
      id: target?.slug ?? 'care-essential',
      name: target?.name ?? 'Care Essential',
      cycle: 'MONTHLY',
      qty: 1,
      unitPrice: price,
      currency: isKes ? 'KES' : 'USD',
    });
  };

  if (items.length === 0) {
    return (
      <main className="bg-white min-h-[60vh]">
        <section className="bg-[#0F172A] pt-32 pb-16 text-white">
          <div className="container-default max-w-7xl mx-auto px-4">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
              <ShoppingCart className="h-4 w-4" /> Shopping Cart
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight">Your cart is empty</h1>
          </div>
        </section>
        <div className="container-default max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-slate-600 mb-6">
            Browse the store to add a care plan, hosting, or add-ons — then check out once.
          </p>
          <Link
            href="/store"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
          >
            Browse the store <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-white">
      <section className="bg-[#0F172A] pt-32 pb-14 text-white">
        <div className="container-default max-w-7xl mx-auto px-4">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            <ShoppingCart className="h-4 w-4" /> Shopping Cart
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight">Review your order</h1>
        </div>
      </section>

      <section className="bg-[#0B1120] border-b border-slate-800 py-5">
        <div className="container-default max-w-7xl mx-auto px-4">
          <Suspense fallback={null}>
            <ClientJourneyProgress variant="dark" />
          </Suspense>
        </div>
      </section>

      <div className="container-default max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Line items */}
          <div className="flex-1 min-w-0">
            <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
              {items.map((item) => {
                const Icon = kindIcon(item);
                return (
                  <li key={item.key} className="flex items-start gap-4 p-5">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.kind === 'PLAN' ? 'Managed care plan' : item.cycle === 'one-time' ? 'Add-on' : 'Hosting'} ·{' '}
                            {cycleLabel(item.cycle)}
                          </p>
                        </div>
                        <p className="font-extrabold text-slate-900 whitespace-nowrap">
                          {activeCurrency} {resolveItemTotal(item).toLocaleString()}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        {item.kind !== 'PLAN' && item.cycle === 'one-time' ? (
                          <div className="inline-flex items-center rounded-lg border border-slate-300">
                            <button
                              type="button"
                              aria-label={`Decrease quantity of ${item.name}`}
                              onClick={() => setQty(item.key, item.qty - 1)}
                              className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40"
                              disabled={item.qty <= 1}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="px-2 text-sm font-bold text-slate-900" aria-live="polite">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase quantity of ${item.name}`}
                              onClick={() => setQty(item.key, item.qty + 1)}
                              className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40"
                              disabled={item.qty >= 10}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Qty 1</span>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(item.key)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex items-center justify-between">
              <Link href="/store" className="text-sm font-semibold text-[#2563EB] hover:text-blue-700">
                &larr; Continue shopping
              </Link>
              <button
                type="button"
                onClick={clear}
                className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
              >
                Clear cart
              </button>
            </div>

            {!plan && (
              <div className="mt-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-[#2563EB]">
                      <Wrench className="h-3.5 w-3.5" /> Care Plan Required
                    </span>
                    <h3 className="mt-2 text-base font-bold text-slate-950">
                      Pair your hosting with managed care
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 max-w-xl">
                      BazionWeb provides managed infrastructure backed by routine security updates, daily backups, and technical support.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEssentialPlan}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm"
                  >
                    <Plus className="h-4 w-4" /> Add Care Essential ({isKes ? 'KES 5,000' : '$75'}/mo)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <aside className="lg:w-80 shrink-0">
            <div className="lg:sticky lg:top-28 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">Order summary</h2>
              <dl className="space-y-2 text-sm">
                {plan && (
                  <div className="flex justify-between">
                    <dt className="text-slate-600">{plan.name}</dt>
                    <dd className="font-semibold text-slate-900">
                      {activeCurrency} {resolveItemTotal(plan).toLocaleString()}
                    </dd>
                  </div>
                )}
                {extras.map((e) => (
                  <div key={e.key} className="flex justify-between">
                    <dt className="text-slate-600">
                      {e.name}
                      {e.qty > 1 ? ` x${e.qty}` : ''}
                    </dt>
                    <dd className="font-semibold text-slate-900">
                      {activeCurrency} {resolveItemTotal(e).toLocaleString()}
                    </dd>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between text-base">
                  <dt className="font-bold text-slate-900">Total due today</dt>
                  <dd className="font-extrabold text-slate-900">
                    {activeCurrency} {total.toLocaleString()}
                  </dd>
                </div>
              </dl>

              {!plan && (
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3.5 space-y-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900">
                        Care plan required for checkout
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Hosting & add-ons are managed alongside an active website care plan.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEssentialPlan}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900 shadow-sm hover:bg-amber-100/70 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-amber-700" />
                    Add Care Essential ({isKes ? 'KES 5,000' : '$75'}/mo)
                  </button>
                  <div className="text-center">
                    <Link
                      href="/store#plans"
                      className="text-[11px] font-semibold text-[#2563EB] hover:underline"
                    >
                      Compare all care plans &rarr;
                    </Link>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!plan}
                onClick={() => router.push(`/checkout?plan=${plan!.id}&cycle=${plan!.cycle}&cart=1`)}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Proceed to checkout <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Final totals are confirmed server-side at checkout. Prices include VAT where applicable.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
