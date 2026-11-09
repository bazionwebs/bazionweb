'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Download,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Smartphone,
  ShieldCheck,
  X,
  Zap,
  Building,
  RefreshCw,
  ArrowUpRight,
  Printer,
  Eye,
} from 'lucide-react';
import { resolveApiV1Base, toCleanUrl } from '@/lib/api-base';
import { portalApi } from '@/lib/api';
import {
  useClientInvoices,
  useClientProfile,
  usePayInvoiceMpesa,
  usePayInvoiceCard,
  ApiInvoice,
  ApiClient,
} from '@/hooks/usePortalData';
import { TableSkeletonRows, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatMoney, formatDate, titleCase, providerLabel } from '@/lib/format';
import { cn, isTrustedCheckoutUrl, toSafeExternalUrl } from '@/lib/utils';
import {
  renderDocumentLetterheadHtml,
  renderPaymentInstructionsHtml,
  renderSecurityVerificationSectionHtml,
  getAntiFraudWatermarkCss,
} from '@/lib/document-branding';


const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PAID: {
    label: 'Paid',
    color: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  OVERDUE: {
    label: 'Overdue',
    color: 'bg-rose-100 text-rose-800 border border-rose-200',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  SENT: {
    label: 'Awaiting Payment',
    color: 'bg-amber-100 text-amber-800 border border-amber-200',
    icon: <Clock className="w-3 h-3" />,
  },
  PENDING: {
    label: 'Awaiting Payment',
    color: 'bg-amber-100 text-amber-800 border border-amber-200',
    icon: <Clock className="w-3 h-3" />,
  },
  DRAFT: {
    label: 'Draft',
    color: 'bg-slate-100 text-slate-600 border border-slate-200',
    icon: null,
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'bg-slate-100 text-slate-600 border border-slate-200',
    icon: null,
  },
};

function isAwaitingPayment(status: string): boolean {
  return status === 'SENT' || status === 'PENDING';
}

function summarizeByCurrency(items: ApiInvoice[], fallbackCurrency = 'KES'): string {
  if (items.length === 0) return formatMoney(0, fallbackCurrency);
  const totals = new Map<string, number>();
  for (const inv of items) {
    const cur = (inv.currency || fallbackCurrency).toUpperCase();
    totals.set(cur, (totals.get(cur) ?? 0) + Number(inv.amount || 0));
  }
  return Array.from(totals.entries())
    .map(([cur, amt]) => formatMoney(amt, cur))
    .join(' + ');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tax split for display. Uses the server-computed breakdown when present.
 * Supplier is not VAT-registered under the Kenya VAT Act, 2013, so defaults to no VAT.
 */
export function computeInvoiceTaxBreakdown(inv: ApiInvoice) {
  if (inv.breakdown) return inv.breakdown;
  const total = Number(inv.amount || 0);
  const vatRate = 0.0;

  const subtotal = total;
  const vatAmount = 0;

  const isPaid = inv.status === 'PAID';
  const amountPaid = isPaid ? total : 0;
  const balanceDue = isPaid ? 0 : total;

  return {
    subtotal,
    vatRate,
    vatAmount,
    vatLabel: '',
    total,
    amountPaid,
    balanceDue,
  };
}

function openPrintableStatement(inv: ApiInvoice, client?: ApiClient | null) {
  if (typeof window === 'undefined') return;
  const isPaid = inv.status === 'PAID';
  const paymentLog = inv.paymentLogs?.[0];
  const breakdown = computeInvoiceTaxBreakdown(inv);
  const rawItems = Array.isArray(inv.lineItems) ? inv.lineItems : [];
  const normalizedItems =
    rawItems.length > 0
      ? rawItems
      : [
          {
            description: inv.notes || 'Engineering & Managed Cloud Services',
            quantity: 1,
            amount: inv.amount,
          },
        ];
  const rowsHtml = normalizedItems
    .map((item, idx) => {
      const rawDesc = String(item.description || inv.notes || 'BazionWeb Services');
      const desc = escapeHtml(rawDesc);
      const isTaxRow = /vat|value added tax|tax/i.test(rawDesc);
      const qty = Math.max(1, Number(item.quantity ?? 1));
      const amt = Number(item.amount ?? inv.amount ?? 0);
      const unitPrice = amt / qty;
      const rowNum = String(idx + 1).padStart(2, '0');
      const rowBg = isTaxRow ? '#EEF4FF' : idx % 2 === 1 ? '#F7FAFF' : '#FFFFFF';
      const accentColor = isTaxRow ? '#0D9488' : '#2563EB';
      return `<tr style="background:${rowBg};">
        <td style="padding:11px 10px;border-bottom:1px solid #CBD5E1;border-left:4px solid ${accentColor};border-right:1px solid #E2E8F0;font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:800;color:${accentColor};text-align:center;">${rowNum}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #CBD5E1;border-right:1px solid #E2E8F0;color:#0F172A;font-weight:700;font-size:13px;">${desc}</td>
        <td style="padding:11px 10px;border-bottom:1px solid #CBD5E1;border-right:1px solid #E2E8F0;text-align:center;">
          <span style="display:inline-block;min-width:28px;padding:2px 8px;border-radius:6px;background:${isTaxRow ? '#CCFBF1' : '#DBEAFE'};color:${isTaxRow ? '#0F766E' : '#1D4ED8'};font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12px;">${qty}</span>
        </td>
        <td style="padding:11px 12px;border-bottom:1px solid #CBD5E1;border-right:1px solid #E2E8F0;text-align:right;font-family:'JetBrains Mono',monospace;font-size:12px;color:#475569;font-weight:600;">${escapeHtml(formatMoney(unitPrice, inv.currency))}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #CBD5E1;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;font-size:13px;color:${isTaxRow ? '#0F766E' : '#0F172A'};">${escapeHtml(formatMoney(amt, inv.currency))}</td>
      </tr>`;
    })
    .join('');

  const letterheadHtml = renderDocumentLetterheadHtml({
    docType: isPaid ? 'PAYMENT RECEIPT' : 'OFFICIAL INVOICE',
    docNumber: inv.invoiceNumber,
    statusTone: isPaid ? 'emerald' : inv.status === 'OVERDUE' ? 'amber' : 'blue',
    statusBadgeText: isPaid ? 'PAID IN FULL' : inv.status,
    issueDate: inv.createdAt,
    dueDate: inv.dueDate,
    settledDate: inv.paidAt,
    gatewayRef: paymentLog?.providerRef,
  });

  const securitySectionHtml = renderSecurityVerificationSectionHtml({
    docNumber: inv.invoiceNumber,
    docType: isPaid ? 'PAYMENT RECEIPT' : 'OFFICIAL INVOICE',
    totalAmount: breakdown.total,
    currency: inv.currency,
    recipientEmail: client?.email || '',
    issueDate: inv.createdAt,
    status: inv.status,
    isPaid,
  });

  const watermarkText = isPaid ? 'OFFICIAL RECEIPT · PAID' : 'AUTHENTICATED INVOICE';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(inv.invoiceNumber)} — BAZION WEB</title>
  <style>
    ${getAntiFraudWatermarkCss()}
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 24px; background: #0B0F17; color: #0f172a; }
    .sheet { position: relative; overflow: hidden; max-width: 820px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 20px; padding: 44px; box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4); }
    .actions { max-width: 820px; margin: 0 auto 16px; display: flex; justify-content: flex-end; gap: 10px; }
    .btn { background: #2563eb; color: #fff; border: none; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
    .btn:hover { background: #1d4ed8; }
    @media print {
      @page { size: A4 portrait; margin: 12mm 15mm; }
      body { background: #fff !important; padding: 0 !important; color: #000 !important; }
      .sheet { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
      .actions { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet">
    <div class="security-watermark-overlay">${watermarkText}</div>

    ${letterheadHtml}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;font-size:13px;position:relative;z-index:2;">
      <div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:0.08em;">Billed To</div>
        <div style="font-weight:800;font-size:15px;margin-top:6px;">${escapeHtml(client?.businessName || 'Valued Client')}</div>
        <div style="color:#475569;margin-top:2px;">${escapeHtml(client?.contactName || '')}</div>
        <div style="color:#475569;margin-top:2px;">${escapeHtml(client?.email || '')}</div>
        ${client?.address ? `<div style="color:#475569;margin-top:2px;">${escapeHtml(client.address)}${client.country ? `, ${escapeHtml(client.country)}` : ''}</div>` : ''}
        ${client?.taxPin ? `<div style="color:#475569;margin-top:4px;font-family:monospace;font-size:12px;">Tax / KRA PIN: ${escapeHtml(client.taxPin)}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="margin-bottom:6px;"><span style="color:#64748b;">Issue Date:</span> <strong>${escapeHtml(formatDate(inv.createdAt))}</strong></div>
        <div style="margin-bottom:6px;"><span style="color:#64748b;">Due Date:</span> <strong>${escapeHtml(formatDate(inv.dueDate))}</strong></div>
        ${inv.paidAt ? `<div style="margin-bottom:6px;"><span style="color:#64748b;">Settled On:</span> <strong>${escapeHtml(formatDate(inv.paidAt))}</strong></div>` : ''}
        ${paymentLog?.providerRef ? `<div><span style="color:#64748b;">Gateway Ref:</span> <strong style="font-family:monospace;">${escapeHtml(paymentLog.providerRef)}</strong></div>` : ''}
      </div>
    </div>

    <div style="margin-top:28px;border:1.5px solid #2563EB;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px -4px rgba(15,23,42,0.08);position:relative;z-index:2;">
      <div style="height:3px;background:linear-gradient(90deg,#2563EB 0%,#38BDF8 60%,#10B981 100%);"></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#0F172A;color:#FFFFFF;">
            <th style="text-align:center;padding:11px 10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#7DD3FC;width:46px;">No.</th>
            <th style="text-align:left;padding:11px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">Service / Deliverable Description</th>
            <th style="text-align:center;padding:11px 10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;width:70px;">Qty</th>
            <th style="text-align:right;padding:11px 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;width:130px;">Unit Price</th>
            <th style="text-align:right;padding:11px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;width:145px;">Line Total</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:stretch;gap:20px;flex-wrap:wrap;margin-top:24px;position:relative;z-index:2;">
      ${renderPaymentInstructionsHtml({ docNumber: inv.invoiceNumber, isPaid })}
      <div style="min-width:300px;background:#f8fafc;padding:18px 20px;border-radius:14px;border:1px solid #e2e8f0;">
        ${breakdown.vatAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;margin-bottom:8px;">
          <span>Subtotal (Net):</span>
          <span style="font-weight:600;color:#0f172a;">${escapeHtml(formatMoney(breakdown.subtotal, inv.currency))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;margin-bottom:8px;">
          <span>${escapeHtml(breakdown.vatLabel)}:</span>
          <span style="font-weight:600;color:#0f172a;">${escapeHtml(formatMoney(breakdown.vatAmount, inv.currency))}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;border-top:1px solid #cbd5e1;padding-top:10px;margin-bottom:8px;">
          <span>Invoice Total:</span>
          <span style="color:#0f172a;">${escapeHtml(formatMoney(breakdown.total, inv.currency))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#166534;margin-bottom:6px;">
          <span>Amount Paid:</span>
          <span style="font-weight:700;">${escapeHtml(formatMoney(breakdown.amountPaid, inv.currency))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;color:${breakdown.balanceDue > 0 ? '#991b1b' : '#166534'};border-top:1px dashed #cbd5e1;padding-top:8px;">
          <span>Balance Due:</span>
          <span>${escapeHtml(formatMoney(breakdown.balanceDue, inv.currency))}</span>
        </div>
      </div>
    </div>

    <!-- Security, E-Stamp & Anti-Fake Verification Center -->
    <div style="position:relative;z-index:2;">
      ${securitySectionHtml}
    </div>
  </div>

</body>
</html>`;

  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, '_blank');
    if (w) {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  } catch {
    // If popups or blobs fail, do nothing destructive
  }
}

export default function InvoicesClient() {
  const { data: liveInvoices = [], isLoading, isError, refetch } = useClientInvoices();
  const { data: liveClient } = useClientProfile();
  const mpesaPay = usePayInvoiceMpesa();
  const cardPay = usePayInvoiceCard();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'AWAITING' | 'OVERDUE'>('ALL');
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<ApiInvoice | null>(null);
  const [selectedInvoiceForInspect, setSelectedInvoiceForInspect] = useState<ApiInvoice | null>(null);
  const [paymentMethodTab, setPaymentMethodTab] = useState<'mpesa' | 'card'>('mpesa');

  const handleDownloadPdf = async (inv: ApiInvoice) => {
    try {
      const res = await portalApi.getInvoicePdfLink(inv.id);
      const data = res?.data ?? res;
      const signedPath: string | undefined = data?.downloadUrlWithToken || data?.url;
      if (signedPath) {
        const origin = resolveApiV1Base().replace(/\/api\/v1$/, '');
        const fullUrl = signedPath.startsWith('http') ? signedPath : `${origin}${signedPath}`;
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {
      // Fall back to printable statement if API is unreachable in mock mode
    }
    openPrintableStatement(inv, liveClient);
  };
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneSeeded, setPhoneSeeded] = useState(false);
  const [stkResult, setStkResult] = useState<{
    message: string;
    provider: string;
    invoiceNumber: string;
  } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [cardReturnNotice, setCardReturnNotice] = useState<string | null>(null);

  const activeSubscription = liveClient?.subscriptions?.[0];
  const primaryCurrency = liveInvoices[0]?.currency || 'KES';

  // Seed phone number once from client profile without locking the input
  useEffect(() => {
    if (!phoneSeeded && liveClient?.phone) {
      setPhoneNumber(liveClient.phone);
      setPhoneSeeded(true);
    }
  }, [liveClient?.phone, phoneSeeded]);

  // Verify Paystack return reference (?card_settled=1&reference=...) before refreshing invoices
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const verifyDocRef = params.get('verify');
    if (verifyDocRef) {
      const sigParam = params.get('checksum') || params.get('sig') || '';
      const targetUrl = `/verify?ref=${encodeURIComponent(verifyDocRef)}${sigParam ? `&sig=${encodeURIComponent(sigParam)}` : ''}`;
      window.location.replace(targetUrl);
      return;
    }

    const cardSettled = params.get('card_settled') === '1';
    const ref = params.get('reference') || params.get('trxref');
    if (!cardSettled && !ref) return;

    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      if (ref) {
        try {
          const res = await fetch(toCleanUrl(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`), {
            cache: 'no-store',
          });
          const data = await res.json().catch(() => ({}));
          if (data?.paid) {
            setCardReturnNotice(
              `Card payment verified${data.invoiceNumber ? ` for ${data.invoiceNumber}` : ''}. Your statements are updated.`,
            );
          } else {
            setCardReturnNotice('Returned from card gateway — refreshing your invoice status.');
          }
        } catch {
          setCardReturnNotice('Card payment submitted — refreshing your statements.');
        }
      } else {
        setCardReturnNotice('Card checkout completed — statements refreshed.');
      }
      refetch();
    })();
  }, [refetch]);

  const paidInvoices = useMemo(
    () => liveInvoices.filter(i => i.status === 'PAID'),
    [liveInvoices],
  );
  const overdueInvoices = useMemo(
    () => liveInvoices.filter(i => i.status === 'OVERDUE'),
    [liveInvoices],
  );
  const pendingInvoices = useMemo(
    () => liveInvoices.filter(i => isAwaitingPayment(i.status)),
    [liveInvoices],
  );

  const filteredInvoices = useMemo(() => {
    return liveInvoices.filter(inv => {
      const matchSearch =
        !searchQuery.trim() ||
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.notes && inv.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'AWAITING'
            ? isAwaitingPayment(inv.status)
            : inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [liveInvoices, searchQuery, statusFilter]);

  const openPayModal = (inv: ApiInvoice) => {
    setSelectedInvoiceForPay(inv);
    setPaymentMethodTab(inv.currency === 'KES' ? 'mpesa' : 'card');
    setPayError(null);
    setStkResult(null);
  };

  const handleTriggerSTK = async () => {
    if (!selectedInvoiceForPay || mpesaPay.isPending) return;
    const phone = phoneNumber.trim();
    if (!phone) {
      setPayError('Please enter a valid Safaricom M-Pesa phone number.');
      return;
    }
    setPayError(null);
    try {
      const res = (await mpesaPay.mutateAsync({
        invoiceId: selectedInvoiceForPay.id,
        mpesaPhoneNumber: phone,
      })) as {
        data?: { message?: string; provider?: string; invoiceNumber?: string };
        message?: string;
        provider?: string;
        invoiceNumber?: string;
      };
      const payload = res?.data ?? res;
      setStkResult({
        message:
          payload?.message ||
          'M-Pesa prompt sent! Check your handset and enter your PIN to settle.',
        provider: payload?.provider || 'DARAJA',
        invoiceNumber: payload?.invoiceNumber || selectedInvoiceForPay.invoiceNumber,
      });
      setTimeout(() => refetch(), 8000);
      setTimeout(() => refetch(), 20000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error?.response?.data?.message;
      setPayError(msg || 'Could not send the M-Pesa prompt. Verify the phone number or pay by card.');
    }
  };

  const handleCardPay = async () => {
    if (!selectedInvoiceForPay || cardPay.isPending) return;
    setPayError(null);
    try {
      const res = (await cardPay.mutateAsync({
        invoiceId: selectedInvoiceForPay.id,
        email: liveClient?.email,
      })) as { data?: { checkoutUrl?: string }; checkoutUrl?: string };
      const payload = res?.data ?? res;
      if (payload?.checkoutUrl && isTrustedCheckoutUrl(payload.checkoutUrl)) {
        window.location.href = payload.checkoutUrl;
      } else {
        setPayError('Card checkout could not be initialized or untrusted URL returned. Please try again.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error?.response?.data?.message;
      setPayError(msg || 'Card checkout could not be opened. Please try again.');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Return notice after Paystack redirect */}
      {cardReturnNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {cardReturnNotice}
          </span>
          <button
            type="button"
            onClick={() => setCardReturnNotice(null)}
            className="p-1 text-emerald-700 hover:text-emerald-900 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner / Billing Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Automated M-Pesa &amp; Card Reconciliation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Billing Center &amp; Cloud Care
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Review itemized project deposits, settle open statements via M-Pesa STK Push or Visa/Mastercard, and download printable PDF receipts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {liveInvoices.length > 0 && (
              <button
                type="button"
                onClick={() => openPrintableStatement(paidInvoices[0] ?? liveInvoices[0], liveClient)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Latest Receipt / PDF
              </button>
            )}
            {pendingInvoices.length + overdueInvoices.length > 0 && (
              <button
                type="button"
                onClick={() => openPayModal(overdueInvoices[0] ?? pendingInvoices[0])}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
              >
                <CreditCard className="w-4 h-4" />
                Settle Open ({pendingInvoices.length + overdueInvoices.length})
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              <span>
                Client Entity:{' '}
                <strong className="text-white font-semibold">
                  {liveClient?.businessName ?? 'Your organization'}
                </strong>
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-400" />
              <span>
                Statements on Record:{' '}
                <strong className="text-white font-semibold">{liveInvoices.length}</strong>
              </span>
            </div>
          </div>
          <span
            className={cn(
              'font-semibold flex items-center gap-1.5',
              pendingInvoices.length + overdueInvoices.length > 0
                ? 'text-amber-300'
                : 'text-emerald-400',
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full animate-pulse',
                pendingInvoices.length + overdueInvoices.length > 0
                  ? 'bg-amber-400'
                  : 'bg-emerald-400',
              )}
            />
            {pendingInvoices.length + overdueInvoices.length > 0
              ? `${pendingInvoices.length + overdueInvoices.length} statement(s) awaiting settlement`
              : 'All statements settled'}
          </span>
        </div>
      </div>

      {/* Overdue Warning Callout */}
      {overdueInvoices.length > 0 && (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-rose-900">
                Action Required: {overdueInvoices.length} Overdue Statement (
                {summarizeByCurrency(overdueInvoices, primaryCurrency)})
              </div>
              <p className="text-xs text-rose-700 mt-0.5">
                Please clear past-due balances to maintain uninterrupted workspace and hosting coverage.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openPayModal(overdueInvoices[0])}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors shrink-0 flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Clear Overdue Balance
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Verified
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A]">{paidInvoices.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Settled Statements</div>
          </div>
          <div className="text-xs font-bold text-emerald-700 mt-3 pt-3 border-t border-slate-100 truncate">
            {summarizeByCurrency(paidInvoices, primaryCurrency)} paid
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                Open
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A]">{pendingInvoices.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Awaiting Settlement</div>
          </div>
          <div className="text-xs font-bold text-amber-700 mt-3 pt-3 border-t border-slate-100 truncate">
            {pendingInvoices.length > 0
              ? `${summarizeByCurrency(pendingInvoices, primaryCurrency)} open`
              : 'Zero open balance'}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                  overdueInvoices.length === 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700',
                )}
              >
                {overdueInvoices.length === 0 ? 'Clean' : 'Past Due'}
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A]">{overdueInvoices.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Overdue Statements</div>
          </div>
          <div
            className={cn(
              'text-xs font-bold mt-3 pt-3 border-t border-slate-100 truncate',
              overdueInvoices.length === 0 ? 'text-slate-400' : 'text-rose-600',
            )}
          >
            {overdueInvoices.length === 0
              ? 'No overdue balances'
              : `${summarizeByCurrency(overdueInvoices, primaryCurrency)} overdue`}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                Cloud Care
              </span>
            </div>
            <div className="text-xl font-black text-[#0F172A] truncate">
              {activeSubscription?.plan?.name ?? 'On-Demand'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {activeSubscription ? `${titleCase(activeSubscription.billingCycle)} Retainer` : 'No recurring retainer'}
            </div>
          </div>
          <div className="text-xs font-bold text-blue-700 mt-3 pt-3 border-t border-slate-100 truncate">
            {activeSubscription?.renewalDate
              ? `Renews ${formatDate(activeSubscription.renewalDate)}`
              : 'Optional post-launch care'}
          </div>
        </div>
      </div>

      {/* Subscription Standing Card (Truthful for both Care Subscribers & One-Time Build Clients) */}
      {activeSubscription ? (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold mb-2">
                <Zap className="w-3.5 h-3.5 text-blue-600" />
                <span>Active Managed Cloud Care</span>
              </div>
              <h2 className="text-xl font-black text-[#0F172A]">
                {activeSubscription.plan?.name ?? 'Managed Care Plan'}
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Includes {activeSubscription.plan?.uptimeSla ?? '99.95%'} uptime SLA, automated offsite backups, TLS renewal, and priority engineering triage.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 min-w-[260px] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Billing Cycle:</span>
                <span className="font-extrabold text-[#0F172A]">
                  {titleCase(activeSubscription.billingCycle)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Next Renewal:</span>
                <span className="font-semibold text-slate-700">
                  {activeSubscription.renewalDate ? formatDate(activeSubscription.renewalDate) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Payment Rail:</span>
                <span className="font-bold text-emerald-700">
                  {providerLabel(activeSubscription.provider)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/80 flex justify-end">
                <Link
                  href="/portal/packages?tab=care"
                  className="text-xs font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1"
                >
                  Change or Upgrade Tier <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-2">
              <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Project Milestone Billing Active</span>
            </div>
            <h2 className="text-lg font-extrabold text-[#0F172A]">
              No recurring Cloud Care subscription attached yet
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Your workspace is unlocked under your scoped build deposit. When you are ready for launch, you can optionally activate a monthly Managed Cloud Care &amp; SLA retainer for 24/7 uptime monitoring, automated S3 backups, and continuous updates.
            </p>
          </div>
          <Link
            href="/portal/packages?tab=care"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-xs font-bold text-slate-700 shrink-0 transition-colors"
          >
            Explore Care Plans <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Invoices History Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-[#0F172A] text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2563EB]" />
              Commercial Statement History ({filteredInvoices.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Itemized invoices and official settlement receipts for your organization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice # or note…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
              />
            </div>

            <div className="inline-flex p-1 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
              {(['ALL', 'PAID', 'AWAITING', 'OVERDUE'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    'px-3 py-1 rounded-lg transition-all',
                    statusFilter === tab
                      ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  {tab === 'ALL'
                    ? 'All'
                    : tab === 'PAID'
                      ? 'Paid'
                      : tab === 'AWAITING'
                        ? 'Open'
                        : 'Overdue'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase text-slate-500 text-left">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Settlement Ref</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Issued</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeletonRows rows={4} cols={8} />
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8">
                    <QueryError message="Your invoices could not be loaded." onRetry={() => refetch()} />
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      title={searchQuery || statusFilter !== 'ALL' ? 'No matching statements' : 'No statements on record'}
                      hint="Project deposit invoices and recurring care statements appear here automatically."
                    />
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const sc = statusConfig[inv.status] ?? statusConfig.SENT;
                  const isPaid = inv.status === 'PAID';
                  const isPayable = isAwaitingPayment(inv.status) || inv.status === 'OVERDUE';
                  const payLog = inv.paymentLogs?.[0];
                  const firstLineDesc =
                    Array.isArray(inv.lineItems) &&
                    typeof inv.lineItems[0]?.description === 'string'
                      ? String(inv.lineItems[0].description)
                      : null;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {inv.invoiceNumber}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-[#0F172A] max-w-xs">
                        <div className="truncate">
                          {inv.notes || firstLineDesc || (
                            <span className="text-slate-400 italic">Commercial Statement</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-black text-[#0F172A] whitespace-nowrap">
                        {formatMoney(inv.amount, inv.currency)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold',
                            sc.color,
                          )}
                        >
                          {sc.icon}
                          {sc.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isPaid ? (
                          <div className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 max-w-[150px] truncate">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{payLog?.providerRef || 'Settled'}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Unsettled</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-medium whitespace-nowrap">
                        {formatDate(inv.dueDate)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {formatDate(inv.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceForInspect(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                            title="Inspect itemized tax breakdown"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            Breakdown
                          </button>
                          {isPayable && (
                            <button
                              type="button"
                              onClick={() => openPayModal(inv)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
                            >
                              <CreditCard className="w-3 h-3" />
                              Pay Now
                            </button>
                          )}

                          {inv.pdfUrl && toSafeExternalUrl(inv.pdfUrl) ? (
                            <a
                              href={toSafeExternalUrl(inv.pdfUrl) ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                              PDF
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                              PDF
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openPrintableStatement(inv, liveClient)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            {isPaid ? 'Receipt' : 'Invoice'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Pay Now Modal */}
      {selectedInvoiceForPay && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settle-statement-title"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 id="settle-statement-title" className="text-xl font-black text-[#0F172A]">Settle Statement</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Invoice{' '}
                  <span className="font-mono font-bold text-slate-700">
                    {selectedInvoiceForPay.invoiceNumber}
                  </span>{' '}
                  • {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedInvoiceForPay(null);
                  setStkResult(null);
                  setPayError(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 mb-6 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethodTab('mpesa');
                  setPayError(null);
                }}
                className={cn(
                  'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                  paymentMethodTab === 'mpesa'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'hover:text-slate-900',
                )}
              >
                <Smartphone className="w-3.5 h-3.5" />
                M-Pesa STK
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethodTab('card');
                  setPayError(null);
                }}
                className={cn(
                  'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
                  paymentMethodTab === 'card'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'hover:text-slate-900',
                )}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Card Checkout
              </button>
            </div>

            {paymentMethodTab === 'mpesa' && (
              <div className="space-y-4">
                {stkResult ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>M-Pesa prompt dispatched</strong> — {stkResult.message}
                        <br />
                        Invoice <span className="font-mono font-bold">{stkResult.invoiceNumber}</span>{' '}
                        reconciles automatically once your PIN is confirmed.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceForPay(null);
                        setStkResult(null);
                        refetch();
                      }}
                      className="w-full py-3 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      Done — Refreshing Status
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-xs text-emerald-900 leading-relaxed">
                      Enter your Safaricom M-Pesa number to receive an instant STK Push PIN prompt on your phone.
                    </div>

                    {selectedInvoiceForPay.currency !== 'KES' && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                        This statement is denominated in {selectedInvoiceForPay.currency}. Switch to the Card Checkout tab above to pay.
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        M-Pesa Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        placeholder="0712 345 678"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
                      <span className="text-slate-500">Payable Amount:</span>
                      <span className="text-base font-black text-[#0F172A]">
                        {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)}
                      </span>
                    </div>

                    {payError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900">
                        {payError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleTriggerSTK}
                      disabled={mpesaPay.isPending || selectedInvoiceForPay.currency !== 'KES'}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mpesaPay.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Sending M-Pesa Prompt…
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4" />
                          Send M-Pesa STK Push
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {paymentMethodTab === 'card' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 text-xs text-indigo-900 leading-relaxed">
                  Pay securely via Visa, Mastercard, or Apple Pay through Paystack PCI-DSS Level 1 checkout. Your statement settles automatically upon return.
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
                  <span className="text-slate-500">Payable Amount:</span>
                  <span className="text-base font-black text-[#0F172A]">
                    {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)}
                  </span>
                </div>

                {payError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900">
                    {payError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCardPay}
                  disabled={cardPay.isPending}
                  className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cardPay.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Opening Secure Checkout…
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pay {formatMoney(selectedInvoiceForPay.amount, selectedInvoiceForPay.currency)} by Card
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Itemized Tax & Statement Breakdown Modal */}
      {selectedInvoiceForInspect && (() => {
        const inspectBreakdown = computeInvoiceTaxBreakdown(selectedInvoiceForInspect);
        const inspectItems = Array.isArray(selectedInvoiceForInspect.lineItems) && selectedInvoiceForInspect.lineItems.length > 0
          ? selectedInvoiceForInspect.lineItems
          : [{ description: selectedInvoiceForInspect.notes || 'BazionWeb Engineering & Cloud Services', quantity: 1, amount: Number(selectedInvoiceForInspect.amount || 0) }];
        const inspectPayable = isAwaitingPayment(selectedInvoiceForInspect.status) || selectedInvoiceForInspect.status === 'OVERDUE';
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-statement-title"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 id="inspect-statement-title" className="text-xl font-black text-[#0F172A]">
                    Statement Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Invoice <span className="font-mono font-bold text-slate-800">{selectedInvoiceForInspect.invoiceNumber}</span> • Issued {formatDate(selectedInvoiceForInspect.createdAt)} • Due {formatDate(selectedInvoiceForInspect.dueDate)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForInspect(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden mb-5">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectItems.map((item, idx) => (
                      <tr key={idx} className="text-slate-700">
                        <td className="py-3 px-4 font-medium">{String(item.description || item.label || 'BazionWeb Service')}</td>
                        <td className="py-3 px-3 text-center">{Number(item.quantity ?? 1)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          {formatMoney(Number(item.amount ?? item.total ?? selectedInvoiceForInspect.amount ?? 0), selectedInvoiceForInspect.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs mb-6">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (Net):</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(inspectBreakdown.subtotal, selectedInvoiceForInspect.currency)}
                  </span>
                </div>
                {inspectBreakdown.vatAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>{inspectBreakdown.vatLabel}:</span>
                    <span className="font-semibold text-slate-900">
                      {formatMoney(inspectBreakdown.vatAmount, selectedInvoiceForInspect.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-[#0F172A] pt-2 border-t border-slate-200">
                  <span>Invoice Total:</span>
                  <span>{formatMoney(inspectBreakdown.total, selectedInvoiceForInspect.currency)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Amount Paid:</span>
                  <span>{formatMoney(inspectBreakdown.amountPaid, selectedInvoiceForInspect.currency)}</span>
                </div>
                <div className={cn(
                  'flex justify-between text-sm font-extrabold pt-2 border-t border-dashed border-slate-300',
                  inspectBreakdown.balanceDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                )}>
                  <span>Balance Due:</span>
                  <span>{formatMoney(inspectBreakdown.balanceDue, selectedInvoiceForInspect.currency)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(selectedInvoiceForInspect)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => openPrintableStatement(selectedInvoiceForInspect, liveClient)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Statement
                </button>
                {inspectPayable && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedInvoiceForInspect;
                      setSelectedInvoiceForInspect(null);
                      openPayModal(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Pay Now
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
