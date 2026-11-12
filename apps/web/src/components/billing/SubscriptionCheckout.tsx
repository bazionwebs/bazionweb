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
  Lock,
  KeyRound,
  Mail
} from 'lucide-react';
import { resolveApiV1Base, toCleanUrl } from '@/lib/api-base';
import { useAuthStore } from '@/store/auth.store';
import { DEFAULT_PLAN_SLUG, planMarketing, usePlans } from '@/lib/plans';
import { useCartStore } from '@/lib/cart';
import {
  getProductPrice,
  BILLING_CYCLES_META,
  calculatePlanCyclePrice,
  normalizeCatalogProductId,
} from '@/lib/priceBooks';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { isTrustedCheckoutUrl, normalizeKenyanPhoneNumber, sanitizeRedirectPath } from '@/lib/utils';

class CheckoutApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CheckoutApiError';
    this.code = code;
  }
}

export type CheckoutCycle =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUALLY'
  | 'ANNUAL'
  | 'BIENNIAL'
  | 'TRIENNIAL';

interface CheckoutProps {
  initialPlanSlug?: string;
  initialCycle?: CheckoutCycle | string;
  token?: string;
  /** When arriving from /cart, show the full cart and bill its add-ons with the invoice. */
  cartMode?: boolean;
}

type PaymentTab = 'MPESA' | 'CARD' | 'WISE';

