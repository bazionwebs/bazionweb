'use client';

import React from 'react';
import { X, Check, Globe, Info } from 'lucide-react';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { MarketCode } from '@/lib/marketEngine';

export default function MarketSelectorModal() {
  const { marketCode, setMarket, isModalOpen, closeModal } = useMarketPreference();

  if (!isModalOpen) return null;

  const handleSelect = (code: MarketCode) => {
    setMarket(code);
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-modal-title"
      >
        {/* Header */}
        <div className="bg-[#0F172A] px-6 py-6 text-white relative">
          <button
            onClick={closeModal}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close market selector"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#14B8A6] mb-1">
            <Globe className="w-3.5 h-3.5" />
            <span>Commercial Market Localization</span>
          </div>
          <h2 id="market-modal-title" className="text-xl md:text-2xl font-black text-white">
            Choose Your Market
          </h2>
          <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-md">
            BazionWeb operates localized commercial price books, support SLA windows, and payment infrastructure tailored to each region.
          </p>
        </div>

        {/* Market Options */}
        <div className="p-6 space-y-3.5 bg-slate-50/50">
          {/* Kenya Market Card */}
          <button
            type="button"
            onClick={() => handleSelect('KE')}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
              marketCode === 'KE'
                ? 'border-[#2563EB] bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="text-3xl shrink-0 mt-0.5" role="img" aria-label="Kenya flag">
              🇰🇪
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-extrabold text-[#0F172A] text-base">Kenya Market</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#2563EB]">
                  KES (KSh)
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-2.5">
                Local Kenya SME &amp; enterprise price book. Integrated with instant M-Pesa STK push, Paybill, and East Africa Time (EAT) priority engineering support.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  📱 M-Pesa STK
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  🏦 Local Bank Wire
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  🇰🇪 Kenya Commercial Terms
                </span>
              </div>
            </div>
            {marketCode === 'KE' && (
              <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0 self-center">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </button>

          {/* International Market Card */}
          <button
            type="button"
            onClick={() => handleSelect('GLOBAL')}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
              marketCode === 'GLOBAL'
                ? 'border-[#0D9488] bg-teal-50/50 shadow-md ring-2 ring-teal-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="text-3xl shrink-0 mt-0.5" role="img" aria-label="World globe">
              🌍
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-extrabold text-[#0F172A] text-base">International Market</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-[#0D9488]">
                  USD ($)
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-2.5">
                Global commercial price book for worldwide clients. Includes international contract terms, multi-timezone project coordination, and international card/wire payment rails.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  💳 International Cards
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  🌐 SWIFT Bank Wire
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  🌍 Global Master SLA
                </span>
              </div>
            </div>
            {marketCode === 'GLOBAL' && (
              <div className="w-6 h-6 rounded-full bg-[#0D9488] text-white flex items-center justify-center shrink-0 self-center">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </button>
        </div>

        {/* Footer Note with Transparency Policy */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-700">Commercial Policy:</strong> Changing your browsing market switches your commercial price book. During quote and checkout, your declared organization billing country is validated to ensure compliance with relevant local tax and banking terms.
          </p>
        </div>
      </div>
    </div>
  );
}
