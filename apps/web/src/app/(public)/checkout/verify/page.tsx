'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ShieldCheck, Download, Smartphone, CreditCard, Mail, Tag, Lock } from 'lucide-react';
import Logo from '@/components/ui/Logo';

function VerifyPaymentContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<{
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    planSlug?: string;
    customerEmail?: string;
    paidAt?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function verify() {
      if (!reference) {
        setLoading(false);
        setErrorMsg('No payment transaction reference provided.');
        return;
      }

      try {
        const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`);
        const json = await res.json();

        if (json.success) {
          setSuccess(true);
          // NOTE: no client-side entitlement here. Access is granted by the
          // webhook → API activation; this page only confirms the payment
          // and points the customer at the one-step account claim.
          setData({
            ...json,
            planSlug: json.metadata?.planSlug || json.planSlug,
            customerEmail: json.customer?.email || json.customerEmail,
          });
        } else {
          setErrorMsg(json.message || 'Payment verification could not be confirmed.');
        }
      } catch {
        setErrorMsg('Network error communicating with payment verification service.');
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [reference]);

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
              One last step: set a password below to unlock your dashboard.
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

            {data?.planSlug && (
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Plan Activated
                </span>
                <span className="font-semibold text-slate-700 capitalize">
                  {data.planSlug.charAt(0).toUpperCase() + data.planSlug.slice(1)} Plan
                </span>
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
            <Link
              href={`/portal/claim?ref=${encodeURIComponent(reference || '')}&email=${encodeURIComponent(data?.customerEmail || '')}`}
              className="btn-primary w-full py-3.5 justify-center text-xs font-bold shadow-lg shadow-blue-600/20"
            >
              <Lock className="w-4 h-4" />
              Create Your Password & Enter Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/portal/login"
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              Already have an account? Sign in
            </Link>

            <button
              onClick={() => window.open(`/api/paystack/verify?reference=${encodeURIComponent(reference || '')}&format=receipt`, '_blank')}
              className="w-full py-2 rounded-lg text-slate-500 hover:text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Download Payment Receipt (PDF)
            </button>
          </div>
        </div>
      )}

      {!loading && !success && (
        <div className="text-center py-6 space-y-5">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Payment Unverified</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {errorMsg || 'We could not automatically confirm your transaction. If funds were deducted, please contact engineering support with your reference.'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl font-mono text-xs text-slate-600">
            Ref: {reference || 'N/A'}
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href="/checkout"
              className="btn-primary flex-1 justify-center text-xs py-2.5"
            >
              Return to Checkout
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
