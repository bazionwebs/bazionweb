'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Market,
  ADD_ON_RATE_CARD,
} from '@/lib/pricingData';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { mapCountryToMarket } from '@/lib/marketEngine';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import {
  Check,
  ArrowRight,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
  ShieldCheck,
  X,
  Loader2,
  Mail,
  User,
  Globe,
  Lock,
  CreditCard,
  Smartphone,
  CalendarDays,
  Rocket,
  FolderKanban,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { resolveApiV1Base } from '@/lib/api-base';
import { buildWhatsAppLink, trackWhatsAppOpen } from '@/lib/contact';

interface QuoteConfig {
  market: Market;
  packageType: 'launch' | 'business' | 'professional' | 'ecom-starter' | 'ecom-business' | 'custom';
  extraPages: number;
  selectedAddOns: string[];
  rushDelivery: boolean;
  care: string; // 'none' | 'care-essential' | 'care-business' | 'care-professional'
  hosting: string; // hosting option id, 'none' = self-managed
}

const PACKAGE_DEFAULTS = {
  launch: { name: 'Launch Website', basePages: 5, kenyaCost: 25000, intlCost: 450 },
  business: { name: 'Business Website', basePages: 10, kenyaCost: 90000, intlCost: 950 },
  professional: { name: 'Professional Website', basePages: 15, kenyaCost: 160000, intlCost: 1750 },
  'ecom-starter': { name: 'E-Commerce Starter', basePages: 8, kenyaCost: 90000, intlCost: 890 },
  'ecom-business': { name: 'E-Commerce Business', basePages: 15, kenyaCost: 175000, intlCost: 1650 },
  custom: { name: 'Custom Project Build', basePages: 5, kenyaCost: 320000, intlCost: 3600 },
};

// The API's global TransformInterceptor wraps every success as { data: ... }.
// Unwrap the envelope once so callers can read the payload directly.
function unwrapApiPayload<T>(payload: unknown): T {
  const node = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  return (node.data && typeof node.data === 'object' ? node.data : node) as T;
}

// NestJS error `message` may be a string or a validation array — normalize it.
function apiErrorMessage(payload: unknown, fallback: string): string {
  const node = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const message = node.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && message.length) return message.join('. ');
  return fallback;
}

