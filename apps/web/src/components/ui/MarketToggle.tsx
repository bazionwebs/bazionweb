'use client';

import React from 'react';
import { Market } from '@/lib/pricingData';

interface MarketToggleProps {
  currentMarket: Market;
  onChange: (market: Market) => void;
  className?: string;
}

export default function MarketToggle({
  currentMarket,
  onChange,
  className = '',
}: MarketToggleProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <span>Select Your Commercial Market:</span>
      </div>

      <div
        role="group"
        aria-label="Market selection"
        className="inline-flex flex-col xs:flex-row p-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-inner w-full sm:w-auto gap-1 xs:gap-0"
      >
        <button
          type="button"
          onClick={() => onChange('kenya')}
          className={`flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
            currentMarket === 'kenya'
              ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/20'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
          aria-pressed={currentMarket === 'kenya'}
        >
          <span className="text-base" role="img" aria-label="Kenya flag">🇰🇪</span>
          <span>Kenya (KES)</span>
          <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
            currentMarket === 'kenya' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
          }`}>
            Local Rails
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange('international')}
          className={`flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
            currentMarket === 'international'
              ? 'bg-[#14B8A6] text-white shadow-lg shadow-teal-500/30 ring-1 ring-white/20'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
          aria-pressed={currentMarket === 'international'}
        >
          <span className="text-base" role="img" aria-label="World globe">🌍</span>
          <span>International (USD)</span>
          <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
            currentMarket === 'international' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
          }`}>
            Global Dev
          </span>
        </button>
      </div>

      <p className="text-xs text-slate-400 max-w-md text-center mt-1">
        {currentMarket === 'kenya'
          ? 'Kenya SME & institutional pricing with direct M-Pesa STK push & EAT support.'
          : 'International commercial pricing with structured discovery, formal QA, documentation & USD billing.'}
      </p>
    </div>
  );
}
