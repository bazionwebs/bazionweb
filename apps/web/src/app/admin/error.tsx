'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw, LayoutDashboard, ShieldAlert } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin Section Error Boundary caught error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-1">
          Admin Workstation Error
        </h2>

        <p className="text-sm text-slate-500 mb-4">
          An error occurred in this administrative view. You can retry the operation or return to the main dashboard.
        </p>

        {error.message && (
          <div className="mb-6 rounded-lg bg-slate-50 p-3 text-left border border-slate-200 text-xs text-slate-700 font-mono break-all max-h-32 overflow-y-auto custom-scrollbar">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            Retry View
          </button>

          <Link
            href="/admin"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <LayoutDashboard className="h-4 w-4" />
            Admin Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
