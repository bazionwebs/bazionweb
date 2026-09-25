import { Loader2, AlertTriangle, Inbox } from 'lucide-react';

/** Skeleton table rows for loading states (matches .table-default styling). */
export function TableSkeletonRows({ rows = 4, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="animate-pulse">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="table-cell">
              <div className="h-4 rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Error card with retry for failed queries. */
export function QueryError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/60 p-6 text-center">
      <AlertTriangle className="w-6 h-6 text-[#EF4444] mx-auto mb-2" />
      <p className="text-sm font-semibold text-[#0F172A] mb-1">Couldn&apos;t load this data</p>
      <p className="text-xs text-slate-500 mb-4">{message ?? 'The server didn\u2019t respond. Check your connection and try again.'}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-bold px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

/** Empty state for lists with zero rows (never invent placeholder rows). */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
      <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
      <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

/** Full-section loading block. */
export function SectionLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 justify-center text-slate-400 text-sm">
      <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
      {label}
    </div>
  );
}
