'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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
import { resolveApiV1Base } from '@/lib/api-base';
import { useAuthStore } from '@/store/auth.store';
import { DEFAULT_PLAN_SLUG, planMarketing, usePlans } from '@/lib/plans';
import { useCartStore, cartTotal } from '@/lib/cart';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { isTrustedCheckoutUrl, normalizeKenyanPhoneNumber } from '@/lib/utils';


interface CheckoutProps {
  initialPlanSlug?: string;
  initialCycle?: 'MONTHLY' | 'ANNUAL';
  token?: string;
  /** When arriving from /cart, show the full cart and bill its add-ons with the invoice. */
  cartMode?: boolean;
}

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
  token: tokenProp = '',
  cartMode = false,
}: CheckoutProps) {
  // Session-aware checkout: the public /checkout page doesn't pass a token prop,
  // but a signed-in visitor still carries one in the auth store. Pick it up so
  // M-Pesa / corporate rails don't refuse paying customers with "Please sign in".
  const storeToken = useAuthStore(s => s.accessToken);
  const storeUser = useAuthStore(s => s.user);
  const token = tokenProp || storeToken || '';
  const { marketCode } = useMarketPreference();
  const isKe = marketCode === 'KE';
  const { plans, bySlug, loading: plansLoading, error: plansError } = usePlans();
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>(initialPlanSlug);
  const [activeTab, setActiveTab] = useState<PaymentTab>(isKe ? 'MPESA' : 'CARD');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>(initialCycle);

  // Sync default tab if market resolves to international after initial load
  useEffect(() => {
    if (!isKe && activeTab === 'MPESA') {
      setActiveTab('CARD');
    }
  }, [isKe, activeTab]);

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [poNumber, setPoNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [wiseAccount, setWiseAccount] = useState<WiseBankAccount | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paymentAttempt, setPaymentAttempt] = useState<{ trackingId: string; invoiceNumber: string } | null>(null);
  const apiBase = resolveApiV1Base();

  // Cart mode: the plan drives the subscription; catalog extras (hosting,
  // add-ons) are sent as identity-only lines and priced server-side.
  const cartItems = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clear);
  const cartExtras = cartMode
    ? cartItems
        .filter((i) => i.kind === 'CATALOG')
        .map((i) => ({ productId: i.id, qty: i.qty }))
    : [];
  const cartExtrasTotal = cartMode ? cartTotal(cartItems.filter((i) => i.kind === 'CATALOG')) : 0;

  const paymentStatus = useQuery({
    queryKey: ['checkout-payment-status', paymentAttempt?.trackingId],
    enabled: Boolean(paymentAttempt?.trackingId),
    queryFn: async () => {
      const response = await fetch(`${apiBase}/invoices/payments/${encodeURIComponent(paymentAttempt!.trackingId)}/status`, {
        cache: 'no-store',
      });
      const envelope = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(envelope?.message || 'Could not refresh payment status.');
      return envelope?.data ?? envelope;
    },
    refetchInterval: (query) => {
      const status = String(query.state.data?.status || '').toUpperCase();
      if (status === 'SUCCESS' || status === 'FAILED' || query.state.dataUpdateCount >= 18 || query.state.fetchFailureCount >= 3) return false;
      return 5000;
    },
    refetchIntervalInBackground: false,
    retry: 1,
  });

  // Empty the cart once the payment is confirmed — the order now lives as an invoice.
  useEffect(() => {
    if (cartMode && paymentAttempt && paymentStatus.data?.status === 'SUCCESS') {
      clearCart();
    }
  }, [cartMode, paymentAttempt, paymentStatus.data?.status, clearCart]);

  // Prefill the billing email from the session (once) — users jumping here from
  // the portal shouldn't retype it.
  useEffect(() => {
    if (storeUser?.email) {
      setEmail(prev => prev || storeUser.email);
    }
  }, [storeUser]);

  // Keep the selected slug valid as the server catalog loads or changes.
  useEffect(() => {
    if (!plans.length || bySlug[selectedPlanSlug]) return;
    setSelectedPlanSlug(bySlug[DEFAULT_PLAN_SLUG] ? DEFAULT_PLAN_SLUG : plans[0].slug);
  }, [plans, bySlug, selectedPlanSlug]);

  const currentPlan = bySlug[selectedPlanSlug] ?? bySlug[DEFAULT_PLAN_SLUG] ?? plans[0];
  const marketing = currentPlan ? planMarketing(currentPlan.slug) : null;
  const annualDiscountPct = currentPlan?.annualDiscountPct ?? 0;

  if (plansLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto py-24 flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
        <span className="text-sm">Loading live plan catalog…</span>
      </div>
    );
  }

  if (plansError || !currentPlan || !marketing) {
    return (
      <div className="w-full max-w-lg mx-auto my-16 p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
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
    );
  }

  const planPriceKes = billingCycle === 'ANNUAL' ? currentPlan.priceAnnualKes : currentPlan.priceMonthlyKes;
  const planPriceUsd = billingCycle === 'ANNUAL' ? currentPlan.priceAnnual : currentPlan.priceMonthly;
  const derivedRate = currentPlan.priceMonthly > 0 ? currentPlan.priceMonthlyKes / currentPlan.priceMonthly : 130;
  const totalDueKes = planPriceKes + (cartMode ? cartExtrasTotal : 0);
  const totalDueUsd = planPriceUsd + (cartMode && derivedRate > 0 ? Math.round(cartExtrasTotal / derivedRate) : 0);
  const currentPriceKes = totalDueKes;
  const currentPriceUsd = totalDueUsd;

  const copyToClipboard = (text: string, fieldName: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Browser-level network failure (API down / CORS blocked) surfaces as a bare
  // "Failed to fetch" — replace it with an actionable message instead.
  const paymentFailedMessage = (err: unknown, fallback: string): string => {
    if (err instanceof TypeError && /failed to fetch/i.test(err?.message ?? '')) {
      return `Payment server unreachable (${apiBase}). Ensure the BazionWeb API is running and matches NEXT_PUBLIC_API_URL, then retry.`;
    }
    return (err instanceof Error ? err.message : null) || fallback;
  };

  // M-Pesa STK via Paystack (KES) — server-side pricing, phone only.
  const handleMpesaPay = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizeKenyanPhoneNumber(phone);
    if (!normalizedPhone) {
      setFeedback({
        type: 'error',
        message: 'Please enter a valid Kenyan mobile number (e.g. 0712 345 678, 0110 123 456, or +254 7XX XXX XXX).',
      });
      return;
    }

    if (!token) {
      // Guest pay-first: no account needed. Email becomes the claim identity;
      // the invoice is created server-side and the webhook activates it.
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setFeedback({ type: 'error', message: 'Enter a valid billing email — the PIN prompt, receipt, and account-claim link all go to that address.' });
        return;
      }
      setLoading(true);
      setFeedback(null);
      try {
        const res = await fetch(`${apiBase}/invoices/guest/subscribe/mpesa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: currentPlan.id,
            billingCycle,
            email: cleanEmail,
            mpesaPhoneNumber: normalizedPhone,
            ...(cartExtras.length ? { extras: cartExtras } : {}),
          }),
        });
        const envelope = await res.json();
        const data = envelope?.data ?? envelope;
        if (!res.ok) throw new Error(data.message || 'M-Pesa initialization failed');
        if (!data.trackingId) throw new Error('The payment prompt was not created. Please retry.');
        setPaymentAttempt({ trackingId: String(data.trackingId), invoiceNumber: String(data.invoiceNumber || '') });
        setFeedback({
          type: 'info',
          message: `${data.message || 'M-Pesa prompt sent!'} Check your handset and enter your PIN.`,
        });
      } catch (err: unknown) {
        setFeedback({ type: 'error', message: paymentFailedMessage(err, 'M-Pesa payment request failed') });
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`${apiBase}/invoices/subscribe/mpesa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          planId: currentPlan.id,
          billingCycle,
          mpesaPhoneNumber: normalizedPhone,
          ...(cartExtras.length ? { extras: cartExtras } : {}),
        }),
      });


      const envelope = await res.json();
      const data = envelope?.data ?? envelope;
      if (!res.ok) throw new Error(data.message || 'M-Pesa initialization failed');
      if (!data.trackingId) throw new Error('The payment prompt was not created. Please retry.');
      setPaymentAttempt({ trackingId: String(data.trackingId), invoiceNumber: String(data.invoiceNumber || '') });
      setFeedback({
        type: 'info',
        message: `${data.message || 'M-Pesa prompt sent!'} Check your handset and enter your PIN.`,
      });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: paymentFailedMessage(err, 'Payment request failed') });
    } finally {
      setLoading(false);
    }
  };

  // Card via Paystack (KES/USD) — pay-first. Signed-in users pay through the
  // authenticated endpoint; guests pay through the public guest endpoint.
  // Both create an invoice and are activated by the Paystack webhook.
  const handleCardPay = async () => {
    // Note: window.location replaces the page on success — no setLoading reset needed on the happy path.
    setLoading(true);
    setFeedback(null);

    try {
      if (token) {
        const res = await fetch(`${apiBase}/invoices/subscribe/paystack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            planId: currentPlan.id,
            billingCycle,
            currency: isKe ? 'KES' : 'USD',
            ...(email ? { email } : {}),
            ...(cartExtras.length ? { extras: cartExtras } : {}),
          }),
        });
        const body = await res.json().catch(() => ({}));
        const data = body?.data ?? body;
        if (!res.ok) throw new Error(data.message || body.message || 'Card gateway initialization failed');
        if (data.checkoutUrl && isTrustedCheckoutUrl(data.checkoutUrl)) {
          window.location.href = data.checkoutUrl;
          return;
        }
        throw new Error('Payment gateway returned an invalid or untrusted checkout URL');
      }

      // Guest checkout — pay first, claim the account after success.
      const cleanEmail = email.trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Please enter a valid billing email — access claim and receipts go to that address.');
      }
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error('Please add your first and last name so we can set up your account.');
      }

      const res = await fetch(`${apiBase}/invoices/guest/subscribe/paystack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: currentPlan.id,
          billingCycle,
          currency: isKe ? 'KES' : 'USD',
          email: cleanEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          ...(cartExtras.length ? { extras: cartExtras } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'Card gateway initialization failed');
      if (data.checkoutUrl && isTrustedCheckoutUrl(data.checkoutUrl)) {
        window.location.href = data.checkoutUrl;
        return;
      }
      throw new Error('Payment gateway returned an invalid or untrusted checkout URL');
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: paymentFailedMessage(err, 'Card gateway error') });
      setLoading(false);
    }

  };

  // Manual B2B bank transfer (Wise = payouts/invoice links only — no virtual accounts in KE).
  const handleWiseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!token) {
      // Guest invoice: corporate wire intent without an account. Activation
      // stays manual (our team confirms the wire after the transfer lands).
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setFeedback({ type: 'error', message: 'Enter a valid billing email — the invoice and claim link go to that address.' });
        return;
      }
      setLoading(true);
      setFeedback(null);
      try {
        const res = await fetch(`${apiBase}/invoices/guest/corporate-invoice/bank-transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: currentPlan.id,
            billingCycle,
            currency,
            email: cleanEmail,
            purchaseOrderNumber: poNumber || undefined,
          }),
        });
        const body = await res.json().catch(() => ({}));
        const data = body?.data ?? body;
        if (!res.ok) throw new Error(data.message || body.message || 'Invoice generation failed');
        setWiseAccount(data);
        setFeedback({
          type: 'success',
          message: `Corporate invoice ${data.invoiceNumber} ready. Wire to ${data.bankTransferDetails?.beneficiary} with reference ${data.paymentReference}. After we confirm the transfer, claim the dashboard at /portal/claim with ${cleanEmail} — we will email a one-time link to verify it is yours.`,
        });
      } catch (err: unknown) {
        setFeedback({ type: 'error', message: paymentFailedMessage(err, 'Corporate invoice generation failed') });
      } finally {
        setLoading(false);
      }
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

      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'Invoice generation failed');

      setWiseAccount(data);
      setFeedback({
        type: 'success',
        message: `Corporate invoice ${data.invoiceNumber} ready. Wire to ${data.bankTransferDetails?.beneficiary} with reference ${data.paymentReference}. Admin confirms on receipt.`,
      });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: paymentFailedMessage(err, 'Corporate invoice generation failed') });
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
              {plans.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setSelectedPlanSlug(p.slug)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    currentPlan.slug === p.slug
                      ? 'border-[#2563EB] bg-[#2563EB]/15 text-white font-semibold shadow-md'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">{p.name}</div>
                  <div className="text-xs text-slate-400">
                    {isKe
                      ? `KES ${(p.priceMonthlyKes ?? 0).toLocaleString()}/mo`
                      : `$${p.priceMonthly}/mo`}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart lines from /store — extras are priced server-side on the invoice */}
          {cartMode && cartItems.some((i) => i.kind === 'CATALOG') && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cart add-ons</span>
                <Link href="/cart" className="text-[11px] font-semibold text-[#14B8A6] hover:text-teal-300">
                  Edit cart
                </Link>
              </div>
              <ul className="space-y-1.5">
                {cartItems
                  .filter((i) => i.kind === 'CATALOG')
                  .map((i) => (
                    <li key={i.key} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">
                        {i.name}
                        {i.qty > 1 ? ` x${i.qty}` : ''}
                      </span>
                      <span className="font-semibold text-white">
                        KES {(i.unitPrice * i.qty).toLocaleString()}
                      </span>
                    </li>
                  ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2 text-xs">
                <span className="font-semibold text-slate-300">Add-ons subtotal</span>
                <span className="font-bold text-white">KES {cartExtrasTotal.toLocaleString()}</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Added to your first invoice — final totals confirmed server-side.
              </p>
            </div>
          )}

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
                  Annual <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950 px-1 rounded">-{annualDiscountPct}%</span>
                </button>
              </div>
            </div>
          </div>

          {/* Included Features */}
          <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan Highlights</span>
            <ul className="space-y-2 text-xs text-slate-300">
              {marketing.features.map((f, idx) => (
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
              {isKe ? (
                <div className="text-2xl font-black text-white">
                  KES {currentPriceKes.toLocaleString()}
                </div>
              ) : (
                <div className="text-2xl font-black text-white">
                  ${currentPriceUsd.toLocaleString()} USD
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-400">
          <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>256-Bit SSL Encrypted Checkout. Backed by Paystack (M-Pesa STK Push + Global Cards).</span>
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
              <span>Corporate Wire</span>
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

          {paymentAttempt && (
            <div className="mb-5 rounded-xl border border-slate-700 bg-slate-900/70 p-4" role="status" aria-live="polite">
              {paymentStatus.data?.status === 'SUCCESS' ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-emerald-300">Payment confirmed</p>
                    <p className="mt-1 text-xs text-slate-300">Invoice {paymentAttempt.invoiceNumber} is paid. Continue to your workspace.</p>
                  </div>
                  <Link
                    href={token ? '/portal' : `/portal/claim?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                    className="btn-primary justify-center px-4 py-2.5 text-xs"
                  >
                    {token ? 'Open dashboard' : 'Set up dashboard access'} <ArrowRight className="size-4" />
                  </Link>
                </div>
              ) : paymentStatus.data?.status === 'FAILED' ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-rose-300">Payment was not completed</p>
                    <p className="mt-1 text-xs text-slate-400">You can safely retry the M-Pesa prompt.</p>
                  </div>
                  <button type="button" onClick={() => { setPaymentAttempt(null); setFeedback(null); }} className="text-xs font-bold text-white underline">Try again</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Waiting for M-Pesa confirmation</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {paymentStatus.isError
                        ? 'We could not refresh automatically. Do not pay again while checking this request.'
                        : 'Keep this page open; we are checking automatically. Do not submit another payment.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void paymentStatus.refetch()}
                    disabled={paymentStatus.isFetching}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50"
                  >
                    {paymentStatus.isFetching && <Loader2 className="size-3.5 animate-spin" />}
                    Check status
                  </button>
                </div>
              )}
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
                  pattern="^(?:254|\+254|0)?(7|1)[0-9]{8}$"
                  title="Enter a valid Kenyan mobile number (e.g. 0712 345 678, 0110 123 456, or +254 7XX XXX XXX)"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Format: 07XX XXX XXX or 01XX XXX XXX (Safaricom / Airtel M-Pesa). You will receive an STK Push PIN prompt.
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

          {/* Tab 2: Credit / Debit Card (Paystack) */}
          {activeTab === 'CARD' && (
            <div className="space-y-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 text-xs font-medium">Card charge ({isKe ? 'billed in KES' : 'billed in USD'})</span>
                <span className="text-xl font-bold text-white font-mono">
                  {isKe
                    ? `KES ${currentPriceKes.toLocaleString()}`
                    : `$${currentPriceUsd.toLocaleString()} USD`}
                </span>
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
                {email.trim() !== email && (
                  <span className="text-[11px] text-amber-400 block -mt-2 mb-2">Auto-trimming spaces…</span>
                )}
              </div>

              {!token && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      autoComplete="given-name"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Wanjiku"
                      autoComplete="family-name"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              {!token && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-200 text-xs leading-relaxed">
                   Pay first — <strong>no account needed yet</strong>. Once your payment lands, we email a
                   one-time claim link to the address above. Open it to set a password and unlock the dashboard;
                   knowing the email alone is never enough.
                </div>
              )}

              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                Supports Visa, Mastercard, and American Express. Your card details are tokenized securely with Paystack PCI-DSS Level 1 compliance.
                Cards are charged in KES — international card issuers convert automatically.
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
              {!token && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-200 text-xs leading-relaxed">
                   No account needed yet — enter your billing email and we&apos;ll generate the invoice. After our team
                   confirms your wire, claim the dashboard at <strong>/portal/claim</strong>; we email a one-time
                   link to verify that address first.
                </div>
              )}
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
                    <span className="text-xl font-bold text-purple-300 font-mono">${currentPriceUsd.toLocaleString()} USD</span>
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
