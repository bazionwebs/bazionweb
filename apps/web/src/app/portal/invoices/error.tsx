'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileWarning,
  RotateCcw,
  LifeBuoy,
  LayoutDashboard,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';

interface InvoicesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function InvoicesError({ error, reset }: InvoicesErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('[Portal Invoices Error Boundary Caught Exception]:', {
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
    <div className="py-8 px-4 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 md:p-10">
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
            <FileWarning className="w-6 h-6" />
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/80">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Ledger Records Intact</span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 mb-3">
          Billing Workspace Notice
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          Unable to display your invoices
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          We encountered an unexpected problem retrieving or formatting your invoice and subscription statements.
          Your official billing records, payment history, and Cloud Care subscriptions remain securely stored.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-6 border-b border-slate-100">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload Invoices</span>
          </button>

          <Link
            href="/portal/support"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-sm border border-slate-200 transition-all active:scale-[0.98]"
          >
            <LifeBuoy className="w-4 h-4 text-[#2563EB]" />
            <span>Contact Support</span>
          </Link>

          <Link
            href="/portal"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Mission Control</span>
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-4 text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              If this persists, open a ticket via{' '}
              <Link href="/portal/support" className="text-[#2563EB] font-medium hover:underline">
                Portal Support
              </Link>{' '}
              or email{' '}
              <a href="mailto:billing@bazionweb.com" className="text-[#2563EB] font-medium hover:underline">
                billing@bazionweb.com
              </a>.
            </span>

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium transition-colors"
            >
              <span>{showDetails ? 'Hide technical trace' : 'View technical trace'}</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showDetails && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-left font-mono">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 text-[11px] text-slate-600">
                <span>Error Diagnostics</span>
                <button
                  type="button"
                  onClick={copyDiagnostics}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-rose-600 break-words mb-1">
                {error?.message || 'Unknown runtime error'}
              </div>
              {error?.digest && (
                <div className="text-slate-500 text-[10px]">
                  Digest Code: {error.digest}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

