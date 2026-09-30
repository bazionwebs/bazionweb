'use client';

import React from 'react';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { ChevronDown } from 'lucide-react';

interface MarketSelectorTriggerProps {
  variant?: 'navbar' | 'footer' | 'pill' | 'compact';
  className?: string;
}

export default function MarketSelectorTrigger({
  variant = 'navbar',
  className = '',
}: MarketSelectorTriggerProps) {
  const { marketDef, openModal } = useMarketPreference();

  if (variant === 'footer') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-slate-400">Market:</span>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all group"
          title="Change commercial market"
        >
          <span className="text-sm">{marketDef.flag}</span>
          <span>{marketDef.shortName} ({marketDef.currency})</span>
          <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-white transition-transform" />
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={openModal}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors ${className}`}
        title="Commercial market"
      >
        <span>{marketDef.flag}</span>
        <span>{marketDef.currency}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>
    );
  }

  // Default navbar variant: Clean, premium pill with Flag and Currency label
  return (
    <button
      type="button"
      onClick={openModal}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200/90 hover:border-teal-500/40 bg-slate-50/80 hover:bg-teal-50/50 text-slate-700 transition-all shadow-xs group ${className}`}
      title={`Market: ${marketDef.name} (${marketDef.currency}). Click to change.`}
      aria-label={`Market: ${marketDef.name}`}
    >
      <span className="text-sm" role="img" aria-label={marketDef.name}>
        {marketDef.flag}
      </span>
      <span className="font-semibold text-slate-700 group-hover:text-[#0D9488] transition-colors">
        {marketDef.shortName}
      </span>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
        {marketDef.currency}
      </span>
      <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-[#0D9488] transition-transform duration-200" />
    </button>
  );
}
