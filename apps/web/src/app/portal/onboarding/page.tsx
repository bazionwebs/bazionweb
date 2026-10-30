'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  CreditCard,
  Smartphone,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Sparkles,
  Lock,
  LogOut,
  AlertCircle,
  ChevronRight,
  Star,
  RefreshCw,
  Building2,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { resolveApiV1Base } from '@/lib/api-base';
import { planMarketing, usePlans } from '@/lib/plans';

const DEFAULT_ONBOARDING_PLAN = 'care-business';

type PayTab = 'MPESA' | 'CARD' | 'WIRE';
type Cycle = 'MONTHLY' | 'ANNUAL';

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const pendingPlan = useAuthStore(s => s.pendingPlan);
  const setPendingPlan = useAuthStore(s => s.setPendingPlan);
  const clearSession = useAuthStore(s => s.clearSession);
  const setSubscriptionStatus = useAuthStore(s => s.setSubscriptionStatus);
  const storeHydrated = useAuthStore(s => s._hasHydrated);
  const hasHydrated = storeHydrated || (typeof window !== 'undefined' && !!useAuthStore.persist?.hasHydrated?.());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { plans, bySlug, loading: plansLoading, error: plansError } = usePlans();
  const pendingSlug = pendingPlan || DEFAULT_ONBOARDING_PLAN;
  const plan = bySlug[pendingSlug] ?? bySlug[DEFAULT_ONBOARDING_PLAN] ?? plans[0];
  const marketing = plan ? planMarketing(plan.slug) : null;

  const { marketCode } = useMarketPreference();

  // Authenticated billing endpoints live on the NestJS API (JWT-guarded,
  // server-priced). Onboarding is a logged-in flow — reuse the session token.
  const accessToken = useAuthStore(s => s.accessToken);
  const apiBase = resolveApiV1Base();
  const [activeMarket, setActiveMarket] = useState<'KE' | 'GLOBAL'>('GLOBAL');

  const [tab, setTab] = useState<PayTab>('MPESA');
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [wireResult, setWireResult] = useState<{ invoiceNumber: string; amount: number; currency: string } | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [stkAttempt, setStkAttempt] = useState<{ trackingId: string; invoiceNumber: string } | null>(null);
  const [payStatus, setPayStatus] = useState<'IDLE' | 'AWAITING' | 'CONFIRMED' | 'FAILED'>('IDLE');
  const pollTriesRef = useRef(0);

  useEffect(() => {
    setActiveMarket(marketCode === 'KE' ? 'KE' : 'GLOBAL');
    if (marketCode !== 'KE') setTab('CARD');
  }, [marketCode]);

  const isKenya = activeMarket === 'KE';

  async function handleMpesa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    if (!plan) {
      setFeedback({ type: 'error', msg: 'Plans are still loading — try again in a moment.' });
      setLoading(false);
      return;
    }
    if (!accessToken) {
      setFeedback({ type: 'error', msg: 'Your session expired — please sign in again to pay.' });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/invoices/subscribe/mpesa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: cycle,
          mpesaPhoneNumber: phone.replace(/[^0-9+]/g, ''),
        }),
      });
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'Payment initialization failed');
      const trackingId = data.trackingId ?? body.trackingId;
      const invoiceNumber = String(data.invoiceNumber || body.invoiceNumber || 'your order');
      setFeedback({ type: 'info', msg: `M-Pesa prompt sent for invoice ${invoiceNumber}. Check your phone and enter your PIN.` });
      if (trackingId) {
        // Live sync: poll the settlement status so the dashboard unlocks the
        // moment the webhook confirms payment — no manual refresh needed.
        pollTriesRef.current = 0;
        setStkAttempt({ trackingId: String(trackingId), invoiceNumber });
        setPayStatus('AWAITING');
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Payment failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCard() {
    setLoading(true);
    setFeedback(null);
    if (!plan) {
      setFeedback({ type: 'error', msg: 'Plans are still loading — try again in a moment.' });
      setLoading(false);
      return;
    }
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
          planId: plan.id,
          billingCycle: cycle,
          currency: isKenya ? 'KES' : 'USD',
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'Card gateway error');
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

  async function handleWireInvoice(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    if (!plan || !accessToken) {
      setFeedback({ type: 'error', msg: 'Session or plan unavailable — please reload.' });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/invoices/corporate-invoice/bank-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: cycle,
          currency: isKenya ? 'KES' : 'USD',
          ...(poNumber.trim() ? { purchaseOrderNumber: poNumber.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'Could not generate corporate invoice');
      const inv = data.invoice ?? data;
      setWireResult({
        invoiceNumber: String(inv.invoiceNumber || data.invoiceNumber || 'Invoice'),
        amount: Number(inv.amount || data.amount || displayAmount),
        currency: String(inv.currency || displayCurrency),
      });
      queryClient.invalidateQueries({ queryKey: ['portal', 'invoices'] });
      setFeedback({
        type: 'success',
        msg: 'Official B2B bank-transfer invoice generated. Settle via EFT/RTGS using the reference below to unlock your workspace.',
      });
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Could not generate invoice' });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await authApi.logout().catch(() => undefined);
    clearSession();
    router.push('/portal/login');
  }

  // ── Payment settlement sync ─────────────────────────────────────────────
  // Poll the public payment-status endpoint while an M-Pesa STK attempt is
  // outstanding. On SUCCESS the webhook has already activated the
  // subscription, so flip the local entitlement cache and enter the portal.
  useEffect(() => {
    if (!stkAttempt || payStatus !== 'AWAITING') return;

    let cancelled = false;

    const poll = async () => {
      pollTriesRef.current += 1;
      try {
        const res = await fetch(
          `${apiBase}/invoices/payments/${encodeURIComponent(stkAttempt.trackingId)}/status`,
          { cache: 'no-store' },
        );
        const body = await res.json().catch(() => ({}));
        const payload = body?.data ?? body;
        const status = String(payload?.status || '').toUpperCase();

        if (cancelled) return;
        if (status === 'SUCCESS') {
          setPayStatus('CONFIRMED');
          setSubscriptionStatus('ACTIVE');
          queryClient.invalidateQueries({ queryKey: ['portal'] });
          setTimeout(() => router.replace('/portal'), 1200);
          return;
        }
        if (status === 'FAILED') {
          setPayStatus('FAILED');
          setFeedback({ type: 'error', msg: 'The M-Pesa prompt was not completed or failed. You can try again below.' });
          return;
        }
      } catch {
        // Transient network error — keep polling until the attempt budget runs out.
      }

      if (cancelled) return;
      // Give up after ~2 minutes; the client can retry or pay by card.
      if (pollTriesRef.current >= 40) {
        setPayStatus('FAILED');
        setFeedback({
          type: 'error',
          msg: 'We could not confirm the payment in time. If you entered your PIN, give the webhook a minute and reload — otherwise try again.',
        });
        return;
      }
      setTimeout(poll, 3000);
    };

    const timer = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [stkAttempt, payStatus, apiBase, queryClient, router, setSubscriptionStatus]);

  useEffect(() => {
    if (!hasHydrated && !mounted) return;
    if (!user) {
      router.replace('/portal/login');
      return;
    }
    // If the account already has an active subscription, take them straight to dashboard
    if (user.subscriptionStatus === 'ACTIVE') {
      router.replace('/portal');
    }
  }, [hasHydrated, mounted, user, router]);

  if ((!hasHydrated && !mounted) || !user) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-sm text-slate-400">Loading your workspace…</span>
        </div>
      </div>
    );
  }

  if (plansLoading) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-sm text-slate-400">Loading live plan catalog…</span>
        </div>
      </div>
    );
  }

  if (plansError || !plan || !marketing) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Plans are temporarily unavailable</p>
              <p className="mt-1 text-xs text-red-200/80">
                {plansError || 'The plan catalog is empty. Please try again in a moment.'}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-xs font-bold hover:bg-red-500/30"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayCurrency = isKenya ? 'KES' : 'USD';
  const displayAmount = cycle === 'ANNUAL'
    ? (isKenya ? plan.priceAnnualKes : plan.priceAnnual)
    : (isKenya ? plan.priceMonthlyKes : plan.priceMonthly);

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
            <div className={`rounded-2xl p-6 bg-gradient-to-br ${marketing.color} relative overflow-hidden`}>
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
                  {marketing.features.map((f, i) => (
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
                  <span className="text-[9px] text-emerald-300 font-extrabold bg-emerald-900/60 px-1.5 py-0.5 rounded">
                    -{plan.annualDiscountPct}%
                  </span>
                </button>
              </div>
            </div>

            {/* Inline Plan Switcher (stays inside onboarding — never bounces to public /pricing) */}
            <button
              type="button"
              onClick={() => setShowPlanPicker(v => !v)}
              className="w-full text-xs text-slate-300 hover:text-[#14B8A6] transition-colors flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/50"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPlanPicker ? 'rotate-90' : ''}`} />
              {showPlanPicker ? 'Hide plan comparison' : 'Compare all plans & switch selection'}
            </button>

            {showPlanPicker && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-2">
                {plans.map(candidate => {
                  const selected = candidate.id === plan.id;
                  const amt =
                    cycle === 'ANNUAL'
                      ? isKenya
                        ? candidate.priceAnnualKes
                        : candidate.priceAnnual
                      : isKenya
                        ? candidate.priceMonthlyKes
                        : candidate.priceMonthly;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => {
                        setPendingPlan(candidate.slug);
                        setWireResult(null);
                        setFeedback(null);
                        setShowPlanPicker(false);
                      }}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                        selected
                          ? 'border-[#2563EB] bg-[#2563EB]/15 text-white'
                          : 'border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{candidate.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {candidate.uptimeSla ? `${candidate.uptimeSla}% SLA` : candidate.tier}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-extrabold text-white">
                          {displayCurrency} {amt.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          /{cycle === 'ANNUAL' ? 'yr' : 'mo'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

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
                        { id: 'WIRE', label: 'B2B Invoice', sub: 'EFT / RTGS Wire', Icon: Building2 },
                      ]
                    : [
                        { id: 'CARD', label: 'International Card', sub: 'Paystack / Cards', Icon: CreditCard },
                        { id: 'WIRE', label: 'B2B Invoice', sub: 'Bank Wire / PO', Icon: Building2 },
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
                {/* Live settlement status — shown while an M-Pesa STK attempt is outstanding */}
                {payStatus === 'AWAITING' && stkAttempt && (
                  <div className="mb-5 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-blue-300">Awaiting M-Pesa confirmation…</p>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Invoice <span className="font-mono text-slate-300">{stkAttempt.invoiceNumber}</span> — enter your PIN on
                        your handset. This page unlocks your dashboard automatically the moment payment settles.
                      </p>
                    </div>
                  </div>
                )}

                {payStatus === 'CONFIRMED' && (
                  <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-emerald-400">Payment confirmed — subscription active!</p>
                      <p className="text-[11px] text-slate-400 mt-1">Opening your dashboard…</p>
                    </div>
                  </div>
                )}

                {payStatus === 'FAILED' && stkAttempt && (
                  <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                    <RefreshCw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-amber-400">Payment not confirmed yet</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Reference <span className="font-mono text-slate-300">{stkAttempt.trackingId}</span>. Retry the prompt
                        below or switch to card — do not pay twice for the same invoice.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setStkAttempt(null); setPayStatus('IDLE'); }}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30"
                      >
                        Dismiss &amp; retry
                      </button>
                    </div>
                  </div>
                )}

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
                      disabled={loading || !phone || payStatus === 'AWAITING'}
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

                {/* B2B Corporate Invoice Tab */}
                {tab === 'WIRE' && (
                  <form onSubmit={handleWireInvoice} className="space-y-4">
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-teal-300">Corporate Bank Wire / Proforma Invoice</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Official tax invoice for EFT, RTGS, or international SWIFT wire</p>
                      </div>
                      <span className="text-lg font-black text-teal-300 font-mono">{displayCurrency} {displayAmount.toLocaleString()}</span>
                    </div>

                    <div>
                      <label htmlFor="wire-po" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Purchase Order Number <span className="text-slate-600 font-normal normal-case">(Optional)</span>
                      </label>
                      <input
                        id="wire-po"
                        type="text"
                        value={poNumber}
                        onChange={e => setPoNumber(e.target.value)}
                        placeholder="e.g. PO-2026-042"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      />
                    </div>

                    {wireResult && (
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xs space-y-1.5 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Generated Invoice:</span>
                          <span className="font-mono font-bold text-white">{wireResult.invoiceNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Amount Due:</span>
                          <span className="font-bold text-emerald-400">{wireResult.currency} {wireResult.amount.toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all text-sm"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Building2 className="w-4 h-4" /> Generate Official B2B Invoice <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
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
                Need to pay by corporate wire?{' '}
                <button
                  type="button"
                  onClick={() => setTab('WIRE')}
                  className="text-[#14B8A6] hover:underline font-semibold"
                >
                  Generate a B2B invoice above →
                </button>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

