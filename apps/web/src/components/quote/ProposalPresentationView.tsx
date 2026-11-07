'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Printer,
  MessageSquare,
  ArrowRight,
  Check,
  CreditCard,
  Smartphone,
  Loader2,
  Clock,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Building2,
  User,
  Globe,
} from 'lucide-react';
import { resolveApiV1Base } from '@/lib/api-base';
import { buildWhatsAppLink, trackWhatsAppOpen } from '@/lib/contact';
import { isTrustedCheckoutUrl, normalizeKenyanPhoneNumber } from '@/lib/utils';
import ClientJourneyProgress from '@/components/navigation/ClientJourneyProgress';
import {
  generateDocumentChecksum,
  generateCode128BarcodeSvg,
  renderDigitalStampSvg,
  BAZION_CORPORATE_DETAILS,
} from '@/lib/document-branding';


import type { ProposalItem, ProposalViewModel } from '@/lib/quote-flow';
export type { ProposalItem, ProposalViewModel };

export interface ProposalPresentationViewProps {
  proposal: ProposalViewModel;
  onReset?: () => void;
  initialContact?: {
    name: string;
    email: string;
    company?: string;
  };
}

// The API's global TransformInterceptor wraps success payloads as { data: ... }.
function unwrapApiPayload<T>(payload: unknown): T {
  const node = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  return (node.data && typeof node.data === 'object' ? node.data : node) as T;
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  const node = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const message = node.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && message.length) return message.join('. ');
  return fallback;
}

