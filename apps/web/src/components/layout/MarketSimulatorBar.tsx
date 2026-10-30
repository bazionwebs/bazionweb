'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, ChevronDown, ChevronUp, RefreshCw, SlidersHorizontal, ExternalLink, X } from 'lucide-react';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { BAZION_MARKET_COOKIE, LEGACY_MARKET_COOKIE } from '@/lib/marketEngine';
import { useAuthStore } from '@/store/auth.store';

const PREVIEW_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'];

export default function MarketSimulatorBar() {
  const { marketCode, marketDef, setMarket } = useMarketPreference();
  const roles = useAuthStore(s => s.user?.roles);
  const hasHydrated = useAuthStore(s => s._hasHydrated);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [source, setSource] = useState<'cookie' | 'auto'>('auto');

  // Staff preview tool: only authenticated staff, or developers running the
  // app locally. It is mounted exclusively inside the public layout, so it can
  // never leak into the client portal or staff admin workspace.
  const isDev = process.env.NODE_ENV === 'development';
  const isStaff = roles?.some(role => PREVIEW_ROLES.includes(role)) ?? false;
  const canUseSimulator = isDev || isStaff;

  useEffect(() => {
    if (!canUseSimulator) return;

    const storedState = window.localStorage.getItem('bw_simulator_collapsed');
    if (storedState !== null) {
      setIsCollapsed(storedState === 'true');
    }
    if (window.sessionStorage.getItem('bw_simulator_hidden') === 'true') {
      setIsVisible(false);
    }
  }, [canUseSimulator]);

  useEffect(() => {
    if (!canUseSimulator) return;
    setSource(document.cookie.includes(BAZION_MARKET_COOKIE) ? 'cookie' : 'auto');
  }, [marketCode, canUseSimulator]);

  if (!hasHydrated || !canUseSimulator || !isVisible) return null;

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    window.localStorage.setItem('bw_simulator_collapsed', String(next));
  };

  const handleClose = () => {
    setIsVisible(false);
    window.sessionStorage.setItem('bw_simulator_hidden', 'true');
  };

  const handleReset = () => {
    // Delete cookies and let browser auto-detect
    document.cookie = `${BAZION_MARKET_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    document.cookie = `${LEGACY_MARKET_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    window.localStorage.removeItem(BAZION_MARKET_COOKIE);
    window.localStorage.removeItem(LEGACY_MARKET_COOKIE);
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 print:hidden font-sans">
      {isCollapsed ? (
        // ─── Collapsed Pill ───
        <button
          type="button"
          onClick={toggleCollapse}
          title="Click to expand Developer Market Simulator"
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900/90 text-white text-xs font-bold shadow-xl border border-slate-700/80 backdrop-blur-md hover:bg-slate-800 hover:scale-105 transition-all duration-150 cursor-pointer group"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <Globe className="w-3.5 h-3.5 text-teal-400 group-hover:rotate-45 transition-transform" />
          <span className="flex items-center gap-1">
            <span>{marketDef.flag}</span>
            <span className="font-extrabold">{marketCode}</span>
            <span className="text-slate-400 text-[11px]">({marketDef.currency})</span>
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
      ) : (
        // ─── Expanded Control Dock ───
        <div className="w-80 md:w-96 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-slate-700/80 backdrop-blur-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Regional Market Simulator
                </h4>
                <p className="text-[10px] text-slate-400">
                  Admin &amp; Dev Multi-Market Previewer
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleCollapse}
                title="Minimize simulator"
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                title="Close for session"
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Status Info */}
          <div className="bg-slate-800/80 rounded-xl p-2.5 mb-3 border border-slate-700/50 flex items-center justify-between text-xs">
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Active Storefront:</div>
              <div className="font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                <span className="text-sm">{marketDef.flag}</span>
                <span>{marketDef.name}</span>
                <span className="text-xs text-teal-400 font-mono">[{marketDef.currency}]</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-medium">Source:</div>
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                source === 'cookie'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {source === 'cookie' ? 'Cookie Override' : 'Auto Geo/TZ'}
              </span>
            </div>
          </div>

          {/* 1-Click Simulation Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => setMarket('KE')}
              className={`p-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col cursor-pointer ${
                marketCode === 'KE'
                  ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">🇰🇪 KE</span>
                <span className="text-[10px] font-mono opacity-80">KES</span>
              </div>
              <span className="text-[10px] text-slate-200">Kenya (16% VAT, M-Pesa)</span>
            </button>

            <button
              type="button"
              onClick={() => setMarket('GLOBAL')}
              className={`p-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col cursor-pointer ${
                marketCode === 'GLOBAL'
                  ? 'bg-teal-600 border-teal-400 text-white shadow-md shadow-teal-600/30 ring-1 ring-teal-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">🌐 GLOBAL</span>
                <span className="text-[10px] font-mono opacity-80">USD</span>
              </div>
              <span className="text-[10px] text-slate-200">Global (0% Export, Card)</span>
            </button>
          </div>

          {/* Action Links */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              title="Clear market cookies & restore auto-detection"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset to Auto</span>
            </button>

            <Link
              href="/admin?tab=markets"
              className="flex items-center gap-1 text-teal-400 hover:text-teal-300 font-bold transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Admin Pricing Matrix</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
