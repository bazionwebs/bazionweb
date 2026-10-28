'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ShieldCheck, Download, Smartphone, CreditCard, Mail, Tag, Lock, LayoutDashboard } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';

function VerifyPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  // Session-aware success: a payer who already signed in (e.g. arrived from
  // /portal/onboarding) should land back in their dashboard, not the guest
  // claim flow. Guests keep the claim-link path.
  const storeHydrated = useAuthStore(s => s._hasHydrated);
  const hasHydrated = storeHydrated || (typeof window !== 'undefined' && !!useAuthStore.persist?.hasHydrated?.());
  const sessionUser = useAuthStore(s => s.user);
  const setSubscriptionStatus = useAuthStore(s => s.setSubscriptionStatus);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (hasHydrated) setHasSession(Boolean(sessionUser));
  }, [hasHydrated, sessionUser]);
  const verification = useQuery({
    queryKey: ['checkout-verification', reference],
    enabled: Boolean(reference),
    queryFn: async () => {
      const response = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference!)}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Payment verification is temporarily unavailable.');
      return body as {
        success: boolean;
        status: string;
        amount?: number;
        currency?: string;
        channel?: string;
        description?: string;
        customerEmail?: string;
        invoiceNumber?: string;
        message?: string;
      };
    },
    refetchInterval: (query) => {
      const status = String(query.state.data?.status || '').toUpperCase();
      const terminal = ['SUCCESS', 'ALREADY_PROCESSED', 'FAILED', 'AMOUNT_MISMATCH', 'ORPHAN_TRANSACTION_RECORDED'];
      if (query.state.data?.success || terminal.includes(status) || query.state.dataUpdateCount >= 12 || query.state.fetchFailureCount >= 4) return false;
      return 5000;
    },
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const loading = Boolean(reference) && verification.isPending;
  const data = verification.data;
  const success = data?.success === true;
  const status = String(data?.status || (verification.isError ? 'UNAVAILABLE' : 'PENDING')).toUpperCase();
  const errorMsg = verification.error instanceof Error
    ? verification.error.message
    : data?.message || 'Payment status is still being confirmed.';
  const isProcessing = Boolean(reference) && ['PENDING', 'PROCESSING', 'UNVERIFIED', 'UNAVAILABLE'].includes(status);

  return (
    <div className="w-full max-w-xl bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 text-slate-900">
      {loading && (
        <div className="text-center py-12 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#2563EB] mx-auto" />
          <h2 className="text-xl font-bold text-[#0F172A]">Verifying Your Payment…</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Communicating with Paystack to confirm M-Pesa or Card settlement.
          </p>
        </div>
      )}

      {!loading && success && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50/50">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Payment Confirmed
            </span>
            <h1 className="text-2xl font-extrabold text-[#0F172A]">Payment Confirmed!</h1>
            <p className="text-xs text-slate-500 mt-1">
              {hasSession
                ? 'Your subscription is active. Your dashboard is ready — jump straight back in.'
                : 'One last step: verify your billing email with a one-time link, then set a password to unlock your dashboard.'}
            </p>
          </div>

          {/* Payment receipt card */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">Transaction Reference</span>
              <span className="font-mono font-bold text-slate-800">{reference}</span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">Payment Channel</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                {data?.channel === 'mobile_money' ? (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    M-Pesa STK Push
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    Credit / Debit Card
                  </>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">Amount Settled</span>
              <span className="font-bold text-emerald-600 text-sm">
                {data?.currency || 'KES'} {(data?.amount ?? 0).toLocaleString()}
              </span>
            </div>

            {data?.description && (
              <div className="flex justify-between items-center gap-3 pb-2 border-b border-slate-200">
                <span className="text-slate-500 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Service
                </span>
                <span className="text-right font-semibold text-slate-700">{data.description}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-slate-500 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Receipt Sent To
              </span>
              <span className="font-semibold text-slate-700 truncate max-w-[180px]">
                {data?.customerEmail || 'billing on file'}
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-3 pt-2">
            {hasSession ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    // The webhook has settled — sync the local entitlement
                    // cache so the portal guard lets the client straight in.
                    setSubscriptionStatus('ACTIVE');
                    router.push('/portal');
                  }}
                  className="btn-primary w-full py-3.5 justify-center text-xs font-bold shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Enter Your Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  Signed in as <span className="font-semibold text-slate-600">{sessionUser?.email}</span>. Your plan is now active.
                </p>
              </>
            ) : (
              <>
                <Link
                  href={`/portal/claim?email=${encodeURIComponent(data?.customerEmail || '')}`}
                  className="btn-primary w-full py-3.5 justify-center text-xs font-bold shadow-lg shadow-blue-600/20"
                >
                  <Lock className="w-4 h-4" />
                  Email Me a Claim Link
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  We send the link to the billing address above. If your webhook is still settling,
                  wait a minute and request it again.
                </p>

                <Link
                  href="/portal/login"
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  Already have an account? Sign in
                </Link>
              </>
            )}

            <button
              onClick={() => window.open(`/api/paystack/verify?reference=${encodeURIComponent(reference || '')}&format=receipt`, '_blank', 'noopener,noreferrer')}
              className="w-full py-2 rounded-lg text-slate-500 hover:text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              View / print payment receipt
            </button>
          </div>
        </div>
      )}

      {!loading && !success && (
        <div className="text-center py-6 space-y-5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${isProcessing ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              {!reference ? 'Payment reference missing' : isProcessing ? 'Payment is still processing' : 'Payment could not be confirmed'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {!reference
                ? 'Return to the checkout you started or contact support with your payment receipt.'
                : `${errorMsg} Do not make another payment while this reference is being checked.`}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl font-mono text-xs text-slate-600 break-all">
            Ref: {reference || 'N/A'}
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {reference && isProcessing && (
              <button
                type="button"
                onClick={() => void verification.refetch()}
                disabled={verification.isFetching}
                className="btn-primary flex-1 justify-center text-xs py-2.5 disabled:opacity-50"
              >
                {verification.isFetching ? 'Checking…' : 'Check payment status'}
              </button>
            )}
            <Link href="/pricing" className="btn-secondary flex-1 justify-center text-xs py-2.5">
              Back to plans
            </Link>
            <Link
              href="/contact"
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 inline-flex items-center justify-center"
            >
              Contact Support
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutVerifyPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-6">
          <Logo variant="dark" markClassName="h-16 w-auto" />
        </div>

        <Suspense
          fallback={
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#2563EB] mb-2" />
              <span className="text-xs">Loading verification status…</span>
            </div>
          }
        >
          <VerifyPaymentContent />
        </Suspense>
      </div>
    </div>
  );
}
