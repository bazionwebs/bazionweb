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
    priceMonthlyUsd: 29,
    priceMonthlyKes: 3800,
    priceAnnualUsd: 290,
    priceAnnualKes: 38000,
    description: 'SSL, daily backups, and continuous monitoring. Everything to stay online reliably.',
    features: ['Cloud Deployment Configuration', 'Auto SSL Certificates', 'Daily Automated Backups', 'Continuous Uptime Checks', 'Email Support'],
  },
  growth: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Growth',
    slug: 'growth',
    priceMonthlyUsd: 59,
    priceMonthlyKes: 7700,
    priceAnnualUsd: 590,
    priceAnnualKes: 77000,
    description: 'Adds full maintenance, WAF security management, and priority response to your stack.',
    features: ['Everything in Starter', 'Monthly Core & Plugin Updates', 'Web Application Firewall (WAF)', 'Malware Scanning & Cleanup', '30-Minute P1 Response Support'],
  },
  business: {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Business',
    slug: 'business',
    priceMonthlyUsd: 119,
    priceMonthlyKes: 15500,
    priceAnnualUsd: 1190,
    priceAnnualKes: 155000,
    description: 'Complete lifecycle management. Performance optimization, unlimited updates, strategy calls.',
    features: ['Everything in Growth', 'Unlimited Minor Content Updates', 'Core Web Vitals Optimization', 'Staging Environment Setup', '15-Minute P1 Response Support'],
  },
  enterprise: {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Enterprise',
    slug: 'enterprise',
    priceMonthlyUsd: 299,
    priceMonthlyKes: 39000,
    priceAnnualUsd: 2990,
    priceAnnualKes: 390000,
    description: 'Custom coverage, dedicated account manager, quarterly reviews and security testing.',
    features: ['Dedicated Technical Account Manager', 'Priority High-Availability Monitoring', 'Quarterly Security Reviews', 'Annual Disaster Recovery Drills', 'Fast Urgent Escalation'],
  },
};

type PaymentTab = 'MPESA' | 'CARD' | 'WISE';

export interface WiseBankAccount {
  status?: string;
  invoiceNumber: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  paymentReference?: string;
  bankTransferDetails: {
    beneficiary: string;
    accountNumber?: string;
    routingNumber?: string;
    iban?: string;
    swiftBic?: string;
    bankAddress?: string;
    referenceNote?: string;
  };
}

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
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [poNumber, setPoNumber] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [wiseAccount, setWiseAccount] = useState<WiseBankAccount | null>(null);
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

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'https://api.bazionweb.com/api/v1').replace(/\/$/, '');

  // M-Pesa STK via IntaSend (KES) — server-side pricing, phone only.
  const handleMpesaPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setFeedback({ type: 'error', message: 'Please sign in to pay with M-Pesa.' });
      return;
    }
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`${apiBase}/invoices/subscribe/intasend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          planId: currentPlan.id,
          billingCycle,
          paymentMethod: 'MPESA',
          mpesaPhoneNumber: phone.replace(/[^0-9+]/g, ''),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'M-Pesa initialization failed');

      setFeedback({
        type: 'info',
        message: `${data.message || 'M-Pesa prompt sent!'} Check your handset and enter PIN. Invoice ${data.invoiceNumber}.`,
      });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err instanceof Error ? err.message : null) || 'Payment request failed' });
    } finally {
      setLoading(false);
    }
  };

  // Card via Paystack (KES/USD) — server-side pricing, fallback to Next.js route
  const handleCardPay = async () => {
    setLoading(true);
    setFeedback(null);

    const clientEmail = email || (typeof window !== 'undefined' ? localStorage.getItem('bw_user_email') : '') || 'client@bazionweb.com';
    const amountToCharge = billingCycle === 'ANNUAL' ? currentPlan.priceAnnualKes : currentPlan.priceMonthlyKes;

    try {
      if (token) {
        try {
          const res = await fetch(`${apiBase}/invoices/subscribe/paystack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              planId: currentPlan.id,
              billingCycle,
              currency: 'KES',
              ...(email ? { email } : {}),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.checkoutUrl) {
              window.location.href = data.checkoutUrl;
              return;
            }
          }
        } catch {
          // Fall back to direct paystack route below
        }
      }

      // Direct Paystack checkout initialization
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: clientEmail,
          amount: amountToCharge,
          planSlug: currentPlan.slug,
          currency: 'KES',
          channels: ['card', 'mobile_money'],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Card gateway initialization failed');

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err instanceof Error ? err.message : null) || 'Card gateway error' });
      setLoading(false);
    }
  };

  // Manual B2B bank transfer (Wise = payouts/invoice links only — no virtual accounts in KE).
  const handleWiseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setFeedback({ type: 'error', message: 'Please sign in to generate a corporate invoice.' });
      return;
    }
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`${apiBase}/invoices/corporate-invoice/bank-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
        message: `Corporate invoice ${data.invoiceNumber} ready. Wire to ${data.bankTransferDetails?.beneficiary} with reference ${data.paymentReference}. Admin confirms on receipt.`,
      });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err instanceof Error ? err.message : null) || 'Corporate invoice generation failed' });
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
          <span>256-Bit SSL Encrypted Checkout. Backed by Paystack (M-Pesa STK Push + Global Cards) and Wise (Corporate Wire) APIs.</span>
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
              <span>Mobile Money</span>
              <span className="text-[10px] font-normal opacity-70">via M-Pesa</span>
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

          {/* Tab 1: Mobile Money (M-Pesa Express) */}
          {activeTab === 'MPESA' && (
            <form onSubmit={handleMpesaPay} className="space-y-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 text-xs font-medium">Payable via mobile money (M-Pesa)</span>
                <span className="text-xl font-bold text-emerald-400 font-mono">KES {currentPriceKes.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Billing Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@yourcompany.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors mb-3"
                />

                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Mobile-money phone number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712 345 678"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  You will receive an STK Push PIN prompt directly on your handset via Paystack.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send mobile-money prompt <ArrowRight className="w-4 h-4" /></>}
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

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Billing Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@yourcompany.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors mb-3"
                />
              </div>

              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                Supports Visa, Mastercard, and American Express. Your card details are tokenized securely with Paystack PCI-DSS Level 1 compliance.
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
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurrency(e.target.value as 'USD' | 'EUR' | 'GBP')}
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
                    ].filter((item): item is { label: string; value: string } => Boolean(item.value)).map((item, idx) => (
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

                  {wiseAccount.bankTransferDetails.referenceNote && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs leading-relaxed">
                      {wiseAccount.bankTransferDetails.referenceNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