function QuoteCalculatorContent() {
  const searchParams = useSearchParams();

  const { market, marketCode, marketDef } = useMarketPreference();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [config, setConfig] = useState<QuoteConfig>({
    market,
    packageType: (searchParams.get('package') as QuoteConfig['packageType']) || 'business',
    extraPages: 0,
    selectedAddOns: [],
    rushDelivery: false,
    care: 'none',
    hosting: 'none',
  });

  // Get Started Modal State
  const [showModal, setShowModal] = useState(false);
  const [gName, setGName] = useState('');
  const [gEmail, setGEmail] = useState('');
  const [gCompany, setGCompany] = useState('');
  const quoteSubmissionRef = useRef(false);
  const [gCountry, setGCountry] = useState(marketCode === 'KE' ? 'KE' : 'US');
  const [gLoading, setGLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [submittedQuote, setSubmittedQuote] = useState<{
    proposalCode: string;
    currencySymbol: string;
    package: { name: string };
    totals: {
      formattedTotalBuild: string;
      formattedMonthlyCare: string;
      formattedAnnualHosting: string;
      formattedTotalYearOne: string;
    };
    expiresAt: string;
  } | null>(null);

  // Accept & pay kickoff deposit (quote-to-close)
  const [acceptStage, setAcceptStage] = useState<'idle' | 'confirm' | 'accepted'>('idle');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [deposit, setDeposit] = useState<{
    invoiceNumber: string;
    amount: number;
    currency: string;
    depositPercent: number;
  } | null>(null);
  const [payBusy, setPayBusy] = useState<'card' | 'mpesa' | null>(null);
  const [payError, setPayError] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [stk, setStk] = useState<{ trackingId: string; message: string } | null>(null);
  const [payState, setPayState] = useState<'waiting' | 'paid' | 'failed'>('waiting');

  // Sync config when market changes
  useEffect(() => {
    setConfig(prev => ({ ...prev, market }));
    setGCountry(marketCode === 'KE' ? 'KE' : 'US');
  }, [market, marketCode]);

  useEffect(() => {
    const pkgParam = searchParams.get('package');
    if (pkgParam && pkgParam in PACKAGE_DEFAULTS) {
      setConfig(prev => ({ ...prev, packageType: pkgParam as QuoteConfig['packageType'] }));
    }
    const addonParam = searchParams.get('addon');
    if (addonParam) {
      setConfig(prev => ({
        ...prev,
        selectedAddOns: prev.selectedAddOns.includes(addonParam)
          ? prev.selectedAddOns
          : [...prev.selectedAddOns, addonParam],
      }));
    }
  }, [searchParams]);

  const currencySymbol = config.market === 'kenya' ? 'KSh' : '$';
  const pkgInfo = PACKAGE_DEFAULTS[config.packageType] || PACKAGE_DEFAULTS.business;

  // Calculation Logic — matches canonical priceBooks.ts (KE-2026-v1 & GLOBAL-2026-v1)
  const baseCost = config.market === 'kenya' ? pkgInfo.kenyaCost : pkgInfo.intlCost;
  const extraPageRate = config.market === 'kenya' ? 2000 : 40;
  const extraPagesCost = config.extraPages * extraPageRate;

  // Add-ons cost
  const addOnsCost = config.selectedAddOns.reduce((total, id) => {
    const item = ADD_ON_RATE_CARD.find(a => a.id === id);
    if (!item) return total;
    return total + (config.market === 'kenya' ? item.rawKes : item.rawUsd);
  }, 0);

  const subtotalBuild = baseCost + extraPagesCost + addOnsCost;
  const rushMultiplier = config.rushDelivery ? 0.35 : 0; // +35% average rush
  const rushCost = Math.round(subtotalBuild * rushMultiplier);
  const totalBuild = subtotalBuild + rushCost;

  // Care recurring costs
  let monthlyCare = 0;
  if (config.care === 'care-essential') monthlyCare = config.market === 'kenya' ? 5000 : 75;
  else if (config.care === 'care-business') monthlyCare = config.market === 'kenya' ? 10000 : 150;
  else if (config.care === 'care-professional') monthlyCare = config.market === 'kenya' ? 20000 : 300;

  // Annual hosting cost (mirrors the hosting options card prices)
  const HOSTING_ANNUAL: Record<string, { kenya: number; intl: number }> = {
    'host-essential': { kenya: 4500, intl: 49 },
    'host-business': { kenya: 8500, intl: 99 },
    'host-pro': { kenya: 15000, intl: 189 },
    none: { kenya: 0, intl: 0 },
  };
  const annualHosting =
    (HOSTING_ANNUAL[config.hosting] ?? HOSTING_ANNUAL.none)[config.market === 'kenya' ? 'kenya' : 'intl'];

  const totalYearOne = totalBuild + annualHosting + (monthlyCare * 12);

  // Toggle addon helper
  function toggleAddOn(id: string) {
    setConfig(prev => ({
      ...prev,
      selectedAddOns: prev.selectedAddOns.includes(id)
        ? prev.selectedAddOns.filter(item => item !== id)
        : [...prev.selectedAddOns, id],
    }));
  }

  async function handleGetStarted(e: React.FormEvent) {
    e.preventDefault();
    if (!gName.trim() || !gEmail.trim() || quoteSubmissionRef.current) return;

    quoteSubmissionRef.current = true;
    setGLoading(true);
    setSubmissionError('');

    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingCountry: gCountry,
          packageType: config.packageType,
          extraPages: config.extraPages,
          selectedAddOns: config.selectedAddOns,
          rushDelivery: config.rushDelivery,
          care: config.care,
          hosting: config.hosting,
          clientName: gName.trim(),
          clientEmail: gEmail.trim().toLowerCase(),
          clientCompany: gCompany.trim(),
        }),
      });
      const quote = await response.json().catch(() => ({}));
      if (!response.ok || !quote.success || !quote.proposalCode) {
        throw new Error(quote.error || 'We could not save your proposal. Please retry.');
      }

      setSubmittedQuote(quote);
      setShowModal(false);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'We could not save your proposal. Please retry.');
    } finally {
      quoteSubmissionRef.current = false;
      setGLoading(false);
    }
  }

  const proposalApi = (path: string) => `${resolveApiV1Base()}/invoices/proposals/${encodeURIComponent(submittedQuote?.proposalCode ?? '')}${path}`;

  async function handleAcceptProposal() {
    if (!submittedQuote) return;
    setAccepting(true);
    setAcceptError('');
    try {
      const nameParts = gName.trim().split(/\s+/);
      const response = await fetch(proposalApi('/accept'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: submittedQuote.proposalCode,
          email: gEmail.trim().toLowerCase(),
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(' ') || undefined,
          businessName: gCompany.trim() || undefined,
        }),
      });
      const envelope = await response.json().catch(() => ({}));
      const data = unwrapApiPayload(envelope) as {
        invoice?: { invoiceNumber: string; amount: number; currency: string };
        depositPercent?: number;
      };
      if (!response.ok || !data.invoice) {
        throw new Error(apiErrorMessage(envelope, 'We could not accept the proposal. Please try again.'));
      }
      setDeposit({
        invoiceNumber: data.invoice.invoiceNumber,
        amount: data.invoice.amount,
        currency: data.invoice.currency,
        depositPercent: data.depositPercent ?? 50,
      });
      setAcceptStage('accepted');
    } catch (error) {
      setAcceptError(error instanceof Error ? error.message : 'We could not accept the proposal. Please try again.');
    } finally {
      setAccepting(false);
    }
  }

  async function handlePayDepositCard() {
    setPayBusy('card');
    setPayError('');
    try {
      const response = await fetch(proposalApi('/pay/card'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: gEmail.trim().toLowerCase() }),
      });
      const envelope = await response.json().catch(() => ({}));
      const data = unwrapApiPayload(envelope) as { checkoutUrl?: string };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(apiErrorMessage(envelope, 'Card checkout could not start. Please try again.'));
      }
      // Paystack hosted checkout; the return URL (/checkout/verify) confirms settlement.
      window.location.href = data.checkoutUrl;
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Card checkout could not start. Please try again.');
      setPayBusy(null);
    }
  }

  async function handlePayDepositMpesa() {
    const phone = mpesaPhone.replace(/\s+/g, '');
    if (!/^(\+?254|0)?[17]\d{8}$/.test(phone)) {
      setPayError('Enter a valid Safaricom number, e.g. 0712345678.');
      return;
    }
    setPayBusy('mpesa');
    setPayError('');
    try {
      const response = await fetch(proposalApi('/pay/mpesa'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mpesaPhoneNumber: phone }),
      });
      const envelope = await response.json().catch(() => ({}));
      const data = unwrapApiPayload(envelope) as { trackingId?: string; message?: string };
      if (!response.ok || !data.trackingId) {
        throw new Error(apiErrorMessage(envelope, 'M-Pesa prompt could not be sent. Please try again.'));
      }
      setStk({ trackingId: String(data.trackingId), message: String(data.message || 'M-Pesa prompt sent. Check your handset and enter your PIN.') });
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'M-Pesa prompt could not be sent. Please try again.');
    } finally {
      setPayBusy(null);
    }
  }

  // Poll the settlement status while an M-Pesa STK prompt is outstanding.
  useEffect(() => {
    if (!stk || payState !== 'waiting') return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      tries += 1;
      try {
        const response = await fetch(`${resolveApiV1Base()}/invoices/payments/${encodeURIComponent(stk.trackingId)}/status`);
        const envelope = await response.json().catch(() => ({}));
        const data = unwrapApiPayload(envelope) as { status?: string };
        if (data.status === 'SUCCESS') {
          setPayState('paid');
          return;
        }
        if (data.status === 'FAILED') {
          setPayState('failed');
          return;
        }
      } catch {
        // Transient network error — keep polling until the budget runs out.
      }
      if (tries >= 40) {
        setPayState('failed');
        return;
      }
      timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 3000);
    return () => clearTimeout(timer);
  }, [stk, payState]);

  if (submittedQuote) {
    const isKes = submittedQuote.currencySymbol === 'KSh';
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 sm:py-24">
        <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-7" aria-hidden="true" />
          </div>
          <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Proposal saved</p>
          <h1 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-slate-900">Your project request is recorded</h1>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-slate-600">
            We&apos;ve saved the server-priced proposal and your contact details. Accept it below to lock your slot and kick off the build — or our team will follow up at {gEmail.trim()}.
          </p>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reference</span>
              <span className="font-mono text-sm font-bold text-slate-900">{submittedQuote.proposalCode}</span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-600">{submittedQuote.package.name} · one-time build</span>
              <span className="font-bold text-slate-900">{submittedQuote.totals.formattedTotalBuild}</span>
            </div>
            {config.care !== 'none' && (
              <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-600">
                <span>Ongoing care · monthly</span>
                <span className="font-semibold text-slate-900">{submittedQuote.totals.formattedMonthlyCare}</span>
              </div>
            )}
            {config.hosting !== 'none' && (
              <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-600">
                <span>Hosting · annual</span>
                <span className="font-semibold text-slate-900">{submittedQuote.totals.formattedAnnualHosting}</span>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200 pt-4 text-sm">
              <span className="font-bold text-slate-700">Estimated first-year total</span>
              <span className="text-lg font-extrabold text-blue-700">{submittedQuote.totals.formattedTotalYearOne}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Price book estimate expires {new Date(submittedQuote.expiresAt).toLocaleDateString()} and is subject to final scope approval.
            </p>
          </div>

          {/* What happens next — set expectations up front */}
          <div className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">What happens next</h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { icon: CreditCard, title: 'Pay the kickoff deposit', body: 'Accept the proposal and pay a 50% deposit by card or M-Pesa to reserve your build slot.' },
                { icon: CalendarDays, title: 'Kickoff within 2 business days', body: 'We confirm scope, timeline, and hand over a milestone plan — no long back-and-forth.' },
                { icon: FolderKanban, title: 'Track progress in your portal', body: 'Watch milestones, invoices, and messages in a client portal you unlock with your deposit.' },
                { icon: Rocket, title: 'Launch & handover', body: 'We deploy, hand over credentials, and your care plan keeps everything maintained.' },
              ].map((item, index) => (
                <li key={item.title} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <item.icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      <span className="mr-1.5 text-slate-400">{index + 1}.</span>
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Accept & pay */}
          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            {acceptStage === 'idle' && (
              <>
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Ready to start?</p>
                    <p className="mt-0.5 text-xs text-slate-600">Accept now and pay a 50% kickoff deposit — the balance is invoiced at launch.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAcceptStage('confirm')}
                    className="btn-primary shrink-0 justify-center px-5 py-3 text-sm"
                  >
                    Accept proposal &amp; pay deposit
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
                {acceptError && <p className="mt-3 text-xs font-medium text-red-600">{acceptError}</p>}
              </>
            )}

            {acceptStage === 'confirm' && (
              <div>
                <p className="text-sm font-bold text-slate-900">Confirm your details</p>
                <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <dt className="text-xs text-slate-500">Name</dt>
                    <dd className="font-semibold">{gName.trim()}</dd>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <dt className="text-xs text-slate-500">Email</dt>
                    <dd className="truncate font-semibold">{gEmail.trim()}</dd>
                  </div>
                </dl>
                {acceptError && <p className="mt-3 text-xs font-medium text-red-600">{acceptError}</p>}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleAcceptProposal}
                    disabled={accepting}
                    className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-60"
                  >
                    {accepting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
                    {accepting ? 'Accepting…' : 'Confirm & create deposit invoice'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAcceptStage('idle'); setAcceptError(''); }}
                    className="btn-secondary justify-center px-5 py-3 text-sm"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}

            {acceptStage === 'accepted' && deposit && (
              <div>
                {payState === 'paid' ? (
                  <div className="text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check className="size-6" aria-hidden="true" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900">Deposit received — your slot is reserved</p>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600">
                      Invoice {deposit.invoiceNumber} is settled. Create your portal password to follow the build from day one.
                    </p>
                    <Link
                      href={`/portal/claim?email=${encodeURIComponent(gEmail.trim().toLowerCase())}`}
                      className="btn-primary mt-4 inline-flex justify-center px-5 py-3 text-sm"
                    >
                      Set up my portal account
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">Proposal accepted</p>
                      <span className="font-mono text-xs text-slate-500">{deposit.invoiceNumber}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Kickoff deposit ({deposit.depositPercent}%): <span className="font-bold text-slate-900">{deposit.currency} {deposit.amount.toLocaleString()}</span> — due within 7 days. Choose how to pay:
                    </p>

                    {stk ? (
                      <div className="mt-4 rounded-xl bg-white p-4 text-center">
                        {payState === 'waiting' && (
                          <>
                            <Loader2 className="mx-auto size-5 animate-spin text-blue-600" aria-hidden="true" />
                            <p className="mt-2 text-sm font-semibold text-slate-900">{stk.message}</p>
                            <p className="mt-1 font-mono text-xs text-slate-500">Ref {stk.trackingId}</p>
                          </>
                        )}
                        {payState === 'failed' && (
                          <>
                            <p className="text-sm font-bold text-red-600">Payment not completed</p>
                            <p className="mt-1 text-xs text-slate-600">The prompt expired or was declined. You can retry below.</p>
                            <button
                              type="button"
                              onClick={() => { setStk(null); setPayState('waiting'); }}
                              className="btn-secondary mt-3 justify-center px-4 py-2 text-xs"
                            >
                              Try M-Pesa again
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={handlePayDepositCard}
                          disabled={payBusy !== null}
                          className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
                        >
                          {payBusy === 'card' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}
                          Pay by card
                        </button>
                        {isKes && (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <label htmlFor="quote-mpesa-phone" className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <Smartphone className="size-4 text-slate-500" aria-hidden="true" />
                              M-Pesa number
                            </label>
                            <div className="mt-2 flex gap-2">
                              <input
                                id="quote-mpesa-phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="0712345678"
                                value={mpesaPhone}
                                onChange={(event) => setMpesaPhone(event.target.value)}
                                className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              />
                              <button
                                type="button"
                                onClick={handlePayDepositMpesa}
                                disabled={payBusy !== null}
                                className="btn-primary shrink-0 px-3 py-2 text-xs disabled:opacity-60"
                              >
                                {payBusy === 'mpesa' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : 'Push'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {payError && <p className="mt-3 text-xs font-medium text-red-600">{payError}</p>}
                    <p className="mt-3 text-xs text-slate-500">
                      Prefer bank transfer or have questions? <Link href="/contact" className="font-semibold text-blue-700 underline-offset-2 hover:underline">Contact our team</Link> with reference {submittedQuote.proposalCode}.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col justify-center gap-3 text-center sm:flex-row">
            <Link href="/pricing" className="btn-secondary justify-center px-5 py-3 text-sm">Review service plans</Link>
            <Link href="/contact" className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">Contact our team</Link>
          </div>
        </section>
      </main>
    );
  }

  // Pre-formatted message for WhatsApp or Form
  const breakdownMessage = `Hello BazionWeb, I configured an estimate on your website:
* Market: ${config.market === 'kenya' ? 'Kenya (KES)' : 'International (USD)'}
* Package: ${pkgInfo.name} (${currencySymbol} ${baseCost.toLocaleString()})
* Extra Pages: ${config.extraPages} (+${currencySymbol} ${extraPagesCost.toLocaleString()})
* Add-ons: ${config.selectedAddOns.join(', ') || 'None'} (+${currencySymbol} ${addOnsCost.toLocaleString()})
${config.rushDelivery ? '* Priority Rush Delivery: YES (+35%)\n' : ''}* Estimated One-Time Build: ${currencySymbol} ${totalBuild.toLocaleString()}
* Maintenance Care: ${config.care} (${currencySymbol} ${monthlyCare.toLocaleString()}/mo)
* Hosting: ${config.hosting} (${currencySymbol} ${annualHosting.toLocaleString()}/yr)
* Total Year 1 Estimate: ${currencySymbol} ${totalYearOne.toLocaleString()}

Please confirm availability and discuss next steps.`;

  const whatsappHref = buildWhatsAppLink(breakdownMessage);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-[#0F172A] pt-32 pb-16 text-white">
        <div className="container-default max-w-5xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Instant Quote Calculator' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-3">
            Interactive Cost Estimator
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Build your custom project estimate
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed mb-4">
            Configure your website tier, extra pages, payment integrations, and managed care plans.
            Itemized transparency with zero hidden markups.
          </p>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-slate-200">
            <span>{marketDef.flag}</span>
            <span className="font-semibold text-white">{marketDef.currency} Commercial Schedule</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">
              {marketCode === 'KE' ? 'M-Pesa STK · 16% KRA VAT Inclusive' : 'Card / Wire · 0% Export'}
            </span>
          </div>
        </div>
      </div>

      <div className="container-default max-w-5xl py-12">
        {/* Progress Navigation */}
        <div className="flex items-center gap-3 mb-10 overflow-x-auto pb-2">
          {[
            { num: 1, label: 'Core Package & Pages' },
            { num: 2, label: 'Add-Ons & Integrations' },
            { num: 3, label: 'Care & Maintenance' },
          ].map(s => {
            const active = step === s.num;
            const done = step > s.num;
            return (
              <button
                key={s.num}
                onClick={() => setStep(s.num as 1 | 2 | 3)}
                className="flex items-center gap-2 shrink-0"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done
                      ? 'bg-[#22C55E] text-white'
                      : active
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span
                  className={`text-sm font-semibold ${
                    active ? 'text-[#0F172A]' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
                {s.num < 3 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left: Step Configurator */}
          <div className="lg:col-span-2 space-y-6">
            {/* STEP 1: Core Package & Pages */}
            {step === 1 && (
              <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-[#0F172A] mb-1">
                  1. Select Your Baseline Package
                </h2>
                <p className="text-xs text-slate-500 mb-6">
                  Each package includes mobile-first architecture, SSL, SEO setup, and included post-launch defect warranty.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {(
                    [
                      { id: 'launch', name: 'Launch', desc: 'Up to 5 pages, brochure setup', pages: 5 },
                      { id: 'business', name: 'Business', desc: 'Up to 10 pages + CMS + Blog', pages: 10, rec: true },
                      { id: 'professional', name: 'Professional', desc: 'Up to 15 pages + Advanced UX', pages: 15 },
                      { id: 'ecom-starter', name: 'E-Commerce Starter', desc: 'Store + M-Pesa/Card Checkout', pages: 8 },
                      { id: 'ecom-business', name: 'E-Commerce Business', desc: '100+ products, stock, coupons', pages: 15 },
                      { id: 'custom', name: 'Custom Architecture', desc: 'Bespoke web applications', pages: 5 },
                    ] as { id: keyof typeof PACKAGE_DEFAULTS; name: string; desc: string; pages: number; rec?: boolean }[]
                  ).map(pkg => {
                    const cost = config.market === 'kenya'
                      ? PACKAGE_DEFAULTS[pkg.id].kenyaCost
                      : PACKAGE_DEFAULTS[pkg.id].intlCost;
                    const isSelected = config.packageType === pkg.id;

                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, packageType: pkg.id }))}
                        className={`text-left p-4 rounded-xl border-2 transition-all relative ${
                          isSelected
                            ? 'border-[#2563EB] bg-blue-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {pkg.rec && (
                          <span className="absolute -top-2.5 right-3 bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                        <div className="font-bold text-[#0F172A] text-sm mb-0.5">{pkg.name}</div>
                        <div className="text-xs text-slate-500 mb-2">{pkg.desc}</div>
                        <div className="text-base font-extrabold text-[#2563EB]">
                          {currencySymbol} {cost.toLocaleString()}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Additional Pages Counter */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-sm text-[#0F172A]">Need Additional Pages?</div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Package baseline includes {pkgInfo.basePages} pages. Extra pages are {currencySymbol} {extraPageRate.toLocaleString()} each.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, extraPages: Math.max(0, prev.extraPages - 1) }))}
                        className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                      >
                        −
                      </button>
                      <span className="text-base font-black text-[#0F172A] w-6 text-center">
                        {config.extraPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, extraPages: prev.extraPages + 1 }))}
                        className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-primary text-xs px-6 py-3"
                  >
                    Next: Add-Ons & Integrations <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Add-Ons & Integrations */}
            {step === 2 && (
              <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-[#0F172A] mb-1">
                  2. Choose Add-Ons & Functional Modules
                </h2>
                <p className="text-xs text-slate-500 mb-6">
                  Select additional features or integrations to bundle into your build quotation.
                </p>

                <div className="space-y-3 mb-8">
                  {ADD_ON_RATE_CARD.filter(a => a.id !== 'extra-page' && a.id !== 'rush-delivery').map(addon => {
                    const isChecked = config.selectedAddOns.includes(addon.id);
                    const price = config.market === 'kenya' ? addon.kenyaPrice : addon.intlPrice;

                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddOn(addon.id)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                          isChecked
                            ? 'border-[#2563EB] bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-[#0F172A]">{addon.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{addon.description}</div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="text-xs font-bold text-[#2563EB]">{price}</span>
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'bg-[#2563EB] border-[#2563EB] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Priority Rush Delivery Option */}
                <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/70 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-amber-900">Priority Rush Delivery (+35%)</div>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Fast-track your timeline by assigning dedicated senior engineering sprints.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, rushDelivery: !prev.rushDelivery }))}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      config.rushDelivery
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    {config.rushDelivery ? 'Rush Enabled' : 'Add Rush'}
                  </button>
                </div>

                <div className="flex justify-between mt-8">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary text-xs px-5 py-2.5 flex items-center gap-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn-primary text-xs px-6 py-3"
                  >
                    Next: Care & Maintenance <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Care & Maintenance */}
            {step === 3 && (
              <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A] mb-1">
                    3. Website Care & Ongoing Maintenance
                  </h2>
                  <p className="text-xs text-slate-500 mb-6">
                    Choose monthly proactive maintenance, software updates, security scanning, and developer support for your website after launch.
                  </p>

                  {/* Monthly Care options */}
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Website Care & Maintenance (Monthly):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'care-essential', name: 'Care Essential', price: config.market === 'kenya' ? 'KSh 5,000/mo' : '$75/mo', desc: 'Updates, backups, monitoring + 1 hr support' },
                      { id: 'care-business', name: 'Care Business', price: config.market === 'kenya' ? 'KSh 10,000/mo' : '$150/mo', desc: 'Weekly updates, SEO reviews + 2 hr support', rec: true },
                      { id: 'care-professional', name: 'Care Professional', price: config.market === 'kenya' ? 'KSh 20,000/mo' : '$300/mo', desc: 'Proactive dev, speed audits + 5 hr support' },
                      { id: 'none', name: 'No Care Plan (Warranty only)', price: 'Included Warranty', desc: 'Post-launch free defect warranty only' },
                    ].map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, care: c.id }))}
                        className={`text-left p-4 rounded-xl border-2 transition-all relative ${
                          config.care === c.id
                            ? 'border-[#2563EB] bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {c.rec && (
                          <span className="absolute -top-2.5 right-3 bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                        <div className="font-bold text-sm text-[#0F172A]">{c.name}</div>
                        <div className="text-xs text-slate-500 mb-1">{c.desc}</div>
                        <div className="text-sm font-extrabold text-[#14B8A6]">{c.price}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-200">
                  {/* Primary CTA: Get Started */}
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 active:scale-[0.98] text-white text-sm font-black transition-all shadow-xl shadow-slate-900/10 group"
                  >
                    <FileText className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                    <span>Request Official Project Proposal</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <div className="flex justify-between items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackWhatsAppOpen('quote')}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Quote
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Authoritative Proposal & Scope Summary */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="bg-white border border-slate-200/90 shadow-xl shadow-slate-900/5 rounded-3xl p-6 relative overflow-hidden ring-1 ring-slate-900/5">
              {/* Subtle top accent bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#2563EB] via-indigo-600 to-teal-500" />

              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                    Proposal Summary
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  <Globe className="w-3 h-3 text-[#2563EB]" />
                  <span>{config.market === 'kenya' ? 'Kenya · KES' : 'Global · USD'}</span>
                </div>
              </div>

              {/* Scope Breakdown */}
              <div className="space-y-3 py-2 text-xs">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{pkgInfo.name}</span>
                    <span className="text-[11px] text-slate-400">
                      Baseline build ({pkgInfo.basePages} pages included)
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 text-sm shrink-0">
                    {currencySymbol} {baseCost.toLocaleString()}
                  </span>
                </div>

                {config.extraPages > 0 && (
                  <div className="flex justify-between items-center text-slate-600 py-1 border-t border-dashed border-slate-100">
                    <span>+{config.extraPages} Additional Custom Pages</span>
                    <span className="font-semibold text-slate-900">
                      +{currencySymbol} {extraPagesCost.toLocaleString()}
                    </span>
                  </div>
                )}

                {config.selectedAddOns.map(id => {
                  const item = ADD_ON_RATE_CARD.find(a => a.id === id);
                  if (!item) return null;
                  const itemPrice = config.market === 'kenya' ? item.rawKes : item.rawUsd;
                  return (
                    <div key={id} className="flex justify-between items-center text-slate-600 py-1 border-t border-dashed border-slate-100">
                      <span className="truncate pr-2">• {item.name}</span>
                      <span className="font-semibold text-slate-900 shrink-0">
                        +{currencySymbol} {itemPrice.toLocaleString()}
                      </span>
                    </div>
                  );
                })}

                {config.rushDelivery && (
                  <div className="flex justify-between items-center text-amber-700 py-1 border-t border-dashed border-slate-100 font-semibold">
                    <span>Priority Rush Delivery (+35%)</span>
                    <span>+{currencySymbol} {rushCost.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Recurring & Maintenance */}
              <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span className="text-[11px] font-medium text-slate-500">Website Care &amp; Support:</span>
                  <span className="font-bold text-slate-900">
                    {monthlyCare > 0 ? `${currencySymbol} ${monthlyCare.toLocaleString()}/mo` : 'Included Defect Warranty'}
                  </span>
                </div>
                {config.hosting !== 'none' && (
                  <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                    <span className="text-[11px] font-medium text-slate-500">Managed Annual Hosting:</span>
                    <span className="font-bold text-slate-900">
                      +{currencySymbol} {annualHosting.toLocaleString()}/yr
                    </span>
                  </div>
                )}
              </div>

              {/* Total Investment Block */}
              <div className="pt-2">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Estimated Build
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {currencySymbol} {totalBuild.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                  <span>50% Kickoff Deposit on approval:</span>
                  <span className="font-bold text-emerald-600">
                    {currencySymbol} {Math.round(totalBuild * 0.5).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons: HERO PROPOSAL BUTTON is prominent, others do NOT shout */}
              <div className="space-y-2.5 pt-2">
                {/* 1. HERO PROPOSAL CTA */}
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 active:scale-[0.99] text-white text-sm font-black transition-all shadow-xl shadow-slate-900/20 group"
                >
                  <FileText className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                  <span>Request Official Project Proposal</span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* 2. SUBTLE, DE-ESCALATED SECONDARY OPTIONS */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackWhatsAppOpen('quote')}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-600 hover:text-emerald-700 text-xs font-semibold transition-all text-center"
                    title="Share this estimate via WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Quote</span>
                  </a>

                  <Link
                    href={`/contact?source=quote-calculator&package=${config.packageType}`}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-all text-center"
                  >
                    <span>Free Consultation</span>
                  </Link>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>100% IP &amp; Code Ownership. Zero Vendor Lock-in.</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Price locked for 30 days upon proposal generation.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Get Started Modal Overlay ─────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proposal-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
            {/* Modal header - Clean, Executive Obsidian */}
            <div className="bg-[#0F172A] px-7 py-6 text-white relative">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close proposal form"
                className="absolute right-5 top-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-teal-400">
                  Instant Project Proposal
                </span>
              </div>
              <h2 id="proposal-modal-title" className="text-xl font-black text-white tracking-tight">
                Request Your Formal Proposal
              </h2>
              <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                We&apos;ll generate an official itemized proposal, milestone delivery schedule, and 30-day fixed price lock.
              </p>
            </div>

            {/* Configured Package Summary Chip inside modal */}
            <div className="px-7 pt-5 pb-1">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Target Build</span>
                  <span className="font-extrabold text-slate-900 text-sm">{pkgInfo.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Estimated Scope</span>
                  <span className="font-black text-[#2563EB] text-sm">{currencySymbol} {totalBuild.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal form - Clean, Straightforward, No Stuffy Overcrowding */}
            <form onSubmit={handleGetStarted} className="px-7 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="gs-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="gs-name"
                      type="text"
                      required
                      autoFocus
                      autoComplete="name"
                      maxLength={100}
                      value={gName}
                      onChange={e => setGName(e.target.value)}
                      placeholder="Jane Wanjiku"
                      className="w-full border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="gs-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="gs-email"
                      type="email"
                      required
                      autoComplete="email"
                      maxLength={254}
                      value={gEmail}
                      onChange={e => setGEmail(e.target.value)}
                      placeholder="jane@yourcompany.com"
                      className="w-full border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="gs-company" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Company or Organization <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="gs-company"
                  type="text"
                  maxLength={100}
                  value={gCompany}
                  onChange={e => setGCompany(e.target.value)}
                  placeholder="e.g. Acacia Healthcare Ltd"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                />
              </div>

              <div>
                <label htmlFor="gs-country" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Contracting Region &amp; Currency
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    id="gs-country"
                    value={gCountry}
                    onChange={e => {
                      const countryCode = e.target.value;
                      setGCountry(countryCode);
                      setConfig(prev => ({
                        ...prev,
                        market: mapCountryToMarket(countryCode) === 'KE' ? 'kenya' : 'international',
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium cursor-pointer"
                  >
                    <option value="KE">🇰🇪 Kenya (KES · M-Pesa &amp; Paystack)</option>
                    <option value="UG">🇺🇬 Uganda (East Africa Region · KES/USD)</option>
                    <option value="TZ">🇹🇿 Tanzania (East Africa Region · KES/USD)</option>
                    <option value="RW">🇷🇼 Rwanda (East Africa Region · KES/USD)</option>
                    <option value="US">🇺🇸 United States &amp; Global (USD · Card &amp; Wire)</option>
                    <option value="GB">🇬🇧 United Kingdom (USD · International)</option>
                    <option value="CA">🇨🇦 Canada (USD · Global Rails)</option>
                    <option value="AU">🇦🇺 Australia (USD · Global Rails)</option>
                    <option value="DE">🇩🇪 Germany / Europe (USD · International)</option>
                    <option value="OTHER">🌍 Other International (USD · Global SLA)</option>
                  </select>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <Lock className="w-3 h-3 text-emerald-600" /> Fixed Price Locked for 30 Days
                  </span>
                  <span className="text-slate-400">Zero Obligation</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={gLoading || !gName.trim() || !gEmail.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs transition-all shadow-xl shadow-slate-900/10 mt-3 group"
              >
                {gLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span>Preparing Official Proposal…</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                    <span>Generate Official Project Proposal</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {submissionError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submissionError}</span>
                </div>
              )}

              <p className="text-center text-[11px] text-slate-400 leading-relaxed pt-1">
                No credit card or upfront payment needed. By proceeding, you agree to our{' '}
                <Link href="/legal/terms" className="text-slate-600 hover:text-slate-900 underline font-medium">Terms of Service</Link>.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuoteCalculatorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0F172A] pt-40 flex items-center justify-center text-white">
        Loading interactive quote calculator...
      </div>
    }>
      <QuoteCalculatorContent />
    </Suspense>
  );
}
