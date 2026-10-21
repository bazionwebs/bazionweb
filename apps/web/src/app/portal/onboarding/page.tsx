'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  CreditCard,
  Smartphone,
  Building2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Sparkles,
  Lock,
  LogOut,
  AlertCircle,
  ChevronRight,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';
import { useMarketPreference } from '@/hooks/useMarketPreference';

// ─── Plan config (mirrors SubscriptionCheckout) ────────────────────────────────
const PLAN_META: Record<string, {
  name: string;
  priceMonthlyKes: number;
  priceMonthlyUsd: number;
  priceAnnualKes: number;
  priceAnnualUsd: number;
  features: string[];
  color: string;
  accent: string;
}> = {
  'care-essential': {
    name: 'Care Essential',
    priceMonthlyKes: 5000,
    priceMonthlyUsd: 75,
    priceAnnualKes: 54000,
    priceAnnualUsd: 810,
    features: ['CMS & Plugin Updates', 'Offsite Backups', 'Security Monitoring', '1 hr Support/mo', 'Uptime Alerts'],
    color: 'from-teal-600 to-emerald-600',
    accent: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  },
  'care-business': {
    name: 'Care Business',
    priceMonthlyKes: 10000,
    priceMonthlyUsd: 150,
    priceAnnualKes: 108000,
    priceAnnualUsd: 1620,
    features: ['Weekly CMS Updates', 'Daily Backups', 'Core Web Vitals', 'SEO Health Audits', '2 hrs Support/mo'],
    color: 'from-blue-600 to-indigo-600',
    accent: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  'care-professional': {
    name: 'Care Professional',
    priceMonthlyKes: 20000,
    priceMonthlyUsd: 300,
    priceAnnualKes: 216000,
    priceAnnualUsd: 3240,
    features: ['Active Development', 'SEO Monitoring', '5 hrs Support/mo', 'Quarterly Strategy Call', 'Emergency Hotline'],
    color: 'from-violet-600 to-purple-600',
    accent: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
  },
  starter: {
    name: 'Starter',
    priceMonthlyKes: 3800,
    priceMonthlyUsd: 29,
    priceAnnualKes: 38000,
    priceAnnualUsd: 290,
    features: ['Cloud Deployment', 'Auto SSL', 'Daily Backups', 'Uptime Monitoring', 'Email Support'],
    color: 'from-slate-600 to-slate-700',
    accent: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
  },
  growth: {
    name: 'Growth',
    priceMonthlyKes: 7700,
    priceMonthlyUsd: 59,
    priceAnnualKes: 77000,
    priceAnnualUsd: 590,
    features: ['Everything in Starter', 'WAF Security', 'Malware Scanning', '30-Min P1 Response', 'Monthly Reports'],
    color: 'from-blue-600 to-blue-700',
    accent: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  business: {
    name: 'Business Plan',
    priceMonthlyKes: 15500,
    priceMonthlyUsd: 119,
    priceAnnualKes: 155000,
    priceAnnualUsd: 1190,
    features: ['Unlimited Content Updates', 'Staging Environment', 'Core Web Vitals', '15-Min P1 Response'],
    color: 'from-indigo-600 to-blue-700',
    accent: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
  },
};

const DEFAULT_PLAN = 'care-business';

// Mirrors the seeded Plan rows (prisma/seed.ts) — the API prices server-side
// from these IDs; the client never sends amounts.
const PLAN_ID_BY_SLUG: Record<string, string> = {
  'care-essential': '55555555-5555-4555-8555-555555555555',
  'care-business': '66666666-6666-4666-8666-666666666666',
  'care-professional': '77777777-7777-4777-8777-777777777777',
  starter: '11111111-1111-4111-8111-111111111111',
  growth: '22222222-2222-4222-8222-222222222222',
  business: '33333333-3333-4333-8333-333333333333',
  enterprise: '44444444-4444-4444-8444-444444444444',
};

type PayTab = 'MPESA' | 'CARD' | 'WIRE';
type Cycle = 'MONTHLY' | 'ANNUAL';

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const pendingPlan = useAuthStore(s => s.pendingPlan);
  const clearSession = useAuthStore(s => s.clearSession);

  const planSlug = pendingPlan || DEFAULT_PLAN;
  const plan = PLAN_META[planSlug] || PLAN_META[DEFAULT_PLAN];

  const { marketCode } = useMarketPreference();

  // Authenticated billing endpoints live on the NestJS API (JWT-guarded,
  // server-priced). Onboarding is a logged-in flow — reuse the session token.
  const accessToken = useAuthStore(s => s.accessToken);
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'https://api.bazionweb.com/api/v1').replace(/\/$/, '');
  const [activeMarket, setActiveMarket] = useState<'KE' | 'GLOBAL'>('GLOBAL');

  const [tab, setTab] = useState<PayTab>('MPESA');
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bazion_locked_proposal');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.marketCode === 'KE' || parsed.marketCode === 'GLOBAL') {
          setActiveMarket(parsed.marketCode);
          if (parsed.marketCode === 'GLOBAL') setTab('CARD');
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setActiveMarket(marketCode === 'KE' ? 'KE' : 'GLOBAL');
    if (marketCode !== 'KE') setTab('CARD');
  }, [marketCode]);

  const isKenya = activeMarket === 'KE';
  const displayCurrency = isKenya ? 'KES' : 'USD';
  const displayAmount = cycle === 'ANNUAL'
    ? (isKenya ? plan.priceAnnualKes : plan.priceAnnualUsd)
    : (isKenya ? plan.priceMonthlyKes : plan.priceMonthlyUsd);

  async function handleMpesa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    if (!accessToken) {
      setFeedback({ type: 'error', msg: 'Your session expired — please sign in again to pay.' });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/invoices/subscribe/intasend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          planId: PLAN_ID_BY_SLUG[planSlug] || PLAN_ID_BY_SLUG[DEFAULT_PLAN],
          billingCycle: cycle,
          paymentMethod: 'MPESA',
          mpesaPhoneNumber: phone.replace(/[^0-9+]/g, ''),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment initialization failed');
      setFeedback({ type: 'info', msg: `M-Pesa prompt sent for invoice ${data.invoiceNumber || data.data?.invoiceNumber || 'your order'}. Check your phone and enter your PIN.` });
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Payment failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCard() {
    setLoading(true);
    setFeedback(null);
    if (!accessToken) {
      setFeedback({ type: 'error', msg: 'Your session expired — please sign in again to pay.' });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/invoices/subscribe/paystack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          planId: PLAN_ID_BY_SLUG[planSlug] || PLAN_ID_BY_SLUG[DEFAULT_PLAN],
          billingCycle: cycle,
          currency: isKenya ? 'KES' : 'USD',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Card gateway error');
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      throw new Error('Payment gateway did not return a checkout URL');
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Card gateway error' });
      setLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    router.push('/portal/login');
  }

  useEffect(() => {
    if (!user) {
      router.replace('/portal/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100">
      {/* ── Top Nav ─────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo variant="dark" markClassName="h-8 w-auto" />
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-full font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Account Active · Subscription Pending
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-16">
        {/* ── Welcome hero ──────────────────────────────── */}
        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6]">Welcome, {user.firstName}!</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
            Activate your subscription
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-xl">
            Your client account is ready. One final step — choose your payment method to activate the <strong className="text-white">{plan.name}</strong> plan and gain full access to your dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── Left: Plan Summary ─────────────────────── */}
          <div className="lg:col-span-4 space-y-4">
            {/* Plan card */}
            <div className={`rounded-2xl p-6 bg-gradient-to-br ${plan.color} relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Your Plan</span>
                    <h2 className="text-xl font-extrabold text-white">{plan.name}</h2>
                  </div>
                  <Star className="w-5 h-5 text-white/40" />
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-black text-white">
                    {displayCurrency} {displayAmount.toLocaleString()}
                  </span>
                  <span className="text-white/60 text-sm ml-1">/{cycle === 'MONTHLY' ? 'mo' : 'yr'}</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-white/85">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white/60 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Billing cycle switcher */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">Billing Frequency</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCycle('MONTHLY')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                    cycle === 'MONTHLY'
                      ? 'bg-[#2563EB] border-[#2563EB] text-white shadow'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCycle('ANNUAL')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                    cycle === 'ANNUAL'
                      ? 'bg-[#2563EB] border-[#2563EB] text-white shadow'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  Annual
                  <span className="text-[9px] text-emerald-300 font-extrabold bg-emerald-900/60 px-1.5 py-0.5 rounded">-10%</span>
                </button>
              </div>
            </div>

            {/* Change plan link */}
            <button
              onClick={() => router.push('/pricing')}
              className="w-full text-xs text-slate-400 hover:text-[#14B8A6] transition-colors flex items-center justify-center gap-1.5 py-2"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Compare all plans and change selection
            </button>

            {/* Security note */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              256-bit SSL · Paystack PCI-DSS L1 · M-Pesa STK Push
            </div>
          </div>

          {/* ── Right: Payment Methods ──────────────────── */}
          <div className="lg:col-span-8">
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Gateway</span>
                <h2 className="text-xl font-bold text-white mt-0.5">Choose payment method</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Paying <span className="font-semibold text-white">
                    {displayCurrency} {displayAmount.toLocaleString()} {cycle === 'ANNUAL' ? '/ year' : '/ month'}
                  </span>
                  <span className="text-slate-500 ml-2">· {isKenya ? 'Kenya Market Price Book (KE-2026-v1)' : 'International Price Book (GLOBAL-2026-v1)'}</span>
                </p>
              </div>

              {/* Payment method tabs */}
              <div className={`grid ${isKenya ? 'grid-cols-3' : 'grid-cols-2'} gap-0 border-b border-slate-800`}>
                {(
                  isKenya
                    ? [
                        { id: 'MPESA', label: 'M-Pesa', sub: 'Instant STK Push', Icon: Smartphone },
                        { id: 'CARD', label: 'Local Card', sub: 'Visa / Mastercard', Icon: CreditCard },
                        { id: 'WIRE', label: 'Bank Wire', sub: 'Kenyan RTGS / EFT', Icon: Building2 },
                      ]
                    : [
                        { id: 'CARD', label: 'International Card', sub: 'Paystack / Cards', Icon: CreditCard },
                        { id: 'WIRE', label: 'International Wire', sub: 'Wise / SWIFT Receiving', Icon: Building2 },
                      ]
                ).map(({ id, label, sub, Icon }) => (
                  <button
                    key={id}
                    onClick={() => { setTab(id as PayTab); setFeedback(null); }}
                    className={`flex flex-col items-center gap-1 py-4 px-3 text-xs font-semibold transition-all border-b-2 ${
                      tab === id
                        ? 'border-[#2563EB] text-white bg-[#2563EB]/5'
                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                    <span className="text-[10px] font-normal opacity-60">{sub}</span>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-6">
                {/* Feedback */}
                {feedback && (
                  <div className={`mb-5 p-3.5 rounded-xl flex items-start gap-3 text-xs border ${
                    feedback.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                    feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                    'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  }`}>
                    {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                    {feedback.msg}
                  </div>
                )}

                {/* M-Pesa Tab */}
                {tab === 'MPESA' && (
                  <form onSubmit={handleMpesa} className="space-y-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-emerald-400">Safaricom M-Pesa STK Push</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">You&apos;ll receive a PIN prompt on your phone within 5 seconds</p>
                      </div>
                      <span className="text-lg font-black text-emerald-400 font-mono">{displayCurrency} {displayAmount.toLocaleString()}</span>
                    </div>

                    <div>
                      <label htmlFor="onb-email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Billing Email</label>
                      <input
                        id="onb-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="billing@yourcompany.com"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label htmlFor="onb-phone" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Safaricom Phone Number <span className="text-slate-600 font-normal normal-case">(M-Pesa registered)</span>
                      </label>
                      <input
                        id="onb-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="0712 345 678"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !phone}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-950/40 text-sm"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Smartphone className="w-4 h-4" /> Send M-Pesa PIN Request <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
                )}

                {/* Card Tab */}
                {tab === 'CARD' && (
                  <div className="space-y-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-blue-400">International Card (Paystack)</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Visa, Mastercard & Amex · PCI-DSS Level 1</p>
                      </div>
                      <span className="text-lg font-black text-blue-300 font-mono">{displayCurrency} {displayAmount.toLocaleString()}</span>
                    </div>

                    <div>
                      <label htmlFor="card-email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Billing Email</label>
                      <input
                        id="card-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="billing@yourcompany.com"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 leading-relaxed">
                      You will be redirected to the secure Paystack card gateway. Your card details are tokenized and never stored on our servers.
                    </div>

                    <button
                      onClick={handleCard}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-950/40 text-sm"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Proceed to Card Gateway <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                )}

                {/* Wire Tab */}
                {tab === 'WIRE' && (
                  <div className="space-y-4">
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                      <p className="text-xs font-semibold text-purple-400 mb-1">Corporate Wire / B2B Invoice</p>
                      <p className="text-[11px] text-slate-400">For companies requiring official invoices, LPO or PO-based payments. Our team will process your activation within 24 hours of payment confirmation.</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
                      {[
                        { label: 'Beneficiary', value: 'BazionWeb Ltd' },
                        { label: 'Bank', value: 'Equity Bank Kenya · Nairobi Branch' },
                        { label: 'Account Number', value: '0123456789012' },
                        { label: 'SWIFT / BIC', value: 'EQBLKENA' },
                        { label: 'Payment Reference', value: `BWSUB-${Date.now().toString(36).toUpperCase()}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                          <span className="text-slate-500">{label}</span>
                          <span className="font-mono font-bold text-white">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                      After completing the wire transfer, email your remittance advice to <strong>billing@bazionweb.com</strong> referencing your payment code above.
                    </div>

                    <Link
                      href="/contact"
                      className="w-full flex items-center justify-center gap-2 border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 font-semibold py-3.5 rounded-xl transition-all text-sm"
                    >
                      <Building2 className="w-4 h-4" />
                      Contact us to request a formal LPO
                    </Link>
                  </div>
                )}

                {/* Trust row */}
                <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure checkout</span>
                  <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-blue-500" /> 256-bit SSL</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-teal-500" /> Cancel anytime</span>
                </div>
              </div>
            </div>

            {/* Locked-dashboard notice */}
            <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-start gap-3 text-xs text-slate-500">
              <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <span>
                Your dashboard unlocks immediately after payment is confirmed.{' '}
                Need to pay by invoice?{' '}
                <Link href="/contact" className="text-[#14B8A6] hover:underline font-semibold">
                  Contact our team →
                </Link>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