export function ProposalPresentationView({
  proposal,
  onReset,
  initialContact,
}: ProposalPresentationViewProps) {
  // Quote-to-close action center states
  const [acceptStage, setAcceptStage] = useState<'idle' | 'confirm' | 'accepted'>(
    proposal.depositInvoice ? 'accepted' : 'idle'
  );
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  const [deposit, setDeposit] = useState<{
    id?: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    depositPercent: number;
  } | null>(
    proposal.depositInvoice
      ? {
          id: proposal.depositInvoice.id,
          invoiceNumber: proposal.depositInvoice.invoiceNumber,
          amount: proposal.depositInvoice.amount,
          currency: proposal.depositInvoice.currency,
          depositPercent: 50,
        }
      : null
  );

  const [payBusy, setPayBusy] = useState<'card' | 'mpesa' | null>(null);
  const [payError, setPayError] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [stk, setStk] = useState<{ trackingId: string; message: string } | null>(null);
  const [payState, setPayState] = useState<'waiting' | 'paid' | 'failed'>(
    proposal.depositInvoice?.status === 'PAID' ? 'paid' : 'waiting'
  );

  const isKes = proposal.currency === 'KES' || proposal.currencySymbol === 'KSh';
  const proposalApi = (path: string) =>
    `${resolveApiV1Base()}/invoices/proposals/${encodeURIComponent(proposal.proposalCode)}${path}`;

  // Calculate validity countdown
  const now = new Date().getTime();
  const expiresTime = new Date(proposal.expiresAt).getTime();
  const diffDays = Math.max(0, Math.ceil((expiresTime - now) / (1000 * 60 * 60 * 24)));
  const isExpired = proposal.status === 'EXPIRED' || expiresTime < now;

  // Anti-Fake Security & Authenticity Credentials
  const checksum = useMemo(() => {
    return generateDocumentChecksum({
      docNumber: proposal.proposalCode,
      amount: proposal.totalAmount,
      currency: proposal.currency,
      recipientEmail: proposal.clientEmail,
      issueDate: proposal.createdAt,
    });
  }, [proposal.proposalCode, proposal.totalAmount, proposal.currency, proposal.clientEmail, proposal.createdAt]);

  const cleanHashSuffix = checksum.replace(/^SHA256:\s*/, '').replace(/-/g, '').slice(0, 8);
  const verifyUrl = `${BAZION_CORPORATE_DETAILS.registryUrl}?ref=${encodeURIComponent(proposal.proposalCode)}&sig=${encodeURIComponent(cleanHashSuffix)}`;

  const securityBarcodeSvg = useMemo(() => {
    const barcodePayload = String(proposal.proposalCode || 'BAZION').trim().toUpperCase();
    return generateCode128BarcodeSvg(barcodePayload, { width: 260, height: 42, darkColor: '#000000' });
  }, [proposal.proposalCode]);

  const digitalStampSvg = useMemo(() => {
    const isAccepted = acceptStage === 'accepted' || proposal.status === 'ACCEPTED';
    return renderDigitalStampSvg({
      docNumber: proposal.proposalCode,
      status: isAccepted ? 'PAID' : 'AUTHENTICATED',
      tone: isAccepted ? 'emerald' : 'blue',
      size: 132,
    });
  }, [proposal.proposalCode, acceptStage, proposal.status]);

  async function fetchProposalEndpoint(path: string, body: Record<string, unknown>): Promise<Response> {
    const url = proposalApi(path);
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
    try {
      const res = await fetch(url, init);
      if (res && res.status >= 500) {
        await new Promise((r) => setTimeout(r, 400));
        const retryRes = await fetch(url, init).catch(() => null);
        if (retryRes) return retryRes;
      }
      return res;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
      return fetch(url, init);
    }
  }

  async function handleAcceptProposal() {
    setAccepting(true);
    setAcceptError('');
    try {
      const nameParts = (initialContact?.name || proposal.clientName || 'Valued Client').trim().split(/\s+/);
      const response = await fetchProposalEndpoint('/accept', {
        code: proposal.proposalCode,
        email: (initialContact?.email || proposal.clientEmail).trim().toLowerCase(),
        firstName: nameParts[0] || undefined,
        lastName: nameParts.slice(1).join(' ') || undefined,
        businessName: (initialContact?.company || proposal.clientCompany || '').trim() || undefined,
      });
      const envelope = await response.json().catch(() => ({}));
      const data = unwrapApiPayload(envelope) as {
        invoice?: { id?: string; invoiceNumber: string; amount: number; currency: string };
        depositPercent?: number;
      };
      if (!response.ok || !data.invoice) {
        throw new Error(apiErrorMessage(envelope, 'We could not accept the proposal. Please try again.'));
      }
      setDeposit({
        id: data.invoice.id,
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
      const response = await fetchProposalEndpoint('/pay/card', {
        email: (initialContact?.email || proposal.clientEmail).trim().toLowerCase(),
      });
      const envelope = await response.json().catch(() => ({}));
      const data = unwrapApiPayload(envelope) as { checkoutUrl?: string };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(apiErrorMessage(envelope, 'Card checkout could not start. Please try again.'));
      }
      if (!isTrustedCheckoutUrl(data.checkoutUrl)) {
        throw new Error('Payment gateway returned an invalid or untrusted checkout URL.');
      }
      window.location.href = data.checkoutUrl;
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Card checkout could not start. Please try again.');
      setPayBusy(null);
    }
  }

  async function handlePayDepositMpesa() {
    const normalized = normalizeKenyanPhoneNumber(mpesaPhone);
    if (!normalized) {
      setPayError('Enter a valid Kenyan mobile number, e.g. 0712 345 678, 0110 123 456, or +254 7XX XXX XXX.');
      return;
    }
    setPayBusy('mpesa');
    setPayError('');
    try {
      const response = await fetch(proposalApi('/pay/mpesa'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mpesaPhoneNumber: normalized }),
      });

      const envelope = await response.json().catch(() => ({}));
      const data = unwrapApiPayload(envelope) as { trackingId?: string; message?: string };
      if (!response.ok || !data.trackingId) {
        throw new Error(apiErrorMessage(envelope, 'M-Pesa prompt could not be sent. Please try again.'));
      }
      setStk({
        trackingId: String(data.trackingId),
        message: String(data.message || 'M-Pesa prompt sent. Check your handset and enter your PIN.'),
      });
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'M-Pesa prompt could not be sent. Please try again.');
    } finally {
      setPayBusy(null);
    }
  }

  // Poll M-Pesa STK push status
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
        // Transient error — continue polling
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

  // Pre-composed WhatsApp consultation link
  const whatsappConsultMessage = `Hello BazionWeb Engineering Team, I am reviewing official proposal ${proposal.proposalCode} for ${proposal.clientName} (${proposal.currencySymbol} ${proposal.totalAmount.toLocaleString()}). I would like to consult on the scope and delivery timeline.`;
  const whatsappHref = buildWhatsAppLink(whatsappConsultMessage);

  return (
    <div className="min-h-screen bg-slate-50 py-10 sm:py-16 print:bg-white print:py-0">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 print:px-0 print:max-w-none">

        {/* ─── Macro Lifecycle Progress Indicator (Screen Only) ─── */}
        <div className="mb-6 max-w-5xl mx-auto print:hidden">
          <ClientJourneyProgress currentStep={acceptStage === 'accepted' ? 3 : 2} variant="light" />
        </div>

        {/* Navigation & Secondary Actions Bar (Screen Only) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Build another quote
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
            >
              <Printer className="size-4 text-slate-500" aria-hidden="true" />
              Download / Print PDF
            </button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppOpen('quote')}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-xs hover:bg-emerald-100/80 transition-all active:scale-[0.98]"
            >
              <MessageSquare className="size-4 text-emerald-600" aria-hidden="true" />
              WhatsApp Engineer
            </a>
          </div>
        </div>

        {/* ─── Executive Proposal Document Container ─── */}
        <article className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl print:border-none print:shadow-none print:rounded-none">

          {/* Top Brand Bar & Header */}
          <div className="relative bg-[#0F172A] px-6 py-8 text-white sm:px-10 sm:py-10 print:bg-white print:text-black print:px-0 print:py-4 print:border-b-2 print:border-slate-800">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={BAZION_CORPORATE_DETAILS.logoPath}
                  alt="BazionWeb – Build, Host n Grow"
                  className="h-16 w-auto rounded-lg border border-white/20 bg-[#EBEBEB] object-contain shadow-sm shrink-0 print:border-slate-300"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-2xl font-black tracking-tight text-white print:text-slate-900">
                      Bazion<span className="text-[#38BDF8] print:text-[#2563EB]">Web</span>
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-300 print:border print:border-slate-300 print:text-slate-700">
                      Commercial Proposal
                    </span>
                  </div>
                  <h1 className="text-xl font-extrabold text-white sm:text-2xl print:text-slate-900">
                    Turnkey Engineering &amp; Scope Statement
                  </h1>
                  <p className="mt-1 text-xs text-slate-300 sm:text-sm print:text-slate-600">
                    {BAZION_CORPORATE_DETAILS.legalName} (Proprietor: {BAZION_CORPORATE_DETAILS.proprietor}) · KRA PIN: {BAZION_CORPORATE_DETAILS.taxPin} · Reg: {BAZION_CORPORATE_DETAILS.regNumber}
                  </p>
                </div>
              </div>

              {/* Reference & Validity Badge */}
              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-sm text-left sm:text-right print:border-slate-300 print:bg-slate-50">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 print:text-slate-500">
                    Official Proposal Code
                  </span>
                  <span className="font-mono text-base font-extrabold text-white print:text-slate-900">
                    {proposal.proposalCode}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isExpired ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 px-3 py-1 text-xs font-bold text-amber-300">
                      <Clock className="size-3.5" aria-hidden="true" />
                      Validity Expired
                    </span>
                  ) : proposal.status === 'ACCEPTED' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-bold text-emerald-300">
                      <ShieldCheck className="size-3.5" aria-hidden="true" />
                      Proposal Accepted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 border border-teal-400/30 px-3 py-1 text-xs font-bold text-teal-300">
                      <Lock className="size-3.5" aria-hidden="true" />
                      Price Locked · {diffDays} days left
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10 print:px-0">
            {/* ─── Client Information Card ─── */}
            <section aria-labelledby="client-info-heading" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6 mb-8">
              <h2 id="client-info-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Engagement &amp; Contracting Details
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div>
                  <span className="block text-slate-400 font-semibold mb-0.5">Prepared For:</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <User className="size-3.5 text-[#2563EB]" aria-hidden="true" />
                    <span>{proposal.clientName}</span>
                  </div>
                  <span className="text-slate-500 block truncate">{proposal.clientEmail}</span>
                </div>

                <div>
                  <span className="block text-slate-400 font-semibold mb-0.5">Organization:</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Building2 className="size-3.5 text-[#2563EB]" aria-hidden="true" />
                    <span>{proposal.clientCompany || 'Commercial Client'}</span>
                  </div>
                  <span className="text-slate-500 block">Direct Engagement</span>
                </div>

                <div>
                  <span className="block text-slate-400 font-semibold mb-0.5">Contracting Market:</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Globe className="size-3.5 text-[#2563EB]" aria-hidden="true" />
                    <span>{proposal.marketCode === 'KE' ? 'Kenya (KES)' : 'International (USD)'}</span>
                  </div>
                  <span className="text-slate-500 block">
                    {proposal.marketCode === 'KE' ? 'Direct Regional Settlement' : 'Cross-Border Settlement'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-400 font-semibold mb-0.5">Issuance &amp; Expiry:</span>
                  <div className="font-bold text-slate-900 text-sm">
                    {new Date(proposal.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <span className="text-slate-500 block">
                    Valid through {new Date(proposal.expiresAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </section>

            {/* ─── Itemized Scope of Work Table ─── */}
            <section aria-labelledby="scope-heading" className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <h2 id="scope-heading" className="text-base font-extrabold text-slate-900">
                  Itemized Scope of Work &amp; Deliverables
                </h2>
                <span className="text-xs font-semibold text-slate-500">Fixed-Price Turnkey Delivery</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th scope="col" className="py-3 px-4 sm:px-6">Deliverable / Technical Specification</th>
                      <th scope="col" className="py-3 px-4 hidden sm:table-cell">Type</th>
                      <th scope="col" className="py-3 px-4 sm:px-6 text-right">Investment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {proposal.lineItems.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-bold text-slate-900">{item.title}</div>
                          {item.subtitle && <div className="text-xs text-slate-500 mt-0.5">{item.subtitle}</div>}
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell">
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {item.kind === 'package' ? 'Baseline Architecture' : item.kind === 'extra-pages' ? 'Custom Pages' : item.kind === 'rush-delivery' ? 'Accelerated Sprint' : 'Functional Module'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-slate-900">
                          {proposal.currencySymbol} {item.price.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-bold">
                      <td colSpan={2} className="py-3 px-4 sm:px-6 text-slate-900 text-sm">
                        Total One-Time Build Investment
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-right text-lg font-black text-[#2563EB]">
                        {proposal.currencySymbol} {proposal.totalAmount.toLocaleString()}
                      </td>
                    </tr>
                    {proposal.recurringMonthlyCare && (
                      <tr className="border-t border-slate-200 text-xs text-slate-600">
                        <td colSpan={2} className="py-2.5 px-4 sm:px-6">
                          Ongoing Monthly Proactive Website Care &amp; Support
                        </td>
                        <td className="py-2.5 px-4 sm:px-6 text-right font-bold text-slate-900">
                          {proposal.currencySymbol} {proposal.recurringMonthlyCare.amount.toLocaleString()} / month
                        </td>
                      </tr>
                    )}
                    {proposal.recurringAnnualHosting && (
                      <tr className="border-t border-slate-200 text-xs text-slate-600">
                        <td colSpan={2} className="py-2.5 px-4 sm:px-6">
                          Managed High-Speed NVMe Annual Cloud Hosting
                        </td>
                        <td className="py-2.5 px-4 sm:px-6 text-right font-bold text-slate-900">
                          {proposal.currencySymbol} {proposal.recurringAnnualHosting.amount.toLocaleString()} / year
                        </td>
                      </tr>
                    )}
                    {proposal.totalYearOne && (
                      <tr className="border-t border-slate-200 bg-blue-50/50 font-extrabold text-xs text-blue-900">
                        <td colSpan={2} className="py-2.5 px-4 sm:px-6">
                          Estimated Total Year 1 Commitment (Build + Care + Hosting)
                        </td>
                        <td className="py-2.5 px-4 sm:px-6 text-right text-sm text-[#2563EB]">
                          {proposal.currencySymbol} {proposal.totalYearOne.toLocaleString()}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </section>

            {/* ─── Transparent 50/50 Payment Milestone Schedule ─── */}
            <section aria-labelledby="milestones-heading" className="mb-10">
              <h2 id="milestones-heading" className="text-base font-extrabold text-slate-900 mb-1">
                Transparent 50/50 Milestone Payment Schedule
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                We believe in total financial transparency. No surprise fees. Payment is split into two equal tranches:
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="rounded-full bg-[#2563EB] px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      Milestone 1 · Due Now
                    </span>
                    <span className="font-black text-lg text-slate-900">
                      {proposal.currencySymbol} {proposal.depositAmount.toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">50% Kickoff Deposit</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Reserves dedicated senior engineering capacity, initiates Phase 1 Discovery, and unlocks your private client hub. Due within 7 calendar days.
                  </p>
                  <div className="mt-3 text-[11px] font-semibold text-[#2563EB]">
                    Payment rails: M-Pesa STK Push (Instant KES) &bull; Visa/Mastercard (Paystack) &bull; Corporate Wire
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Milestone 2 · At Launch
                    </span>
                    <span className="font-black text-lg text-slate-900">
                      {proposal.currencySymbol} {proposal.finalAmount.toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">50% Final Launch Settlement</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Payable strictly upon staging review, acceptance testing, and your final sign-off before production domain DNS cutover.
                  </p>
                  <div className="mt-3 text-[11px] font-semibold text-slate-500">
                    Triggers production release, complete repository handover, and defect warranty activation.
                  </div>
                </div>
              </div>
            </section>

            {/* ─── 5-Phase Turnkey Delivery Roadmap ─── */}
            <section aria-labelledby="roadmap-heading" className="mb-10">
              <h2 id="roadmap-heading" className="text-base font-extrabold text-slate-900 mb-1">
                5-Phase Turnkey Delivery Roadmap
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Structured delivery with regular staging checkpoints and zero black-box delays:
              </p>

              <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                {[
                  { phase: 'Phase 1', title: 'Discovery & Spec', window: 'Days 1–3', desc: 'Requirements review, asset ingestion, and architecture freeze.' },
                  { phase: 'Phase 2', title: 'UI/UX Design', window: 'Days 4–8', desc: 'Figma mockups, design tokens, and client approval checkpoint.' },
                  { phase: 'Phase 3', title: 'Core Build', window: 'Days 9–18', desc: 'Next.js components, database models, and payment integrations.' },
                  { phase: 'Phase 4', title: 'QA & Speed', window: 'Days 19–22', desc: 'Lighthouse 90+ optimization, cross-browser, and security audit.' },
                  { phase: 'Phase 5', title: 'Launch & Handover', window: 'Days 23–25', desc: 'DNS cutover, SSL, admin training, and credential vault release.' },
                ].map((step, idx) => (
                  <li key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{step.phase}</span>
                        <span className="text-[10px] font-bold text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded">{step.window}</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 mt-1">{step.title}</div>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* ─── Terms & Contractual Safeguards ─── */}
            <section aria-labelledby="terms-heading" className="mb-10 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
              <h2 id="terms-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Contractual Safeguards &amp; Intellectual Property
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-bold text-slate-900 block">100% IP &amp; Code Ownership</span>
                    <span className="text-slate-500 text-[11px] leading-relaxed">
                      You own all custom source code, assets, and data. Zero proprietary vendor lock-in. Full repository export provided.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Sparkles className="size-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-bold text-slate-900 block">30-Day Defect Warranty</span>
                    <span className="text-slate-500 text-[11px] leading-relaxed">
                      All post-launch bugs, browser discrepancies, or functional regressions are repaired under priority SLA at zero charge.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Lock className="size-4 text-teal-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-bold text-slate-900 block">Guaranteed Fixed Pricing</span>
                    <span className="text-slate-500 text-[11px] leading-relaxed">
                      The quoted prices are 100% locked against exchange rate changes or rate card increases for 30 calendar days.
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* ─── Interactive Action Center (Acceptance & Invoicing) ─── */}
            <section aria-labelledby="action-center-heading" className="rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-6 print:hidden">
              <h2 id="action-center-heading" className="text-sm font-extrabold text-slate-900 mb-1">
                Proposal Action Center
              </h2>

              {isExpired ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4 text-amber-600 shrink-0" aria-hidden="true" />
                    <span>This proposal has expired. Please request an updated proposal with refreshed rate card pricing.</span>
                  </div>
                  {onReset && (
                    <button
                      type="button"
                      onClick={onReset}
                      className="btn-primary text-xs px-3.5 py-2 shrink-0"
                    >
                      Refresh Quote
                    </button>
                  )}
                </div>
              ) : acceptStage === 'idle' ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-600">
                      Lock your build slot and kick off Milestone 1 with a 50% deposit ({proposal.currencySymbol} {proposal.depositAmount.toLocaleString()}). The balance is settled upon launch approval.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAcceptStage('confirm')}
                    className="btn-primary shrink-0 justify-center px-6 py-3.5 text-sm font-bold shadow-lg shadow-blue-500/20"
                  >
                    Accept Proposal &amp; Generate Kickoff Deposit Invoice
                    <ArrowRight className="size-4 ml-1" aria-hidden="true" />
                  </button>
                </div>
              ) : acceptStage === 'confirm' ? (
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-3">
                    Confirm recipient details to generate the official deposit invoice:
                  </p>
                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-4">
                    <div className="rounded-xl bg-white p-3 border border-slate-200">
                      <dt className="text-slate-400 font-medium">Recipient Name</dt>
                      <dd className="font-bold text-slate-900 mt-0.5">{proposal.clientName}</dd>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200">
                      <dt className="text-slate-400 font-medium">Billing Email</dt>
                      <dd className="font-bold text-slate-900 mt-0.5 truncate">{proposal.clientEmail}</dd>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200">
                      <dt className="text-slate-400 font-medium">Kickoff Deposit (50%)</dt>
                      <dd className="font-bold text-[#2563EB] mt-0.5">
                        {proposal.currencySymbol} {proposal.depositAmount.toLocaleString()}
                      </dd>
                    </div>
                  </dl>

                  {acceptError && (
                    <p className="mb-3 text-xs font-semibold text-red-600">{acceptError}</p>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      onClick={handleAcceptProposal}
                      disabled={accepting}
                      className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold disabled:opacity-60"
                    >
                      {accepting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
                      {accepting ? 'Generating Invoice…' : 'Confirm & Create Kickoff Deposit Invoice'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAcceptStage('idle'); setAcceptError(''); }}
                      className="btn-secondary w-full sm:w-auto justify-center px-4 py-3 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : acceptStage === 'accepted' && deposit ? (
                <div>
                  {payState === 'paid' ? (
                    <div className="text-center py-4">
                      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="size-6" aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-slate-900">Deposit Received — Your Build Slot is Locked</p>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600">
                        Invoice {deposit.invoiceNumber} is fully settled. Create your client portal password to access your project roadmap and track milestone deliverables.
                      </p>
                      <Link
                        href={`/portal/claim?email=${encodeURIComponent(proposal.clientEmail.trim().toLowerCase())}&autostart=1`}
                        className="btn-primary mt-4 inline-flex justify-center px-6 py-3 text-sm font-bold shadow-lg shadow-blue-500/20"
                      >
                        Set Up My Client Portal Hub
                        <ArrowRight className="size-4 ml-1" aria-hidden="true" />
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 pb-3 mb-4">
                        <div>
                          <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Deposit Invoice Created
                          </p>
                          <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
                            <span className="font-mono text-sm font-extrabold text-[#2563EB]">{deposit.invoiceNumber}</span>
                            {deposit.id && (
                              <a
                                href={`${resolveApiV1Base()}/invoices/${encodeURIComponent(deposit.id)}/pdf/download?proposalCode=${encodeURIComponent(proposal.proposalCode)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-[#2563EB] hover:bg-blue-50 transition-colors"
                              >
                                <Printer className="size-3" aria-hidden="true" />
                                Download Invoice PDF
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 block">Amount Payable</span>
                          <span className="text-base font-black text-slate-900">
                            {deposit.currency} {deposit.amount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 mb-4">
                        Choose your preferred settlement method below to confirm your build slot:
                      </p>

                      {stk ? (
                        <div className="rounded-xl bg-white p-5 text-center border border-slate-200">
                          {payState === 'waiting' && (
                            <>
                              <Loader2 className="mx-auto size-6 animate-spin text-[#2563EB]" aria-hidden="true" />
                              <p className="mt-2 text-sm font-bold text-slate-900">{stk.message}</p>
                              <p className="mt-1 font-mono text-xs text-slate-400">Tracking Ref: {stk.trackingId}</p>
                              <p className="mt-3 text-[11px] text-slate-500">Checking settlement status in real-time…</p>
                            </>
                          )}
                          {payState === 'failed' && (
                            <>
                              <p className="text-sm font-bold text-red-600">Payment Unsuccessful or Expired</p>
                              <p className="mt-1 text-xs text-slate-600">The prompt timed out or was declined on your handset.</p>
                              <button
                                type="button"
                                onClick={() => { setStk(null); setPayState('waiting'); }}
                                className="btn-secondary mt-3 justify-center px-4 py-2 text-xs"
                              >
                                Retry M-Pesa Prompt
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 mb-1">
                                <CreditCard className="size-4 text-[#2563EB]" aria-hidden="true" />
                                <span>Credit / Debit Card</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mb-4">
                                Visa, Mastercard, American Express. Instant receipt &amp; automated project activation.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handlePayDepositCard}
                              disabled={payBusy !== null}
                              className="btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold disabled:opacity-60"
                            >
                              {payBusy === 'card' ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CreditCard className="size-3.5" aria-hidden="true" />}
                              Pay by Card
                            </button>
                          </div>

                          {isKes && (
                            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 mb-1">
                                  <Smartphone className="size-4 text-emerald-600" aria-hidden="true" />
                                  <span>Safaricom M-Pesa STK Push</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-3">
                                  Enter your active Safaricom number to receive an instant PIN prompt on your phone.
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="tel"
                                  inputMode="tel"
                                  autoComplete="tel"
                                  placeholder="0712345678"
                                  value={mpesaPhone}
                                  onChange={(e) => setMpesaPhone(e.target.value)}
                                  className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={handlePayDepositMpesa}
                                  disabled={payBusy !== null}
                                  className="btn-primary shrink-0 px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                                >
                                  {payBusy === 'mpesa' ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : 'Prompt'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {payError && <p className="mt-3 text-xs font-medium text-red-600">{payError}</p>}
                    </>
                  )}
                </div>
              ) : null}
            </section>

            {/* ─── System-Generated Document Authentication & Anti-Fake Execution Center ─── */}
            <section
              aria-labelledby="digital-auth-heading"
              className="mt-10 pt-8 border-t-2 border-slate-900 print:mt-8 print:pt-6 print:border-slate-800 break-inside-avoid"
            >
              {/* Security Microprint Ribbon */}
              <div className="rounded-lg bg-slate-900 text-slate-300 font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 text-center mb-6">
                ••• BAZION WEB (BN-DLSZOZ6O) ••• OFFICIAL SYSTEM-GENERATED RECORD ••• TAMPER-EVIDENT ELECTRONIC AUTHENTICATION ••• ISO 14533 ALIGNED •••
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#2563EB]" aria-hidden="true" />
                  <h2 id="digital-auth-heading" className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Electronic Document Authentication &amp; Execution Record
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  <Lock className="size-3 text-emerald-600" aria-hidden="true" />
                  System-Generated &bull; Valid Without Physical Signature
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-4 text-xs mb-6">
                {/* 1. Linear Code-128B Security Barcode */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between print:bg-white print:border-slate-300">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                      <ShieldCheck className="size-3 text-slate-600" aria-hidden="true" />
                      Security Barcode (Code-128B)
                    </div>
                    <div className="flex justify-center my-1 overflow-x-auto">
                      <div
                        className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs inline-block"
                        dangerouslySetInnerHTML={{ __html: securityBarcodeSvg }}
                      />
                    </div>
                  </div>
                  <div className="text-center mt-3">
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Paybill: <strong>{BAZION_CORPORATE_DETAILS.paymentChannels.mpesaPaybill}</strong> (A/C <strong>{BAZION_CORPORATE_DETAILS.paymentChannels.mpesaAccountNumber}</strong>) &bull; Co-op Bank A/C: <strong>{BAZION_CORPORATE_DETAILS.paymentChannels.bankAccountNumber}</strong>
                    </p>
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1 text-[10px] font-bold text-blue-600 hover:underline break-all"
                    >
                      Verify online &rarr;
                    </a>
                  </div>
                </div>

                {/* 2. Client & Issuer Electronic Authorization Audit */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between print:bg-white print:border-slate-300">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Electronic Authorization Audit
                    </div>
                    <div className="space-y-1.5 text-slate-700">
                      <div>
                        <span className="text-slate-500">Authorized Recipient: </span>
                        <strong className="text-slate-900 block truncate">
                          {proposal.clientName}{proposal.clientCompany ? ` · ${proposal.clientCompany}` : ''}
                        </strong>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-500">Verified Billing Email: </span>
                        <span className="font-mono text-[11px] block truncate">{`‹${proposal.clientEmail}›`}</span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200/80">
                        <span className="text-slate-500">Issuing Entity: </span>
                        <strong className="text-slate-900 block">
                          {BAZION_CORPORATE_DETAILS.legalName}
                        </strong>
                        <span className="text-[10px] text-slate-500 font-mono">
                          PIN: {BAZION_CORPORATE_DETAILS.taxPin} · Reg: {BAZION_CORPORATE_DETAILS.regNumber}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1">Cryptographic Fingerprint:</span>
                    <div className="font-mono text-[9.5px] font-bold text-blue-700 bg-blue-50/80 border border-blue-200 px-2 py-1 rounded-md break-all">
                      {checksum}
                    </div>
                  </div>
                </div>

                {/* 3. Official Corporate Digital E-Stamp */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col items-center justify-center text-center print:bg-white print:border-slate-300">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 w-full text-left">
                    Official Corporate Digital Seal
                  </div>
                  <div
                    className="my-auto py-2"
                    dangerouslySetInnerHTML={{ __html: digitalStampSvg }}
                  />
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    SSOT Engine Ref: AUTH-{proposal.proposalCode}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-100/90 border border-slate-200 px-4 py-3 text-[10px] text-slate-600 leading-relaxed text-center print:bg-slate-50">
                <strong>Statutory Electronic Validity Notice:</strong> Pursuant to the <strong>Registration of Business Names Act (Cap 499, Sec 14)</strong>, <strong>Kenya Information and Communications Act (Cap 411A, Electronic Transactions)</strong> and the <strong>UNCITRAL Model Law on Electronic Commerce</strong>, this system-generated commercial statement is legally authentic, valid, and enforceable without a physical wet-ink signature or manual rubber seal. Official BRS verification: SMS &quot;BRS&quot; to 21546.
              </div>
            </section>

          </div>
        </article>
      </div>
    </div>
  );
}

export default ProposalPresentationView;
