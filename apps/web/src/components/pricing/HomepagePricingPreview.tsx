'use client';

import React from 'react';
import Link from 'next/link';
import { WEBSITE_PACKAGES } from '@/lib/pricingData';
import MarketToggle from '@/components/ui/MarketToggle';
import MarketSuggestBanner from '@/components/pricing/MarketSuggestBanner';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { Check, ArrowRight, ChevronRight } from 'lucide-react';

export default function HomepagePricingPreview() {
  const { market, setMarket, suggestKenya } = useMarketPreference();

  return (
    <div className="space-y-10">
      <MarketToggle currentMarket={market} onChange={setMarket} className="mb-4" />
      <MarketSuggestBanner
        visible={suggestKenya}
        onSelect={setMarket}
        onDismiss={() => setMarket(market)}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {WEBSITE_PACKAGES.slice(0, 3).map(pkg => {
          const price = market === 'kenya' ? pkg.kenyaPrice : pkg.intlPrice;
          return (
            <div
              key={pkg.id}
              className={`relative bg-white rounded-2xl border-2 pt-9 pb-7 px-6 sm:px-8 flex flex-col transition-all hover:shadow-xl ${
                pkg.popular
                  ? 'border-[#2563EB] shadow-[0_0_0_4px_rgba(37,99,235,0.08)]'
                  : 'border-slate-200/90'
              }`}
            >
              {pkg.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
                  <span className={`inline-block whitespace-nowrap text-[10px] font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider shadow-xs ${
                    pkg.popular ? 'bg-[#2563EB] text-white' : 'bg-[#0F172A] text-white'
                  }`}>
                    {pkg.badge}
                  </span>
                </div>
              )}

              <div className="mb-5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                  {pkg.name}
                </div>
                <div className="text-3xl font-black text-[#0F172A] mb-2 tracking-tight">
                  {price}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed min-h-[2.5rem]">
                  {pkg.description}
                </p>
              </div>

              {/* Primary Action Button (Positioned above pages line) */}
              <div className="mb-6">
                <Link
                  href={`/quote?package=${pkg.id}&market=${market}`}
                  className={pkg.popular ? 'btn-primary w-full justify-center text-xs py-2.5 shadow-sm' : 'btn-secondary w-full justify-center text-xs py-2.5'}
                >
                  {pkg.ctaText}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-1.5 mb-6 pb-6 border-b border-slate-100 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Pages</span>
                  <span className="font-semibold text-[#0F172A]">{pkg.pages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Turnaround</span>
                  <span className="font-semibold text-[#0F172A]">{pkg.timeline}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Defect Warranty</span>
                  <span className="font-semibold text-emerald-600">{pkg.support}</span>
                </div>
              </div>

              <ul className="space-y-2.5 flex-1">
                {pkg.deliverables.slice(0, 5).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href={`/pricing?market=${market}`}
          className="text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] inline-flex items-center gap-1"
        >
          View all packages (including E-Commerce, Custom Systems & Care Plans)
          <ChevronRight className="w-4 h-4" />
        </Link>
        <span className="hidden sm:inline text-slate-300">·</span>
        <Link
          href={`/quote?market=${market}`}
          className="text-sm font-semibold text-slate-600 hover:text-[#0F172A] inline-flex items-center gap-1"
        >
          Open Quote Calculator <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
