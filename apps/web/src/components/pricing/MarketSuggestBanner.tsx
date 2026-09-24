'use client';

import { X } from 'lucide-react';
import type { Market } from '@/lib/pricingData';

type Props = {
  visible: boolean;
  onSelect: (market: Market) => void;
  onDismiss: () => void;
};

/**
 * Non-blocking market suggestion (the Google-recommended alternative to
 * geo-IP auto-redirects). Fixed banner, dismissible, same URL throughout.
 */
export default function MarketSuggestBanner({ visible, onSelect, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Market suggestion"
      className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-6 sm:max-w-sm z-40 rounded-2xl border border-slate-200 bg-white shadow-card-xl p-4"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl" role="img" aria-hidden>
          🇰🇪
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#0F172A]">Browsing from East Africa?</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Showing Kenya pricing with M-Pesa. Switch anytime — your choice is remembered.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => onSelect('kenya')}
              className="text-xs font-bold px-3 py-2 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors"
            >
              Keep Kenya pricing
            </button>
            <button
              type="button"
              onClick={() => onSelect('international')}
              className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              International (USD)
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss market suggestion"
          className="p-1 rounded-lg text-slate-400 hover:text-[#0F172A] hover:bg-slate-100 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
