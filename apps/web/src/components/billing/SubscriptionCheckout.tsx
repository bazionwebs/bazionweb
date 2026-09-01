'use client';

import React, { useState } from 'react';
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Copy, 
  Loader2, 
  ArrowRight,
  Lock
} from 'lucide-react';

export interface PlanConfig {
  id: string;
  name: string;
  slug: string;
  priceMonthlyUsd: number;
  priceMonthlyKes: number;
  priceAnnualUsd: number;
  priceAnnualKes: number;
  description: string;
  features: string[];
}

interface CheckoutProps {
  initialPlanSlug?: string;
  initialCycle?: 'MONTHLY' | 'ANNUAL';
  token?: string;
}

const AVAILABLE_PLANS: Record<string, PlanConfig> = {
  starter: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Starter',
    slug: 'starter',
    priceMonthlyUsd: 49,
    priceMonthlyKes: 6400,
    priceAnnualUsd: 490,
    priceAnnualKes: 64000,
    description: 'Hosting, SSL, daily backups, and monitoring. Everything to stay online reliably.',
    features: ['Managed Cloud Hosting', 'Auto SSL Certificates', 'Daily Automated Backups', '99.9% SLA Guarantee', 'Email Support'],
  },
  growth: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Growth',
    slug: 'growth',
    priceMonthlyUsd: 99,
    priceMonthlyKes: 12900,
    priceAnnualUsd: 990,
    priceAnnualKes: 129000,
    description: 'Adds full maintenance, WAF security management, and priority response to your stack.',
    features: ['Everything in Starter', 'Monthly Core & Plugin Updates', 'Web Application Firewall (WAF)', 'Malware Scanning & Cleanup', '30-Minute P1 Response SLA'],
  },
  business: {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Business',
    slug: 'business',
    priceMonthlyUsd: 199,
    priceMonthlyKes: 25900,
    priceAnnualUsd: 1990,
    priceAnnualKes: 259000,
    description: 'Complete lifecycle management. Performance optimization, unlimited updates, strategy calls.',
    features: ['Everything in Growth', 'Unlimited Minor Content Updates', 'Core Web Vitals Optimization', 'Staging Environment Setup', '15-Minute P1 Response SLA'],
  },
  enterprise: {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Enterprise',
    slug: 'enterprise',
    priceMonthlyUsd: 499,
    priceMonthlyKes: 65000,
    priceAnnualUsd: 4990,
    priceAnnualKes: 650000,
    description: 'Custom SLA, dedicated account manager, quarterly business reviews and penetration testing.',
    features: ['Dedicated Technical Account Manager', 'Custom 99.99% Uptime SLA', 'Quarterly Security Penetration Tests', 'Annual Disaster Recovery Drills', '5-Minute Urgent Escalation'],
  },
};

type PaymentTab = 'MPESA' | 'CARD' | 'WISE';

