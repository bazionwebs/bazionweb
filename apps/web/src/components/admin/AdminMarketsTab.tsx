'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  Check,
  Calculator,
  ExternalLink,
  Copy,
  Layers,
  FileCode,
} from 'lucide-react';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import {
  WEBSITE_PACKAGES,
  ECOMMERCE_PACKAGES,
  CARE_PLANS,
  MANAGED_HOSTING_PLANS,
} from '@/lib/pricingData';
import { MarketCode } from '@/lib/marketEngine';

type MatrixCategory = 'all' | 'websites' | 'ecommerce' | 'care' | 'hosting';

export default function AdminMarketsTab() {
  const { marketCode, setMarket } = useMarketPreference();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // ─── Filter Category for Matrix ───
  const [selectedCategory, setSelectedCategory] = useState<MatrixCategory>('all');

  // ─── Quote Sandbox State ───
  const [sandboxMarket, setSandboxMarket] = useState<MarketCode>('KE');
  const [sandboxPackageId, setSandboxPackageId] = useState<string>('business');
  const [extraPages, setExtraPages] = useState<number>(2);
  const [selectedAddons, setSelectedAddons] = useState<string[]>(['seo-foundation']);
  const [isRush, setIsRush] = useState<boolean>(false);
  const [couponCode, setCouponCode] = useState<string>('');
  const [showJsonPayload, setShowJsonPayload] = useState<boolean>(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(key);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // ─── Sandbox Calculations ───
  const activePlan = WEBSITE_PACKAGES.find(p => p.id === sandboxPackageId) || WEBSITE_PACKAGES[1];
  
  // Base Prices
  const basePriceKES = sandboxPackageId === 'launch' ? 25000 : sandboxPackageId === 'business' ? 90000 : sandboxPackageId === 'professional' ? 160000 : 320000;
  const basePriceUSD = sandboxPackageId === 'launch' ? 450 : sandboxPackageId === 'business' ? 950 : sandboxPackageId === 'professional' ? 1750 : 3600;
  const basePrice = sandboxMarket === 'KE' ? basePriceKES : basePriceUSD;

  // Extra Page Rates
  const extraPageRateKES = 2000;
  const extraPageRateUSD = 40;
  const extraPageRate = sandboxMarket === 'KE' ? extraPageRateKES : extraPageRateUSD;
  const extraPagesTotal = extraPages * extraPageRate;

  // Add-ons
  const availableAddons = [
    { id: 'seo-foundation', name: 'Technical SEO & Schema Foundation', kes: 15000, usd: 220 },
    { id: 'speed-boost', name: 'Lighthouse 98+ Speed Hardening', kes: 12000, usd: 180 },
    { id: 'copywriting', name: 'Professional Conversion Copywriting', kes: 10000, usd: 180 },
    { id: 'crm-integration', name: 'HubSpot / Zoho CRM Pipeline', kes: 25000, usd: 350 },
  ];

  const addonsTotal = selectedAddons.reduce((sum, addonId) => {
    const item = availableAddons.find(a => a.id === addonId);
    if (!item) return sum;
    return sum + (sandboxMarket === 'KE' ? item.kes : item.usd);
  }, 0);

  const subtotalBeforeRush = basePrice + extraPagesTotal + addonsTotal;
  const rushSurcharge = isRush ? subtotalBeforeRush * 0.25 : 0;
  const subtotal = subtotalBeforeRush + rushSurcharge;

  // Discount
  const isCouponValid = ['GLOBAL10', 'GLOBAL100', 'SMEKE10', 'BAZION10'].includes(couponCode.trim().toUpperCase());
  const discountAmount = isCouponValid
    ? (couponCode.trim().toUpperCase() === 'GLOBAL100' ? 100 : subtotal * 0.1)
    : 0;
  const netAfterDiscount = Math.max(0, subtotal - discountAmount);

  // Taxes
  // Kenya: 16% VAT inclusive in gross total
  // Global: 0% Export Reverse Charge
  const taxRate = sandboxMarket === 'KE' ? 0.16 : 0.0;
  const taxAmount = sandboxMarket === 'KE'
    ? netAfterDiscount - (netAfterDiscount / (1 + taxRate))
    : 0;
  const totalPayable = netAfterDiscount;

  const currencySymbol = sandboxMarket === 'KE' ? 'KSh' : '$';

  // API Payload simulation
  const simulationPayload = {
    market: sandboxMarket,
    packageId: sandboxPackageId,
    extraPages,
    addons: selectedAddons,
    isRush,
    couponCode: couponCode || null,
    subtotal,
    discount: discountAmount,
    taxRate,
    taxAmount: Math.round(taxAmount),
    totalPayable: Math.round(totalPayable),
    currency: sandboxMarket === 'KE' ? 'KES' : 'USD',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ─── Top Regional Overview ─── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-700/60">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Globe className="w-3.5 h-3.5" />
              <span>Multi-Market Database SSOT &amp; Regional Governance</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Regional Commercial Packages &amp; Testing Console
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              Inspect, compare, and simulate both domestic Kenya (KES) and cross-border International (USD) price books in real time.
            </p>
          </div>

          {/* Quick Active Storefront Switcher */}
          <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 shrink-0">
            <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
              <span>Your Active Browser Session:</span>
              <span className="text-[10px] text-teal-400 font-mono">[{marketCode}]</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMarket('KE')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  marketCode === 'KE'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-white/30'
                    : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>🇰🇪 Kenya (KES)</span>
                {marketCode === 'KE' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setMarket('GLOBAL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  marketCode === 'GLOBAL'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 ring-2 ring-white/30'
                    : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>🌐 International (USD)</span>
                {marketCode === 'GLOBAL' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Market System Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Card 1: Kenya */}
          <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/80 hover:border-blue-500/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🇰🇪</span>
                <div>
                  <h3 className="font-extrabold text-white text-base">Kenya Commercial Engine</h3>
                  <p className="text-xs text-blue-400 font-mono">Price Book: KE-2026-v1</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Primary Domestic
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 py-3 border-y border-slate-700/50">
              <div>
                <span className="text-slate-400 block text-[11px]">Base Currency:</span>
                <strong className="text-white font-mono">KES (KSh)</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Tax Compliance:</span>
                <strong className="text-white">KRA 16% VAT Inclusive</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Payment Rails:</span>
                <strong className="text-white">M-Pesa STK, Paystack Card, Wire</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Target Geography:</span>
                <strong className="text-white">Kenya (KE), East Africa</strong>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 text-xs">
              <Link
                href="/pricing?market=ke&dev_preview=1"
                target="_blank"
                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-bold"
              >
                <span>Preview Kenya Storefront</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => copyToClipboard('https://bazionweb.com/pricing?market=ke', 'ke-link')}
                className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedUrl === 'ke-link' ? 'Copied!' : 'Copy Share Link'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: International */}
          <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/80 hover:border-teal-500/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🌐</span>
                <div>
                  <h3 className="font-extrabold text-white text-base">Global Commercial Engine</h3>
                  <p className="text-xs text-teal-400 font-mono">Price Book: GLOBAL-2026-v1</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Cross-Border Export
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 py-3 border-y border-slate-700/50">
              <div>
                <span className="text-slate-400 block text-[11px]">Base Currency:</span>
                <strong className="text-white font-mono">USD ($)</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Tax Compliance:</span>
                <strong className="text-white">0% Export (Reverse Charge)</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Payment Rails:</span>
                <strong className="text-white">Paystack Card</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Target Geography:</span>
                <strong className="text-white">US, UK, EU, Global Clients</strong>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 text-xs">
              <Link
                href="/pricing?market=global&dev_preview=1"
                target="_blank"
                className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-bold"
              >
                <span>Preview Global Storefront</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => copyToClipboard('https://bazionweb.com/pricing?market=global', 'global-link')}
                className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedUrl === 'global-link' ? 'Copied!' : 'Copy Share Link'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Side-by-Side Product Price Book Matrix ─── */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Side-by-Side Regional Pricing Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparative view of standard catalogue rates across domestic and global price books.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'all' as MatrixCategory, label: 'All Services' },
              { id: 'websites' as MatrixCategory, label: 'Websites' },
              { id: 'ecommerce' as MatrixCategory, label: 'E-Commerce' },
              { id: 'care' as MatrixCategory, label: 'Care Plans' },
              { id: 'hosting' as MatrixCategory, label: 'Hosting' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Service Tier / Package</th>
                <th className="py-3.5 px-4 text-blue-700 bg-blue-50/50">
                  <div className="flex items-center gap-1.5">
                    <span>🇰🇪 Kenya (KES)</span>
                    <span className="text-[10px] font-normal text-blue-600">(16% VAT Incl)</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-teal-700 bg-teal-50/50">
                  <div className="flex items-center gap-1.5">
                    <span>🌐 Global (USD)</span>
                    <span className="text-[10px] font-normal text-teal-600">(0% Export)</span>
                  </div>
                </th>
                <th className="py-3.5 px-4">Implied Ratio</th>
                <th className="py-3.5 px-4">Scope &amp; Included Work</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Websites */}
              {(selectedCategory === 'all' || selectedCategory === 'websites') && (
                <>
                  <tr className="bg-slate-100/70 font-bold text-slate-700 text-[11px]">
                    <td colSpan={6} className="py-2 px-4 uppercase tracking-wider">
                      Business &amp; Corporate Websites
                    </td>
                  </tr>
                  {WEBSITE_PACKAGES.map(pkg => (
                    <tr key={pkg.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#0F172A]">
                        <div>{pkg.name}</div>
                        {pkg.badge && (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold mt-0.5">
                            {pkg.badge}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-blue-700 bg-blue-50/30 font-mono text-sm">
                        {pkg.kenyaPrice}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-teal-700 bg-teal-50/30 font-mono text-sm">
                        {pkg.intlPrice}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {pkg.id === 'launch' ? '~50 KES/$' : pkg.id === 'business' ? '~60 KES/$' : '~56 KES/$'}
                        <span className="block text-[10px] text-slate-400">PPP adjusted</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {pkg.pages} · {pkg.timeline} · {pkg.revisions}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSandboxPackageId(pkg.id);
                            const element = document.getElementById('quote-sandbox');
                            if (element) element.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white font-bold text-slate-600 transition-colors cursor-pointer text-[11px]"
                        >
                          Simulate
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* E-Commerce */}
              {(selectedCategory === 'all' || selectedCategory === 'ecommerce') && (
                <>
                  <tr className="bg-slate-100/70 font-bold text-slate-700 text-[11px]">
                    <td colSpan={6} className="py-2 px-4 uppercase tracking-wider">
                      E-Commerce Stores &amp; Online Commerce
                    </td>
                  </tr>
                  {ECOMMERCE_PACKAGES.map(pkg => (
                    <tr key={pkg.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#0F172A]">
                        <div>{pkg.name}</div>
                        {pkg.badge && (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold mt-0.5">
                            {pkg.badge}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-blue-700 bg-blue-50/30 font-mono text-sm">
                        {pkg.kenyaPrice}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-teal-700 bg-teal-50/30 font-mono text-sm">
                        {pkg.intlPrice}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        ~60 KES/$
                        <span className="block text-[10px] text-slate-400">PPP adjusted</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {pkg.products} · {pkg.support}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/pricing#ecommerce`}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px]"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Care Plans */}
              {(selectedCategory === 'all' || selectedCategory === 'care') && (
                <>
                  <tr className="bg-slate-100/70 font-bold text-slate-700 text-[11px]">
                    <td colSpan={6} className="py-2 px-4 uppercase tracking-wider">
                      Monthly Care &amp; Maintenance (Recurring)
                    </td>
                  </tr>
                  {CARE_PLANS.map(plan => (
                    <tr key={plan.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#0F172A]">
                        <div>{plan.name}</div>
                        {plan.badge && (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold mt-0.5">
                            {plan.badge}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-blue-700 bg-blue-50/30 font-mono text-sm">
                        {plan.kenyaPrice}/mo
                      </td>
                      <td className="py-3 px-4 font-extrabold text-teal-700 bg-teal-50/30 font-mono text-sm">
                        {plan.intlPrice}/mo
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        ~53 KES/$
                        <span className="block text-[10px] text-slate-400">PPP adjusted</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {plan.hours} dedicated engineering
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/pricing#care`}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px]"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Hosting */}
              {(selectedCategory === 'all' || selectedCategory === 'hosting') && (
                <>
                  <tr className="bg-slate-100/70 font-bold text-slate-700 text-[11px]">
                    <td colSpan={6} className="py-2 px-4 uppercase tracking-wider">
                      Managed High-Performance Hosting
                    </td>
                  </tr>
                  {MANAGED_HOSTING_PLANS.map(plan => (
                    <tr key={plan.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#0F172A]">
                        <div>{plan.name}</div>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-blue-700 bg-blue-50/30 font-mono text-sm">
                        {plan.kenyaPrice}/mo
                      </td>
                      <td className="py-3 px-4 font-extrabold text-teal-700 bg-teal-50/30 font-mono text-sm">
                        {plan.intlPrice}/mo
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        ~80 KES/$
                        <span className="block text-[10px] text-slate-400">Infra parity</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {plan.resources}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/pricing#hosting`}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px]"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Interactive Multi-Market Quote Sandbox ─── */}
      <div id="quote-sandbox" className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-1.5">
              <Calculator className="w-3.5 h-3.5" />
              <span>Interactive Quote Simulation Sandbox</span>
            </div>
            <h3 className="text-xl font-extrabold text-[#0F172A]">
              Test Multi-Market Quotation Engine
            </h3>
            <p className="text-xs text-slate-500">
              Simulate end-to-end pricing calculation with add-ons, extra pages, tax rules, and coupons.
            </p>
          </div>

          {/* Sandbox Target Market Selector */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setSandboxMarket('KE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                sandboxMarket === 'KE'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🇰🇪 Kenya (KES)</span>
            </button>

            <button
              type="button"
              onClick={() => setSandboxMarket('GLOBAL')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                sandboxMarket === 'GLOBAL'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🌐 Global (USD)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Form (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Package Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Base Package:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {WEBSITE_PACKAGES.map(pkg => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSandboxPackageId(pkg.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      sandboxPackageId === pkg.id
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#0F172A]">{pkg.name}</div>
                    <div className="text-xs font-extrabold text-blue-700 mt-1 font-mono">
                      {sandboxMarket === 'KE' ? pkg.kenyaPrice : pkg.intlPrice}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Extra Pages Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                <span className="uppercase tracking-wider">Additional Scope Pages:</span>
                <span className="text-blue-600 font-mono text-sm">{extraPages} pages ({currencySymbol} {extraPagesTotal.toLocaleString()})</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={extraPages}
                onChange={e => setExtraPages(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0 pages (included)</span>
                <span>Rate: {currencySymbol} {extraPageRate.toLocaleString()} / page</span>
                <span>20 pages max</span>
              </div>
            </div>

            {/* Add-on Services Checkboxes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Add-On Modules:
              </label>
              <div className="space-y-2">
                {availableAddons.map(addon => {
                  const isChecked = selectedAddons.includes(addon.id);
                  const price = sandboxMarket === 'KE' ? addon.kes : addon.usd;
                  return (
                    <label
                      key={addon.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50/30'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedAddons([...selectedAddons, addon.id]);
                            } else {
                              setSelectedAddons(selectedAddons.filter(id => id !== addon.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-[#0F172A]">{addon.name}</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-slate-700">
                        +{currencySymbol} {price.toLocaleString()}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Rush & Coupon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Coupon Code:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value)}
                    placeholder="Try 'BAZION10'"
                    className="w-full px-3 py-2 text-xs uppercase font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {isCouponValid && (
                    <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                      -10% Applied
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Priority Delivery:
                </label>
                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer h-9">
                  <input
                    type="checkbox"
                    checked={isRush}
                    onChange={e => setIsRush(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-700">Rush (+25% surcharge)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Breakdown Card (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900 rounded-2xl p-6 text-white shadow-lg">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                  Itemized Quotation Breakdown
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {sandboxMarket === 'KE' ? '🇰🇪 KES' : '🌐 USD'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Base Package ({activePlan.name}):</span>
                  <span className="font-mono text-white font-bold">{currencySymbol} {basePrice.toLocaleString()}</span>
                </div>

                {extraPages > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>{extraPages} Extra Pages:</span>
                    <span className="font-mono text-white font-bold">+{currencySymbol} {extraPagesTotal.toLocaleString()}</span>
                  </div>
                )}

                {addonsTotal > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Selected Add-Ons ({selectedAddons.length}):</span>
                    <span className="font-mono text-white font-bold">+{currencySymbol} {addonsTotal.toLocaleString()}</span>
                  </div>
                )}

                {isRush && (
                  <div className="flex justify-between text-amber-300">
                    <span>Rush Engineering (+25%):</span>
                    <span className="font-mono font-bold">+{currencySymbol} {Math.round(rushSurcharge).toLocaleString()}</span>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Coupon Discount (10%):</span>
                    <span className="font-mono">-{currencySymbol} {Math.round(discountAmount).toLocaleString()}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>
                      {sandboxMarket === 'KE' ? 'Included KRA 16% VAT portion:' : 'Cross-border Tax Rate:'}
                    </span>
                    <span className="font-mono text-slate-300">
                      {sandboxMarket === 'KE'
                        ? `${currencySymbol} ${Math.round(taxAmount).toLocaleString()} (Included)`
                        : '0.00% (Reverse Charge / Export)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Block */}
            <div className="pt-6 border-t border-slate-800 mt-6">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                  Total Payable:
                </span>
                <span className="text-3xl font-black text-white font-mono">
                  {currencySymbol} {Math.round(totalPayable).toLocaleString()}
                </span>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowJsonPayload(!showJsonPayload)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-teal-400" />
                  <span>{showJsonPayload ? 'Hide API Payload' : 'Inspect Server API Payload'}</span>
                </button>
              </div>

              {showJsonPayload && (
                <div className="mt-3 p-3 rounded-xl bg-black/60 border border-slate-800 font-mono text-[10px] text-teal-300 overflow-x-auto">
                  <pre>{JSON.stringify(simulationPayload, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
