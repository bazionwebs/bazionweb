'use client';

import React from 'react';
import { useMarketPreference } from '@/hooks/useMarketPreference';

interface MarketSelectorTriggerProps {
  variant?: 'navbar' | 'footer' | 'pill' | 'compact';
  className?: string;
}

/**
 * Read-Only Static Regional Market Status Badge
 * Replaces interactive market switcher trigger. Strictly informational.
 */
export default function MarketSelectorTrigger({
  variant = 'navbar',
  className = '',
}: MarketSelectorTriggerProps) {
  const { marketDef } = useMarketPreference();

  if (variant === 'footer') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-slate-400">Region:</span>
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 cursor-default select-none"
          title={`Auto-detected region: ${marketDef.name} (${marketDef.currency})`}
        >
          <span className="text-sm">{marketDef.flag}</span>
          <span>{marketDef.shortName} ({marketDef.currency})</span>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 cursor-default select-none border border-slate-200/60 ${className}`}
        title={`Auto-detected region: ${marketDef.name} (${marketDef.currency})`}
      >
        <span>{marketDef.flag}</span>
        <span>{marketDef.currency}</span>
      </div>
    );
  }

  // Default navbar variant: Clean, read-only pill
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200/90 bg-slate-50/80 text-slate-700 cursor-default select-none shadow-xs ${className}`}
      title={`Auto-detected region: ${marketDef.name} (${marketDef.currency})`}
      aria-label={`Auto-detected regional market: ${marketDef.name}`}
    >
      <span className="text-sm" role="img" aria-label={marketDef.name}>
        {marketDef.flag}
      </span>
      <span className="font-semibold text-slate-700">
        {marketDef.shortName}
      </span>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
        {marketDef.currency}
      </span>
    </div>
  );
}