export default function SubscriptionCheckout({
  initialPlanSlug = 'growth',
  initialCycle = 'MONTHLY',
  token = '',
}: CheckoutProps) {
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>(
    AVAILABLE_PLANS[initialPlanSlug] ? initialPlanSlug : 'growth'
  );
  const [activeTab, setActiveTab] = useState<PaymentTab>('MPESA');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>(initialCycle);
  const [phone, setPhone] = useState('2547');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [poNumber, setPoNumber] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [wiseAccount, setWiseAccount] = useState<any | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const currentPlan = AVAILABLE_PLANS[selectedPlanSlug] || AVAILABLE_PLANS['growth'];

  const currentPriceKes = billingCycle === 'ANNUAL' ? currentPlan.priceAnnualKes : currentPlan.priceMonthlyKes;
  const currentPriceUsd = billingCycle === 'ANNUAL' ? currentPlan.priceAnnualUsd : currentPlan.priceMonthlyUsd;

  const copyToClipboard = (text: string, fieldName: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Handle M-Pesa STK Push
  const handleMpesaPay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/v1/invoices/subscribe/intasend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          planId: currentPlan.id,
          billingCycle,
          paymentMethod: 'MPESA',
          mpesaPhoneNumber: phone.replace(/[^0-9]/g, ''),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'STK Push initialization failed');

      setFeedback({
        type: 'info',
        message: data.message || 'Prompt sent! Please check your mobile phone and enter your Safaricom M-Pesa PIN.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Payment request failed' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Card Checkout
  const handleCardPay = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/v1/invoices/subscribe/intasend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          planId: currentPlan.id,
          billingCycle,
          paymentMethod: 'CARD',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Card session failed');

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Card gateway error' });
      setLoading(false);
    }
  };

  // Handle Wise Corporate Invoice Generation
  const handleWiseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/v1/invoices/corporate-invoice/wise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          planId: currentPlan.id,
          billingCycle,
          currency,
          purchaseOrderNumber: poNumber || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invoice generation failed');

      setWiseAccount(data);
      setFeedback({
        type: 'success',
        message: `Corporate B2B Invoice ${data.invoiceNumber} provisioned with designated virtual bank account.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Corporate invoice generation failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Order Summary & Plan Selection */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6]">Order Summary</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30">
              Live Checkout
            </span>
          </div>

          {/* Plan Selector */}
          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Tier</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(AVAILABLE_PLANS).map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setSelectedPlanSlug(p.slug)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedPlanSlug === p.slug
                      ? 'border-[#2563EB] bg-[#2563EB]/15 text-white font-semibold shadow-md'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">{p.name}</div>
                  <div className="text-xs text-slate-400">${p.priceMonthlyUsd}/mo</div>
                </button>
              ))}
            </div>
          </div>

          {/* Billing Cycle Switcher */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Billing Frequency</span>
              <div className="bg-slate-900 p-1 rounded-xl flex items-center border border-slate-800">
                <button
                  type="button"
                  onClick={() => setBillingCycle('MONTHLY')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    billingCycle === 'MONTHLY' ? 'bg-[#2563EB] text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('ANNUAL')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                    billingCycle === 'ANNUAL' ? 'bg-[#2563EB] text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Annual <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950 px-1 rounded">-17%</span>
                </button>
              </div>
            </div>
          </div>

          {/* Included Features */}
          <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan Highlights</span>
            <ul className="space-y-2 text-xs text-slate-300">
              {currentPlan.features.map((f, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Total Breakdown */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-baseline">
            <span className="text-sm text-slate-400 font-medium">Subtotal Due</span>
            <div className="text-right">
              <div className="text-2xl font-black text-white">${currentPriceUsd.toLocaleString()} USD</div>
              <div className="text-xs text-emerald-400 font-mono">≈ KES {currentPriceKes.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-400">
          <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>256-Bit SSL Encrypted Checkout. Backed by Safaricom M-Pesa, IntaSend, and Wise API.</span>
        </div>
      </div>

      {/* Right Column: Multi-Rail Payment Gateway Selection */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Gateway</span>
            <h2 className="text-xl font-bold text-white mt-1">Select Payment Method</h2>
          </div>

          {/* Tab Rail Buttons */}
          <div className="grid grid-cols-3 gap-3 my-5">
            <button
              type="button"
              onClick={() => { setActiveTab('MPESA'); setFeedback(null); }}
              className={`flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                activeTab === 'MPESA'
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/40'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>M-Pesa (Kenya)</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('CARD'); setFeedback(null); }}
              className={`flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                activeTab === 'CARD'
                  ? 'bg-blue-500/15 border-blue-500 text-blue-300 shadow-lg shadow-blue-950/40'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Credit Card</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('WISE'); setFeedback(null); }}
              className={`flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                activeTab === 'WISE'
                  ? 'bg-purple-500/15 border-purple-500 text-purple-300 shadow-lg shadow-purple-950/40'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Corporate (Wise)</span>
            </button>
          </div>

          {/* Feedback message banner */}
          {feedback && (
            <div className={`mb-5 p-4 rounded-xl flex items-start gap-3 text-xs border ${
              feedback.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}>
              {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
              <div className="leading-relaxed">{feedback.message}</div>
            </div>
          )}

          {/* Tab 1: M-Pesa Express (Kenya) */}
          {activeTab === 'MPESA' && (
            <form onSubmit={handleMpesaPay} className="space-y-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 text-xs font-medium">Payable via M-Pesa</span>
                <span className="text-xl font-bold text-emerald-400 font-mono">KES {currentPriceKes.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Safaricom M-Pesa Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="254712345678"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  You will receive an STK Push PIN prompt directly on your handset.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send M-Pesa STK Prompt <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {/* Tab 2: Credit / Debit Card (IntaSend) */}
          {activeTab === 'CARD' && (
            <div className="space-y-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 text-xs font-medium">Card Renewal Amount</span>
                <span className="text-xl font-bold text-white font-mono">${currentPriceUsd.toLocaleString()} USD</span>
              </div>

              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                Supports Visa, Mastercard, and American Express. Your card details are tokenized securely with IntaSend PCI-DSS Level 1 compliance.
              </div>

              <button
                type="button"
                onClick={handleCardPay}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Proceed to Card Gateway <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* Tab 3: Wise Corporate Wire */}
          {activeTab === 'WISE' && (
            <div className="space-y-4">
              {!wiseAccount ? (
                <form onSubmit={handleWiseInvoice} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                        Settlement Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e: any) => setCurrency(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white text-xs focus:outline-none focus:border-purple-500"
                      >
                        <option value="USD">USD ($) - ACH / Fedwire Routing</option>
                        <option value="EUR">EUR (€) - SEPA Instant / IBAN</option>
                        <option value="GBP">GBP (£) - UK Faster Payments</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                        Purchase Order # (Optional)
                      </label>
                      <input
                        type="text"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder="PO-2026-0089"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400 text-xs font-medium">B2B Net Invoice Total</span>
                    <span className="text-xl font-bold text-purple-300 font-mono">{currency} ${currentPriceUsd.toLocaleString()}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 text-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Generate B2B Invoice & Virtual Wire Account <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              ) : (
                /* Allocated Virtual Bank Account Box */
                <div className="space-y-4">
                  <div className="bg-purple-950/40 border border-purple-800/60 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-purple-300 font-semibold uppercase tracking-wider">Invoice Generated</div>
                      <div className="text-base font-bold text-white font-mono">{wiseAccount.invoiceNumber}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-200"
                    >
                      <Download className="w-3.5 h-3.5 text-purple-400" /> Print PDF Invoice
                    </button>
                  </div>

                  {/* Wire Routing Details Card */}
                  <div className="space-y-2 bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs">
                    {[
                      { label: 'Beneficiary Name', value: wiseAccount.bankTransferDetails.beneficiary },
                      { label: 'Account Number / IBAN', value: wiseAccount.bankTransferDetails.accountNumber || wiseAccount.bankTransferDetails.iban },
                      { label: 'Routing / ABA / Sort Code', value: wiseAccount.bankTransferDetails.routingNumber },
                      { label: 'SWIFT / BIC', value: wiseAccount.bankTransferDetails.swiftBic },
                      { label: 'Mandatory Payment Reference', value: wiseAccount.paymentReference },
                    ].filter(item => Boolean(item.value)).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-800/80 last:border-0">
                        <span className="text-slate-400">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white font-bold">{item.value}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.value, item.label)}
                            className="p-1 text-slate-400 hover:text-white transition"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {copiedField && (
                    <div className="text-[11px] text-emerald-400 text-right">
                      Copied {copiedField} to clipboard!
                    </div>
                  )}

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs leading-relaxed">
                    {wiseAccount.bankTransferDetails.referenceNote}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
