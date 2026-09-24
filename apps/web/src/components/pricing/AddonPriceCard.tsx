'use client';

import React, { useState } from 'react';
import { Market, ADD_ON_RATE_CARD, HOURLY_SUPPORT_RATES } from '@/lib/pricingData';
import { Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface AddonPriceCardProps {
  market: Market;
}

export default function AddonPriceCard({ market }: AddonPriceCardProps) {
  const [filter, setFilter] = useState<'all' | 'feature' | 'integration' | 'marketing' | 'workflow'>('all');

  const filteredItems = ADD_ON_RATE_CARD.filter(
    item => filter === 'all' || item.category === filter
  );

  return (
    <div className="space-y-8">
      {/* Category selector */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {(
          [
            { id: 'all', label: 'All Add-Ons' },
            { id: 'feature', label: 'Features & Pages' },
            { id: 'integration', label: 'Payments & APIs' },
            { id: 'marketing', label: 'SEO & Copy' },
            { id: 'workflow', label: 'Delivery & Ops' },
          ] as const
        ).map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              filter === tab.id
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid of Add-Ons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredItems.map(item => {
          const price = market === 'kenya' ? item.kenyaPrice : item.intlPrice;
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-[#2563EB]/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-[#0F172A] text-base">{item.name}</h3>
                  <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#2563EB]">
                    {price}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {item.category}
                </span>
                <Link
                  href={`/quote?addon=${item.id}&market=${market}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-blue-800 transition-colors"
                >
                  Configure in Quote <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pay-as-you-go Technical Support Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#1E293B] text-white rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/20 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#14B8A6]">
                Flexible Support
              </span>
              <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
                No Contract Needed
              </span>
            </div>
            <h4 className="text-lg md:text-xl font-bold">
              Pay-As-You-Go Engineering & Tech Support
            </h4>
            <p className="text-xs md:text-sm text-slate-300 max-w-xl mt-1">
              Need on-demand troubleshooting, speed audits, or custom fixes without a monthly care subscription? Book our senior engineers on demand.
            </p>
          </div>
        </div>

        <div className="text-center md:text-right shrink-0">
          <div className="text-2xl md:text-3xl font-extrabold text-white">
            {HOURLY_SUPPORT_RATES[market]}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Billed per engineer hour with live time logs</p>
          <Link
            href={`/contact?service=hourly-support&market=${market}`}
            className="btn-primary text-xs px-5 py-2.5"
          >
            Request Support Hours
          </Link>
        </div>
      </div>
    </div>
  );
}
