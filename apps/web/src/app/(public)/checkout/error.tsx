'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  ShieldCheck,
  ShoppingBag,
  LifeBuoy,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';

interface CheckoutErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CheckoutError({ error, reset }: CheckoutErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('[Checkout Error Boundary Caught Exception]:', {
      message: error?.message,
      digest: error?.digest,
      stack: error?.stack,
    });
  }, [error]);

  const copyDiagnostics = () => {
    const diagnostics = `Error: ${error?.message || 'Unknown error'}\nDigest: ${error?.digest || 'N/A'}\nTimestamp: ${new Date().toISOString()}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(diagnostics);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-[75vh] bg-[#0A0F1D] pt-28 pb-20 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full mx-auto">
        <div className="mb-6 flex items-center justify-between text-xs text-slate-400">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Plans</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/50">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>No Charges Processed</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0F172A]/90 p-8 md:p-10 shadow-2xl backdrop-blur">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6 mx-auto sm:mx-0">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
            Payment Session Interrupted
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-3">
            We couldn&apos;t load the checkout session
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            An unexpected error occurred while initializing your subscription checkout.
            Your payment details and cart selections have not been charged.
            You can safely retry this session or return to our pricing plans.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-6 border-b border-slate-800">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm transition-all shadow-lg shadow-blue-900/30 active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Checkout</span>
            </button>

            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Choose Another Plan</span>
            </Link>

            <Link
              href="/cart"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>View Cart</span>
            </Link>
          </div>

          <div className="mt-6 flex flex-col gap-4 text-xs text-slate-400">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <LifeBuoy className="w-4 h-4 text-[#14B8A6]" />
                <span>
                  Need assistance? Reach our engineering desk at{' '}
                  <a href="mailto:billing@bazionweb.com" className="text-[#14B8A6] underline hover:text-teal-300">
                    billing@bazionweb.com
                  </a>
                </span>
              </span>

              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span>{showDetails ? 'Hide error details' : 'Show error details'}</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showDetails && (
              <div className="rounded-xl bg-[#030712] border border-slate-800/80 p-4 text-left font-mono">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-500">
                  <span>Diagnostic Trace</span>
                  <button
                    type="button"
                    onClick={copyDiagnostics}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-rose-400 break-words mb-1">
                  {error?.message || 'Unknown runtime exception'}
                </div>
                {error?.digest && (
                  <div className="text-slate-500 text-[10px]">
                    Digest ID: {error.digest}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

