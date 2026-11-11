'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Layout Error Boundary caught error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen bg-[#0B132B] text-white flex items-center justify-center p-4 font-sans antialiased">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1C2541]/90 p-8 shadow-2xl backdrop-blur-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Application Error
          </h1>

          <p className="text-sm text-slate-300 mb-6">
            A critical system exception occurred in the application root. Please reload or attempt to recover the session.
          </p>

          {error.digest && (
            <div className="mb-6 rounded-lg bg-black/30 px-3 py-2 text-xs font-mono text-slate-400">
              Digest: {error.digest}
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
            >
              <RotateCcw className="h-4 w-4" />
              Reload application
            </button>
          </div>
        </div>
        </div>
      </body>
    </html>
  );
}
