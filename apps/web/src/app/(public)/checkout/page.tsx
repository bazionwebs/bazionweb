import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import SubscriptionCheckout from '@/components/billing/SubscriptionCheckout';
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Secure Checkout | BazionWeb',
  description: 'Complete your subscription for BazionWeb managed website lifecycle, hosting, and enterprise maintenance.',
  robots: { index: false, follow: true },
};

function CheckoutContent({ searchParams }: { searchParams: { plan?: string; cycle?: string } }) {
  const plan = searchParams.plan || 'growth';
  const cycle = searchParams.cycle === 'annual' ? 'ANNUAL' : 'MONTHLY';

  return (
    <SubscriptionCheckout 
      initialPlanSlug={plan}
      initialCycle={cycle}
    />
  );
}

export default function CheckoutPage({
  searchParams,
}: {
  searchParams: { plan?: string; cycle?: string };
}) {
  return (
    <div className="min-h-screen bg-[#0A0F1D] pt-32 pb-24 text-slate-100">
      <div className="container-default max-w-6xl mx-auto px-4">
        {/* Navigation Breadcrumb */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Plans & Comparison</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-800/40">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Authorized Payment Rails</span>
          </div>
        </div>

        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6]">Billing & Activation</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mt-1">Complete Your Subscription</h1>
          <p className="text-sm text-slate-400 mt-2">
            Choose your preferred payment method. Mobile-money instant activation or international card billing via Paystack.
          </p>
        </div>

        {/* Dynamic Checkout Component */}
        <Suspense fallback={
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
            <span className="text-xs">Initializing secure checkout session...</span>
          </div>
        }>
          <CheckoutContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
