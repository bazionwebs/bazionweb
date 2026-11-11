import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import SubscriptionCheckout from '@/components/billing/SubscriptionCheckout';
import ClientJourneyProgress from '@/components/navigation/ClientJourneyProgress';
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Secure Checkout',
  description: 'Complete your subscription for BazionWeb managed website lifecycle, hosting, and enterprise maintenance.',
  robots: { index: false, follow: true },
};

type CheckoutSearchParams = { plan?: string; cycle?: string; cart?: string };

async function CheckoutContent({ searchParams }: { searchParams: Promise<CheckoutSearchParams> }) {
  const params = await searchParams;
  const cartMode = params.cart === '1';
  const plan = params.plan || (cartMode ? 'none' : 'growth');
  const cycle = params.cycle?.toUpperCase() === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';

  return (
    <SubscriptionCheckout
      initialPlanSlug={plan}
      initialCycle={cycle}
      cartMode={cartMode}
    />
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<CheckoutSearchParams>;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Compact Hero Header */}
      <section className="bg-[#0F172A] pt-28 pb-8 text-white border-b border-slate-800">
        <div className="container-default max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Pricing &amp; Stack Builder</span>
            </Link>
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-300 font-semibold bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>256-Bit Encrypted Checkout</span>
            </div>
          </div>

          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6]">
              Order Review &amp; Settlement
            </span>
            <h1 className="text-2xl md:text-4xl font-extrabold text-white mt-1">
              Complete Your Order
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5">
              Review your selected stack on the left and complete payment via M-Pesa, card, or corporate wire on the right.
            </p>
          </div>
        </div>
      </section>

      {/* High-Contrast Step-by-Step Journey Bar Positioned Below Hero Banner */}
      <section
        aria-label="Client journey steps bar"
        className="bg-[#1E293B] border-b border-slate-700/80 py-4 px-4 shadow-xs"
      >
        <div className="container-default max-w-6xl mx-auto">
          <Suspense fallback={null}>
            <ClientJourneyProgress variant="dark" />
          </Suspense>
        </div>
      </section>

      {/* Main Clean Light Checkout Workspace */}
      <div className="container-default max-w-6xl mx-auto px-4 py-8 sm:py-10 pb-24">
        <Suspense
          fallback={
            <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-3 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
              <span className="text-xs font-medium">Initializing secure checkout session...</span>
            </div>
          }
        >
          <CheckoutContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