export interface WiseBankAccount {
  status?: string;
  invoiceNumber: string;
  invoicePdfDownloadUrl?: string;
  invoicePdfLinkExpiresAt?: string;
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

/** Bundle tiers already carry managed hosting; care-only tiers require an explicit host-* line. */
const BUNDLE_PLAN_SLUGS = new Set(['starter', 'growth', 'business', 'enterprise']);

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
  // Cart mode: catalog extras (website, domain, hosting, add-ons) are sent as
  // identity-only lines and priced server-side. Step 4 (Care Plan) is OPTIONAL.
  const cartItems = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clear);
  const removeCartItem = useCartStore((s) => s.remove);
  const cartPlanItem = cartMode ? cartItems.find((i) => i.kind === 'PLAN') : undefined;
  const catalogCartItems = React.useMemo(
    () => (cartMode ? cartItems.filter((i) => i.kind === 'CATALOG') : []),
    [cartMode, cartItems],
  );
  const cartExtras = React.useMemo(() => {
    const merged = new Map<string, number>();
    for (const item of catalogCartItems) {
      const canonicalId = normalizeCatalogProductId(item.id);
      if (!canonicalId) continue;
      merged.set(canonicalId, (merged.get(canonicalId) || 0) + item.qty);
    }
    return Array.from(merged.entries()).map(([productId, qty]) => ({ productId, qty }));
  }, [catalogCartItems]);
  const hasWebsiteOrDomainInCart = catalogCartItems.some((i) => {
    const canonicalId = normalizeCatalogProductId(i.id);
    return (
      canonicalId.startsWith('website-') ||
      canonicalId.startsWith('ecommerce-') ||
      canonicalId.startsWith('domain-') ||
      canonicalId.startsWith('custom-tier-') ||
      canonicalId.startsWith('service-admin-hub-')
    );
  });

  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>(() => {
    if (cartMode) {
      if (cartPlanItem?.id) return cartPlanItem.id;
      if (!initialPlanSlug || initialPlanSlug === 'none' || hasWebsiteOrDomainInCart) {
        return 'none';
      }
      return initialPlanSlug;
    }
    return initialPlanSlug || DEFAULT_PLAN_SLUG;
  });
  const [showCareSelector, setShowCareSelector] = useState<boolean>(!cartMode);
  const [activeTab, setActiveTab] = useState<PaymentTab>(isKe ? 'MPESA' : 'CARD');
  const [billingCycle, setBillingCycle] = useState<CheckoutCycle>(() => {
    const raw = String(initialCycle || 'MONTHLY').toUpperCase().replace('-', '_');
    const match = BILLING_CYCLES_META.find(m => m.enumValue === raw || m.cycle === initialCycle?.toLowerCase());
    return (match?.enumValue || 'MONTHLY') as CheckoutCycle;
  });

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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string; code?: string } | null>(null);
  const [inlineMagicSending, setInlineMagicSending] = useState(false);
  const [inlineMagicSentTo, setInlineMagicSentTo] = useState<string | null>(null);
  const [inlineMagicError, setInlineMagicError] = useState<string | null>(null);
  const [wiseAccount, setWiseAccount] = useState<WiseBankAccount | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paymentAttempt, setPaymentAttempt] = useState<{ trackingId: string; invoiceNumber: string } | null>(null);
  const apiBase = resolveApiV1Base();

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

  // Clear ACCOUNT_EXISTS gate automatically once authenticated or when billing email is edited.
  useEffect(() => {
    if (token && (feedback?.code === 'ACCOUNT_EXISTS' || /account already exists/i.test(feedback?.message || ''))) {
      setFeedback(null);
      setInlineMagicSentTo(null);
      setInlineMagicError(null);
    }
  }, [token, feedback?.code, feedback?.message]);

  const prevEmailRef = React.useRef(email);
  useEffect(() => {
    if (prevEmailRef.current !== email) {
      prevEmailRef.current = email;
      setInlineMagicSentTo(null);
      setInlineMagicError(null);
      if (feedback?.code === 'ACCOUNT_EXISTS' || /account already exists/i.test(feedback?.message || '')) {
        setFeedback(null);
      }
    }
  }, [email, feedback?.code, feedback?.message]);

  // Keep the selected slug valid as the server catalog loads or changes.
  useEffect(() => {
    if (selectedPlanSlug === 'none') return;
    if (!plans.length || bySlug[selectedPlanSlug]) return;
    setSelectedPlanSlug(bySlug[DEFAULT_PLAN_SLUG] ? DEFAULT_PLAN_SLUG : plans[0].slug);
  }, [plans, bySlug, selectedPlanSlug]);

  // Cart mode: sync with the Care Plan in the cart if present, or 'none' if the
  // user built their stack without selecting an optional Step 4 Care Plan.
  useEffect(() => {
    if (!cartMode || plansLoading) return;
    if (cartPlanItem) {
      if (bySlug[cartPlanItem.id] && selectedPlanSlug !== cartPlanItem.id) {
        setSelectedPlanSlug(cartPlanItem.id);
      }
      if (cartPlanItem.cycle) {
        const raw = String(cartPlanItem.cycle).toUpperCase().replace('-', '_');
        const match = BILLING_CYCLES_META.find(
          (m) => m.enumValue === raw || m.cycle === cartPlanItem.cycle.toLowerCase(),
        );
        if (match && match.enumValue !== billingCycle) {
          setBillingCycle(match.enumValue as CheckoutCycle);
        }
      }
    } else if (!initialPlanSlug || initialPlanSlug === 'none' || hasWebsiteOrDomainInCart) {
      if (selectedPlanSlug !== 'none') {
        setSelectedPlanSlug('none');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartMode, cartPlanItem?.id, cartPlanItem?.cycle, plansLoading, bySlug, hasWebsiteOrDomainInCart]);

  const hasCarePlan = selectedPlanSlug !== 'none';
  const currentPlan = bySlug[selectedPlanSlug] ?? bySlug[DEFAULT_PLAN_SLUG] ?? plans[0];
  const effectivePlanId = hasCarePlan && currentPlan ? currentPlan.id : 'none';
  const marketing = currentPlan ? planMarketing(currentPlan.slug) : null;

  // Mandatory stack (cart mode): hosting must exist — either included in a bundle
  // tier or bought as a host-* line. Care plans (Step 4) are optional.
  const hostingIncludedInPlan = hasCarePlan && BUNDLE_PLAN_SLUGS.has(currentPlan?.slug ?? '');
  const hostingInCart = catalogCartItems.some((i) => i.id.startsWith('host-'));
  const hostingMissing = cartMode && !hostingInCart && !hostingIncludedInPlan;
  const paymentBlocked = hostingMissing || (!hasCarePlan && catalogCartItems.length === 0);

  if (plansLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto py-24 flex flex-col items-center gap-3 text-slate-500 bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
        <span className="text-sm font-medium">Loading live checkout catalog…</span>
      </div>
    );
  }

  if (plansError || (hasCarePlan && (!currentPlan || !marketing))) {
    return (
      <div className="w-full max-w-lg mx-auto my-16 p-6 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="font-bold">Plans are temporarily unavailable</p>
            <p className="mt-1 text-xs text-red-700">
              {plansError || 'The plan catalog is empty. Please try again in a moment.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 rounded-lg bg-white border border-red-300 text-xs font-bold text-red-800 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const planPriceKes = hasCarePlan && currentPlan
    ? (() => {
        const baseMonthly = currentPlan.priceMonthlyKes || currentPlan.priceMonthly * 130;
        const baseAnnual = currentPlan.priceAnnualKes;
        return calculatePlanCyclePrice(baseMonthly, billingCycle, {
          canonicalAnnualAmount: baseAnnual,
          isKes: true,
        }).amount;
      })()
    : 0;

  const planPriceUsd = hasCarePlan && currentPlan
    ? (() => {
        const baseMonthly = currentPlan.priceMonthly;
        const baseAnnual = currentPlan.priceAnnual;
        return calculatePlanCyclePrice(baseMonthly, billingCycle, {
          canonicalAnnualAmount: baseAnnual,
          isKes: false,
        }).amount;
      })()
    : 0;
  const itemPriceKes = (item: { id?: string; unitPrice: number; qty: number; currency: string }) => {
    if ((item.currency || '').toUpperCase() === 'KES') {
      return item.unitPrice * item.qty;
    }
    const keBookPrice = item.id ? getProductPrice(item.id, 'KE')?.amount : undefined;
    if (keBookPrice != null && keBookPrice > 0) {
      return keBookPrice * item.qty;
    }
    return Math.round(item.unitPrice * item.qty * 129.5);
  };
  const itemPriceUsd = (item: { id?: string; unitPrice: number; qty: number; currency: string }) => {
    if ((item.currency || '').toUpperCase() === 'USD') {
      return item.unitPrice * item.qty;
    }
    const globalBookPrice = item.id ? getProductPrice(item.id, 'GLOBAL')?.amount : undefined;
    if (globalBookPrice != null && globalBookPrice > 0) {
      return globalBookPrice * item.qty;
    }
    return Math.round((item.unitPrice * item.qty) / 129.5);
  };
  const cartExtrasTotalKes = catalogCartItems.reduce((sum, i) => sum + itemPriceKes(i), 0);
  const cartExtrasTotalUsd = catalogCartItems.reduce((sum, i) => sum + itemPriceUsd(i), 0);
  const totalDueKes = planPriceKes + (cartMode ? cartExtrasTotalKes : 0);
  const totalDueUsd = planPriceUsd + (cartMode ? cartExtrasTotalUsd : 0);
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
            planId: effectivePlanId,
            billingCycle,
            email: cleanEmail,
            mpesaPhoneNumber: normalizedPhone,
            ...(cartExtras.length ? { extras: cartExtras } : {}),
          }),
        });
        const envelope = await res.json().catch(() => ({}));
        const data = envelope?.data ?? envelope;
        if (!res.ok) {
          throw new CheckoutApiError(
            data?.message || envelope?.message || 'M-Pesa initialization failed',
            data?.code || envelope?.code || (res.status === 409 ? 'ACCOUNT_EXISTS' : undefined),
          );
        }
        if (!data.trackingId) throw new Error('The payment prompt was not created. Please retry.');
        setPaymentAttempt({ trackingId: String(data.trackingId), invoiceNumber: String(data.invoiceNumber || '') });
        setFeedback({
          type: 'info',
          message: `${data.message || 'M-Pesa prompt sent!'} Check your handset and enter your PIN.`,
        });
      } catch (err: unknown) {
        const code = err instanceof CheckoutApiError ? err.code : undefined;
        setFeedback({
          type: 'error',
          message: paymentFailedMessage(err, 'M-Pesa payment request failed'),
          ...(code ? { code } : {}),
        });
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
          planId: effectivePlanId,
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
            planId: effectivePlanId,
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
          planId: effectivePlanId,
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
      if (!res.ok) {
        throw new CheckoutApiError(
          data?.message || body?.message || 'Card gateway initialization failed',
          data?.code || body?.code || (res.status === 409 ? 'ACCOUNT_EXISTS' : undefined),
        );
      }
      if (data.checkoutUrl && isTrustedCheckoutUrl(data.checkoutUrl)) {
        window.location.href = data.checkoutUrl;
        return;
      }
      throw new Error('Payment gateway returned an invalid or untrusted checkout URL');
    } catch (err: unknown) {
      const code = err instanceof CheckoutApiError ? err.code : undefined;
      setFeedback({
        type: 'error',
        message: paymentFailedMessage(err, 'Card gateway error'),
        ...(code ? { code } : {}),
      });
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
            planId: effectivePlanId,
            billingCycle,
            currency,
            email: cleanEmail,
            purchaseOrderNumber: poNumber || undefined,
            ...(cartExtras.length ? { extras: cartExtras } : {}),
          }),
        });
        const body = await res.json().catch(() => ({}));
        const data = body?.data ?? body;
        if (!res.ok) {
          throw new CheckoutApiError(
            data?.message || body?.message || 'Invoice generation failed',
            data?.code || body?.code || (res.status === 409 ? 'ACCOUNT_EXISTS' : undefined),
          );
        }
        setWiseAccount(data);
        setFeedback({
          type: 'success',
          message: `Corporate invoice ${data.invoiceNumber} ready. Wire to ${data.bankTransferDetails?.beneficiary} with reference ${data.paymentReference}. After we confirm the transfer, claim the dashboard at /portal/claim with ${cleanEmail} — we will email a one-time link to verify it is yours.`,
        });
      } catch (err: unknown) {
        const code = err instanceof CheckoutApiError ? err.code : undefined;
        setFeedback({
          type: 'error',
          message: paymentFailedMessage(err, 'Corporate invoice generation failed'),
          ...(code ? { code } : {}),
        });
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
          planId: effectivePlanId,
          billingCycle,
          currency,
          purchaseOrderNumber: poNumber || undefined,
          ...(cartExtras.length ? { extras: cartExtras } : {}),
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

  const fallbackCheckoutPath = `/checkout?plan=${encodeURIComponent(selectedPlanSlug)}&cycle=${encodeURIComponent(billingCycle)}${cartMode ? '&cart=1' : ''}`;
  const checkoutReturnPath =
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/checkout')
      ? sanitizeRedirectPath(`${window.location.pathname}${window.location.search}`)
      : null) || fallbackCheckoutPath;
  const normalizedBillingEmail = email.trim().toLowerCase();
  const isAccountExistsError =
    !token &&
    feedback?.type === 'error' &&
    (feedback.code === 'ACCOUNT_EXISTS' || /account already exists/i.test(feedback.message));
  const signInHref = (() => {
    const params = new URLSearchParams({ mode: 'password', redirect: checkoutReturnPath });
    if (normalizedBillingEmail) params.set('email', normalizedBillingEmail);
    return `/portal/login?${params.toString()}`;
  })();

  const handleInlineMagicLink = async () => {
    if (!normalizedBillingEmail || !normalizedBillingEmail.includes('@')) return;
    setInlineMagicSending(true);
    setInlineMagicError(null);
    try {
      const payloadBody = JSON.stringify({
        email: normalizedBillingEmail,
        redirect: checkoutReturnPath,
      });

      const res = await fetch(toCleanUrl('/api/auth/magic-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadBody,
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.delivered !== false) {
        setInlineMagicSentTo(normalizedBillingEmail);
        return;
      }

      // Direct Traefik -> NestJS API fallback when web BFF cannot reach API internally
      // or when email credentials are configured directly on bazionweb-api.
      if (res.status >= 500 || data?.delivered === false) {
        const directRes = await fetch(toCleanUrl(`${resolveApiV1Base()}/auth/magic-link`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadBody,
        }).catch(() => null);

        if (directRes?.ok) {
          const directEnvelope = await directRes.json().catch(() => ({}));
          const directPayload = directEnvelope?.data ?? directEnvelope;
          if (directPayload?.emailDispatched && directPayload?.delivered) {
            setInlineMagicSentTo(normalizedBillingEmail);
            return;
          }
        }
      }

      throw new Error(
        data?.error ||
          data?.message ||
          'Could not send sign-in link right now. Please use password sign-in.',
      );
    } catch (err: unknown) {
      setInlineMagicError(
        err instanceof Error ? err.message : 'Could not send sign-in link right now.',
      );
    } finally {
      setInlineMagicSending(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Clean, Light, Straightforward Order Summary */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 text-slate-900 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-[#2563EB]">
                Order Summary
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Selected Digital Stack
              </h3>
            </div>
            {cartMode ? (
              <Link
                href="/pricing"
                className="text-xs font-bold text-[#2563EB] hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                Edit Selection
              </Link>
            ) : (
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                Live Checkout
              </span>
            )}
          </div>

          {/* 1. Cart Stack Items (Website, Domain, Hosting, Add-Ons) */}
          {cartMode && catalogCartItems.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Selected Packages &amp; Infrastructure
                </span>
                <Link href="/cart" className="text-[11px] font-semibold text-[#2563EB] hover:underline">
                  Edit cart
                </Link>
              </div>
              <ul className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl bg-slate-50/60 px-4 py-1">
                {catalogCartItems.map((i) => (
                  <li key={i.key} className="flex items-center justify-between gap-3 py-2.5 text-xs sm:text-sm">
                    <span className="text-slate-700 font-medium leading-snug">
                      {i.name}
                      {i.qty > 1 ? ` x${i.qty}` : ''}
                    </span>
                    <span className="font-bold text-slate-900 shrink-0">
                      {isKe
                        ? `KES ${itemPriceKes(i).toLocaleString()}`
                        : `$${itemPriceUsd(i).toLocaleString()}`}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between px-1 text-xs text-slate-600">
                <span className="font-semibold">Stack subtotal</span>
                <span className="font-bold text-slate-900">
                  {isKe
                    ? `KES ${cartExtrasTotalKes.toLocaleString()}`
                    : `$${cartExtrasTotalUsd.toLocaleString()}`}
                </span>
              </div>
            </div>
          )}

          {/* 2. Care Plan Section — Strictly Optional in Cart Mode */}
          <div className="mt-5 pt-4 border-t border-slate-200">
            {!hasCarePlan ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Step 4 · Care Plan (Optional)
                    </span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">
                      None selected — Standard post-launch warranty included
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanSlug(bySlug['care-essential'] ? 'care-essential' : DEFAULT_PLAN_SLUG);
                      setShowCareSelector(true);
                    }}
                    className="text-xs font-bold text-[#2563EB] hover:text-blue-700 bg-white border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors shrink-0 shadow-2xs"
                  >
                    + Add Care Plan
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      {cartMode ? 'Optional Care Plan Selected' : 'Selected Care Plan'}
                    </span>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {currentPlan.name}{' '}
                      <span className="text-xs font-medium text-slate-500">
                        ({BILLING_CYCLES_META.find((m) => m.enumValue === billingCycle)?.label || 'Monthly'})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-slate-900">
                      {isKe
                        ? `KES ${planPriceKes.toLocaleString()}`
                        : `$${planPriceUsd.toLocaleString()}`}
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setShowCareSelector((prev) => !prev)}
                        className="text-[11px] font-semibold text-[#2563EB] hover:underline"
                      >
                        {showCareSelector ? 'Hide options' : 'Change tier'}
                      </button>
                      {cartMode && (
                        <button
                          type="button"
                          onClick={() => {
                            if (cartPlanItem) {
                              removeCartItem(cartPlanItem.key);
                            }
                            setSelectedPlanSlug('none');
                            setShowCareSelector(false);
                          }}
                          className="text-[11px] font-semibold text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Collapsible Care Plan Tier & Cycle Picker */}
                {showCareSelector && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Select Care Tier
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {plans.map((p) => (
                          <button
                            key={p.slug}
                            type="button"
                            onClick={() => setSelectedPlanSlug(p.slug)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              currentPlan.slug === p.slug
                                ? 'border-[#2563EB] bg-blue-50/70 text-slate-900 font-semibold ring-1 ring-[#2563EB]/20'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-900">{p.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {isKe
                                ? `KES ${(p.priceMonthlyKes ?? 0).toLocaleString()}/mo`
                                : `$${p.priceMonthly}/mo`}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Billing Term
                        </span>
                        <span className="text-[11px] text-[#2563EB] font-bold">
                          {BILLING_CYCLES_META.find((m) => m.enumValue === billingCycle)?.label}
                        </span>
                      </div>
                      <div className="bg-slate-100 p-1 rounded-xl flex flex-wrap items-center gap-1 border border-slate-200">
                        {BILLING_CYCLES_META.map((meta) => {
                          const isSelected = billingCycle === meta.enumValue;
                          return (
                            <button
                              key={meta.enumValue}
                              type="button"
                              onClick={() => {
                                const newCycle = meta.enumValue as CheckoutCycle;
                                setBillingCycle(newCycle);
                                if (cartPlanItem && currentPlan) {
                                  const baseMonthly = isKe
                                    ? (currentPlan.priceMonthlyKes || currentPlan.priceMonthly * 130)
                                    : currentPlan.priceMonthly;
                                  const baseAnnual = isKe ? currentPlan.priceAnnualKes : currentPlan.priceAnnual;
                                  const cyclePrice = calculatePlanCyclePrice(baseMonthly, newCycle, {
                                    canonicalAnnualAmount: baseAnnual,
                                    isKes: isKe,
                                  });
                                  const addFn = useCartStore.getState().add;
                                  addFn({
                                    kind: 'PLAN',
                                    id: currentPlan.slug,
                                    name: `${currentPlan.name} (${meta.label})`,
                                    cycle: newCycle,
                                    qty: 1,
                                    unitPrice: cyclePrice.amount,
                                    currency: isKe ? 'KES' : 'USD',
                                  });
                                }
                              }}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                                isSelected
                                  ? 'bg-[#2563EB] text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                              }`}
                            >
                              {meta.pillLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {marketing && !cartMode && (
                      <div className="pt-2 space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Included Highlights
                        </span>
                        <ul className="space-y-1.5 text-xs text-slate-600">
                          {marketing.features.map((f, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Total Breakdown */}
          <div className="mt-6 pt-4 border-t-2 border-slate-900/10 flex justify-between items-baseline">
            <div>
              <span className="text-sm font-bold text-slate-900 block">Total Due Today</span>
              <span className="text-[11px] text-slate-500">
                100% IP &amp; code ownership · Instant receipt
              </span>
            </div>
            <div data-testid="checkout-total" className="text-right">
              {isKe ? (
                <div className="text-2xl font-black text-slate-900">
                  KES {currentPriceKes.toLocaleString()}
                </div>
              ) : (
                <div className="text-2xl font-black text-slate-900">
                  ${currentPriceUsd.toLocaleString()} USD
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart-mode stack readiness strip */}
        {cartMode && (
          <div
            data-testid="checkout-stack-checklist"
            className={`rounded-2xl border p-4 text-xs ${
              hostingMissing
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
            }`}
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider block mb-2">
              Stack Verification
            </span>
            <ul className="space-y-1.5">
              <li data-testid="stack-care-row" className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                <span>
                  {cartPlanItem ? (
                    <>
                      Care plan chosen: <strong>{cartPlanItem.name}</strong>{' '}
                      <span className="text-slate-500">
                        ({cartPlanItem.cycle === 'ANNUAL' ? 'yearly' : 'monthly'})
                      </span>
                    </>
                  ) : hasCarePlan && currentPlan ? (
                    <>
                      Care plan chosen: <strong>{currentPlan.name}</strong>
                    </>
                  ) : (
                    <>
                      Care plan (Optional): <strong>None selected</strong> (included warranty applies)
                    </>
                  )}
                </span>
              </li>
              <li data-testid="stack-hosting-row" className="flex items-start gap-2">
                {hostingMissing ? (
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                )}
                <span>
                  {hostingMissing ? (
                    <>
                      Hosting missing — every deployed site needs managed hosting.{' '}
                      <Link href="/store#hosting" className="font-bold underline text-amber-900 hover:text-amber-700">
                        Browse hosting
                      </Link>{' '}
                      or switch to a bundle tier that includes hosting.
                    </>
                  ) : hostingIncludedInPlan ? (
                    <>Hosting included in {currentPlan.name}. No separate host line needed.</>
                  ) : (
                    <>
                      Hosting configured:{' '}
                      <strong>
                        {hostingInCart
                          ? catalogCartItems
                              .filter((i) => i.id.startsWith('host-'))
                              .map((i) => i.name)
                              .join(', ')
                          : ''}
                      </strong>
                    </>
                  )}
                </span>
              </li>
            </ul>
            {hostingMissing && (
              <button
                type="button"
                onClick={() => {
                  if (bySlug['starter']) {
                    setSelectedPlanSlug('starter');
                    setBillingCycle('MONTHLY');
                  }
                }}
                disabled={!bySlug['starter']}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-40"
              >
                Switch to Starter (hosting included)
              </button>
            )}
          </div>
        )}

        {/* Security Badge */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-600 shadow-2xs">
          <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>256-Bit SSL Encrypted Checkout. Powered by Paystack (M-Pesa STK Push &amp; Global Cards).</span>
        </div>
      </div>

      {/* Right Column: Clean, Light Payment Method Form */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-slate-900">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#2563EB]">
              Payment Gateway
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Select Payment Method</h2>
          </div>

          {/* Tab Rail Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('MPESA');
                setFeedback(null);
              }}
              className={`min-h-[44px] flex flex-row sm:flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                activeTab === 'MPESA'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-900 ring-2 ring-emerald-500/15'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Mobile Money</span>
              <span className="text-[10px] font-medium opacity-75">via M-Pesa</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('CARD');
                setFeedback(null);
              }}
              className={`min-h-[44px] flex flex-row sm:flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                activeTab === 'CARD'
                  ? 'bg-blue-50 border-[#2563EB] text-[#1E40AF] ring-2 ring-blue-500/15'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4 text-[#2563EB]" />
              <span>Credit Card</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('WISE');
                setFeedback(null);
              }}
              className={`min-h-[44px] flex flex-row sm:flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                activeTab === 'WISE'
                  ? 'bg-purple-50 border-purple-600 text-purple-900 ring-2 ring-purple-500/15'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-purple-600" />
              <span>Corporate Wire</span>
            </button>
          </div>

          {/* Feedback message banner */}
          {feedback && (
            <div
              className={`mb-5 p-4 rounded-xl flex items-start gap-3 text-xs border ${
                feedback.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="leading-relaxed font-medium">{feedback.message}</div>
                {isAccountExistsError && (
                  <div className="mt-3 pt-3 border-t border-red-200/80 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={signInHref}
                        data-testid="checkout-direct-signin-link"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-bold px-3.5 py-2 text-xs shadow-2xs transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Sign in to complete payment
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      {normalizedBillingEmail.includes('@') && (
                        <button
                          type="button"
                          onClick={handleInlineMagicLink}
                          disabled={inlineMagicSending}
                          data-testid="checkout-inline-magic-link"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold px-3 py-2 text-xs transition-colors disabled:opacity-50"
                        >
                          {inlineMagicSending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                          ) : (
                            <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
                          )}
                          {inlineMagicSentTo ? 'Resend sign-in link' : 'Email me a sign-in link'}
                        </button>
                      )}
                    </div>
                    {inlineMagicSentTo && (
                      <p
                        data-testid="checkout-inline-magic-sent"
                        className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2"
                      >
                        Sign-in link sent to <strong>{inlineMagicSentTo}</strong> — open it from your inbox to return directly to this checkout.
                      </p>
                    )}
                    {inlineMagicError && (
                      <p className="text-[11px] font-medium text-red-700">{inlineMagicError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {paymentAttempt && (
            <div
              className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
              role="status"
              aria-live="polite"
            >
              {paymentStatus.data?.status === 'SUCCESS' ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Payment confirmed</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Invoice {paymentAttempt.invoiceNumber} is paid. Continue to your workspace.
                    </p>
                  </div>
                  <Link
                    href={
                      token
                        ? '/portal'
                        : `/portal/claim?email=${encodeURIComponent(email.trim().toLowerCase())}&autostart=1`
                    }
                    className="btn-primary justify-center px-4 py-2.5 text-xs"
                  >
                    {token ? 'Open dashboard' : 'Set up dashboard access'} <ArrowRight className="size-4" />
                  </Link>
                </div>
              ) : paymentStatus.data?.status === 'FAILED' ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-rose-700">Payment was not completed</p>
                    <p className="mt-1 text-xs text-slate-600">You can safely retry the M-Pesa prompt.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentAttempt(null);
                      setFeedback(null);
                    }}
                    className="text-xs font-bold text-slate-900 underline"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Waiting for M-Pesa confirmation</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {paymentStatus.isError
                        ? 'We could not refresh automatically. Do not pay again while checking this request.'
                        : 'Keep this page open; we are checking automatically. Do not submit another payment.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void paymentStatus.refetch()}
                    disabled={paymentStatus.isFetching}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
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
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600 text-xs font-semibold">
                  Payable via mobile money (M-Pesa)
                </span>
                <span className="text-xl font-extrabold text-emerald-700 font-mono">
                  KES {currentPriceKes.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Billing Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@yourcompany.com"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 transition-colors mb-3"
                />

                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 transition-colors"
                />
                <span className="text-[11px] text-slate-500 mt-1.5 block">
                  Format: 07XX XXX XXX or 01XX XXX XXX (Safaricom / Airtel M-Pesa). You will receive an STK Push PIN prompt.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || paymentBlocked}
                title={paymentBlocked ? 'Add hosting to complete your stack before paying' : undefined}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Send mobile-money prompt <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: Credit / Debit Card (Paystack) */}
          {activeTab === 'CARD' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600 text-xs font-semibold">
                  Card charge ({isKe ? 'billed in KES' : 'billed in USD'})
                </span>
                <span className="text-xl font-extrabold text-slate-900 font-mono">
                  {isKe
                    ? `KES ${currentPriceKes.toLocaleString()}`
                    : `$${currentPriceUsd.toLocaleString()} USD`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Billing Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@yourcompany.com"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/15 transition-colors mb-3"
                />
                {email.trim() !== email && (
                  <span className="text-[11px] text-amber-600 block -mt-2 mb-2">Auto-trimming spaces…</span>
                )}
              </div>

              {!token && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      autoComplete="given-name"
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/15 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Wanjiku"
                      autoComplete="family-name"
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/15 transition-colors"
                    />
                  </div>
                </div>
              )}

              {!token && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-slate-700 text-xs leading-relaxed">
                  Pay first — <strong>no account needed yet</strong>. Once your payment lands, we email a
                  one-time claim link to the address above to set your password and unlock your client portal.
                </div>
              )}

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                Supports Visa, Mastercard, and American Express. Your card details are tokenized securely with Paystack PCI-DSS Level 1 compliance.
              </div>

              <button
                type="button"
                onClick={handleCardPay}
                disabled={loading || paymentBlocked}
                title={paymentBlocked ? 'Add hosting to complete your stack before paying' : undefined}
                className="w-full bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Proceed to Card Gateway <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tab 3: Wise Corporate Wire */}
          {activeTab === 'WISE' && (
            <div className="space-y-4">
              {!token && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-950 text-xs leading-relaxed">
                  No account needed yet — enter your billing email and we&apos;ll generate the invoice. After our team
                  confirms your wire, claim your dashboard at <strong>/portal/claim</strong>.
                </div>
              )}
              {!wiseAccount ? (
                <form onSubmit={handleWiseInvoice} className="space-y-4">
                  {!token && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                        Billing Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="billing@yourcompany.com"
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-500/15 transition-colors"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                        Settlement Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setCurrency(e.target.value as 'USD' | 'EUR' | 'GBP')
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-3 text-slate-900 text-xs focus:outline-none focus:border-purple-600"
                      >
                        <option value="USD">USD ($) - ACH / Fedwire Routing</option>
                        <option value="EUR">EUR (€) - SEPA Instant / IBAN</option>
                        <option value="GBP">GBP (£) - UK Faster Payments</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                        Purchase Order # (Optional)
                      </label>
                      <input
                        type="text"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder="PO-2026-0089"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-3 text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                    <span className="text-slate-600 text-xs font-semibold">B2B Net Invoice Total</span>
                    <span className="text-xl font-extrabold text-purple-900 font-mono">
                      ${currentPriceUsd.toLocaleString()} USD
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || paymentBlocked}
                    title={paymentBlocked ? 'Add hosting to complete your stack before requesting an invoice' : undefined}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm text-sm"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Generate B2B Invoice &amp; Wire Instructions <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Allocated Virtual Bank Account Box */
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-purple-700 font-bold uppercase tracking-wider">
                        Invoice Generated
                      </div>
                      <div className="text-base font-bold text-slate-900 font-mono">
                        {wiseAccount.invoiceNumber}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!wiseAccount.invoicePdfDownloadUrl) {
                          setFeedback({ type: 'error', message: 'The official invoice PDF link is missing. Please regenerate the invoice.' });
                          return;
                        }
                        const pdfUrl = new URL(wiseAccount.invoicePdfDownloadUrl, apiBase).toString();
                        const invoiceWindow = window.open(pdfUrl, '_blank');
                        if (invoiceWindow) invoiceWindow.opener = null;
                        if (!invoiceWindow) {
                          setFeedback({ type: 'error', message: 'Allow pop-ups for BazionWeb to download your invoice PDF.' });
                        }
                      }}
                      disabled={!wiseAccount.invoicePdfDownloadUrl}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5 text-purple-600" /> Download PDF Invoice
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 text-right">Secure PDF link valid for 15 minutes.</p>

                  {/* Wire Routing Details Card */}
                  <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    {[
                      { label: 'Beneficiary Name', value: wiseAccount.bankTransferDetails.beneficiary },
                      {
                        label: 'Account Number / IBAN',
                        value:
                          wiseAccount.bankTransferDetails.accountNumber ||
                          wiseAccount.bankTransferDetails.iban,
                      },
                      { label: 'Routing / ABA / Sort Code', value: wiseAccount.bankTransferDetails.routingNumber },
                      { label: 'SWIFT / BIC', value: wiseAccount.bankTransferDetails.swiftBic },
                      { label: 'Mandatory Payment Reference', value: wiseAccount.paymentReference },
                    ]
                      .filter((item): item is { label: string; value: string } => Boolean(item.value))
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center py-2 border-b border-slate-200/80 last:border-0"
                        >
                          <span className="text-slate-600">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-900 font-bold">{item.value}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.value, item.label)}
                              className="p-1 text-slate-500 hover:text-slate-900 transition"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>

                  {copiedField && (
                    <div className="text-[11px] text-emerald-600 font-semibold text-right">
                      Copied {copiedField} to clipboard!
                    </div>
                  )}

                  {wiseAccount.bankTransferDetails.referenceNote && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
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
