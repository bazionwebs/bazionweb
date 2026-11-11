'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for client-side telemetry
    console.error('Root App Error Boundary caught error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B132B] px-4 py-16 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1C2541]/90 p-8 shadow-2xl backdrop-blur-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Something went wrong
        </h1>

        <p className="text-sm text-slate-300 mb-6">
          We encountered an unexpected error while rendering this page. Our engineering team has been alerted.
        </p>

        {error.digest && (
          <div className="mb-6 rounded-lg bg-black/30 px-3 py-2 text-xs font-mono text-slate-400">
            Error Reference: {error.digest}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            <Home className="h-4 w-4" />
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
