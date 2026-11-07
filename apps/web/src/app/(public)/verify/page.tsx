'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Building2,
  FileCheck2,
  ArrowRight,
  Loader2,
  ScanLine,
} from 'lucide-react';
import { resolveApiV1Base } from '@/lib/api-base';
import { formatMoney, formatDate } from '@/lib/format';
import {
  BAZION_CORPORATE_DETAILS,
  generateCode128BarcodeSvg,
  renderDigitalStampSvg,
} from '@/lib/document-branding';

interface VerificationResponse {
  verified: boolean;
  found: boolean;
  signatureVerified: boolean | null;
  documentType: string | null;
  referenceNumber: string;
  status?: string;
  currency?: string;
  subtotal?: number;
  vatAmount?: number;
  vatLabel?: string;
  totalAmount?: number;
  amountPaid?: number;
  balanceDue?: number;
  issuedAt?: string;
  dueDate?: string | null;
  paidAt?: string | null;
  settlementRef?: string | null;
  message?: string;
  recipient?: {
    businessName: string;
    emailMasked: string;
  };
  issuer: {
    legalName: string;
    proprietor: string;
    regNumber: string;
    taxPin: string;
    brsValidation: string;
  };
  paymentChannels?: {
    mpesaPaybill: string;
    mpesaAccountNumber: string;
    mpesaAccountName: string;
    bankName: string;
    bankBranch: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankSwiftCode: string;
  };
  cryptographicFingerprint?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    amount: number;
  }>;
  verifiedAt: string;
}

function unwrapEnvelope(payload: unknown): VerificationResponse {
  const node = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  return (node.data && typeof node.data === 'object' ? node.data : node) as VerificationResponse;
}

function VerifyPortalContent() {
  const searchParams = useSearchParams();
  const initialRef =
    searchParams.get('ref') ||
    searchParams.get('verify') ||
    searchParams.get('reference') ||
    '';
  const initialSig = searchParams.get('sig') || searchParams.get('checksum') || '';

  const [refInput, setRefInput] = useState(initialRef);
  const [sigInput, setSigInput] = useState(initialSig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResponse | null>(null);

  // Camera barcode scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const runVerification = useCallback(async (rawRef: string, rawSig?: string) => {
    const cleanRef = rawRef.trim();
    if (!cleanRef) {
      setError('Enter or scan an invoice / proposal reference number (e.g. INV-MAN-40770343-3099D6).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const base = resolveApiV1Base();
      const qs = rawSig?.trim() ? `?sig=${encodeURIComponent(rawSig.trim())}` : '';
      const res = await fetch(
        `${base}/invoices/verify/${encodeURIComponent(cleanRef)}${qs}`,
        { cache: 'no-store' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof body?.message === 'string'
            ? body.message
            : 'Unable to verify document reference right now.';
        throw new Error(msg);
      }
      setResult(unwrapEnvelope(body));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification request failed.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRef.trim()) {
      void runVerification(initialRef, initialSig);
    }
  }, [initialRef, initialSig, runVerification]);

  const stopCameraScanner = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScannerOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startCameraScanner = async () => {
    setScannerOpen(true);
    setScannerStatus('Initializing camera barcode scanner…');

    const BarcodeDetectorCtor =
      typeof window !== 'undefined'
        ? (window as unknown as { BarcodeDetector?: any }).BarcodeDetector
        : undefined;

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerStatus(
        'Camera access is not available in this browser context. Please type or scan with a USB/handheld scanner below.',
      );
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      if (!BarcodeDetectorCtor) {
        setScannerStatus(
          'Hold the barcode steady — or enter the reference printed directly below the barcode.',
        );
        return;
      }

      const detector = new BarcodeDetectorCtor({
        formats: ['code_128', 'code_39', 'qr_code'],
      });
      setScannerStatus('Point camera at the invoice Code-128 security barcode…');

      const scanFrame = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(scanFrame);
          return;
        }
        try {
          const detected = await detector.detect(videoRef.current);
          if (Array.isArray(detected) && detected.length > 0) {
            const rawVal = String(detected[0]?.rawValue || '').trim();
            if (rawVal) {
              setRefInput(rawVal);
              stopCameraScanner();
              void runVerification(rawVal, sigInput);
              return;
            }
          }
        } catch {
          // Continue scanning frames
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setScannerStatus(
        'Camera permission was denied or unavailable. Enter the reference code manually below.',
      );
    }
  };

  const barcodeSvg = useMemo(() => {
    if (!result?.referenceNumber) return '';
    return generateCode128BarcodeSvg(result.referenceNumber, {
      width: 340,
      height: 48,
      darkColor: '#000000',
    });
  }, [result?.referenceNumber]);

  const stampSvg = useMemo(() => {
    if (!result?.found) return '';
    const isPaid = result.status === 'PAID';
    return renderDigitalStampSvg({
      docNumber: result.referenceNumber,
      status: isPaid ? 'PAID' : 'AUTHENTICATED',
      tone: isPaid ? 'emerald' : 'blue',
      size: 132,
    });
  }, [result]);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-extrabold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-4 h-4" />
            SSOT Cryptographic Document &amp; Barcode Registry
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Verify Official Invoice or Receipt
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl mx-auto">
            Validate the authenticity, KRA tax registration (<span className="font-mono text-slate-200">{BAZION_CORPORATE_DETAILS.taxPin}</span>), and SHA-256 cryptographic seal of any system-generated BazionWeb invoice, receipt, or commercial proposal.
          </p>
        </div>

        {/* Search & Barcode Scanner Input Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl mb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runVerification(refInput, sigInput);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="verify-ref-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5"
                >
                  Document Reference or Scanned Code-128 Barcode *
                </label>
                <div className="relative">
                  <ScanLine className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="verify-ref-input"
                    type="text"
                    value={refInput}
                    onChange={(e) => setRefInput(e.target.value)}
                    placeholder="e.g. INV-MAN-40770343-3099D6"
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="verify-sig-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5"
                >
                  SHA-256 Prefix (Optional)
                </label>
                <input
                  id="verify-sig-input"
                  type="text"
                  value={sigInput}
                  onChange={(e) => setSigInput(e.target.value)}
                  placeholder="e.g. 62F5-83F9"
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={startCameraScanner}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors"
              >
                <Camera className="w-4 h-4 text-sky-400" />
                Scan Barcode with Camera
              </button>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-blue-600/25 disabled:opacity-60 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying Record…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Verify Authenticity
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Live Camera Barcode Scanner Modal */}
          {scannerOpen && (
            <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-blue-500/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Live ISO/IEC 15417 Code-128 Barcode Scanner
                </span>
                <button
                  type="button"
                  onClick={stopCameraScanner}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-64 mx-auto flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] pointer-events-none" />
              </div>
              <p className="mt-2.5 text-center text-xs text-slate-400">{scannerStatus}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Verification Certificate Result */}
        {result && (
          <div className="bg-white text-slate-900 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            {/* Banner Status */}
            <div
              className={
                result.verified && result.found
                  ? 'bg-emerald-700 text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4'
                  : 'bg-red-700 text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4'
              }
            >
              <div className="flex items-center gap-3">
                {result.verified && result.found ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-200 shrink-0" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-red-200 shrink-0" />
                )}
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-widest opacity-90">
                    {result.verified && result.found
                      ? 'Official SSOT Cryptographic Verification Certificate'
                      : 'Verification Alert — Unverified Reference'}
                  </div>
                  <h2 className="text-lg sm:text-xl font-black">
                    {result.verified && result.found
                      ? `AUTHENTICATED: ${result.documentType}`
                      : result.found && result.signatureVerified === false
                        ? 'CRYPTOGRAPHIC CHECKSUM MISMATCH'
                        : 'RECORD NOT FOUND IN OFFICIAL REGISTRY'}
                  </h2>
                </div>
              </div>

              <div className="text-right font-mono text-xs bg-black/20 px-3.5 py-2 rounded-xl">
                <div className="opacity-75 text-[10px] uppercase">Reference</div>
                <div className="font-bold text-sm">{result.referenceNumber}</div>
              </div>
            </div>

            {result.found ? (
              <div className="p-6 sm:p-8 space-y-6">
                {/* Issuer & Recipient Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                      Verified Issuing Entity
                    </div>
                    <div className="font-black text-base text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      {result.issuer.legalName}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                      <div>Proprietor: <strong>{result.issuer.proprietor}</strong></div>
                      <div>BRS Reg No: <strong className="font-mono">{result.issuer.regNumber}</strong> (Cap 499, Sec 14)</div>
                      <div>Official KRA PIN: <strong className="font-mono text-blue-700">{result.issuer.taxPin}</strong></div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                      Billed Client &amp; Settlement Status
                    </div>
                    <div className="font-black text-base text-slate-900">
                      {result.recipient?.businessName}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                      <div>Registered Email: <span className="font-mono">{result.recipient?.emailMasked}</span></div>
                      <div>
                        Document Status:{' '}
                        <span
                          className={
                            result.status === 'PAID'
                              ? 'inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800'
                              : 'inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800'
                          }
                        >
                          {result.status}
                        </span>
                      </div>
                      <div>
                        Issued: <strong>{result.issuedAt ? formatDate(result.issuedAt) : '—'}</strong>
                        {result.dueDate ? ` · Due: ${formatDate(result.dueDate)}` : ''}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Line Items & Totals */}
                {result.lineItems && result.lineItems.length > 0 && (
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-blue-600" />
                      Authenticated Deliverables &amp; Financial Summary
                    </div>
                    <div className="border border-blue-600 rounded-xl overflow-hidden">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="py-2.5 px-3 text-left font-bold uppercase text-sky-300 w-12">No.</th>
                            <th className="py-2.5 px-3 text-left font-bold uppercase">Service / Deliverable Description</th>
                            <th className="py-2.5 px-3 text-center font-bold uppercase w-16">Qty</th>
                            <th className="py-2.5 px-3 text-right font-bold uppercase w-36">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {result.lineItems.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'}>
                              <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{item.description}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                                {formatMoney(item.amount, result.currency || 'KES')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Subtotal (Net)</div>
                        <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                          {formatMoney(result.subtotal ?? 0, result.currency || 'KES')}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                        <div className="text-[10px] font-bold uppercase text-slate-400">
                          {result.vatLabel || '16% KRA VAT'}
                        </div>
                        <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                          {formatMoney(result.vatAmount ?? 0, result.currency || 'KES')}
                        </div>
                      </div>
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3.5">
                        <div className="text-[10px] font-bold uppercase text-blue-700">Total Verified Amount</div>
                        <div className="text-base font-black text-slate-900 mt-0.5">
                          {formatMoney(result.totalAmount ?? 0, result.currency || 'KES')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Barcode, Cryptographic Fingerprint & Digital Seal */}
                <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      ISO/IEC 15417 Code-128 Security Barcode &amp; SHA-256 Digest
                    </div>
                    {barcodeSvg && (
                      <div
                        className="inline-block bg-white p-3 rounded-xl border border-slate-300"
                        dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                      />
                    )}
                    <div className="font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg break-all">
                      {result.cryptographicFingerprint}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Pursuant to Kenya KICA Cap 411A &amp; Registration of Business Names Act (Cap 499, Sec 14), this system-generated record is valid without wet-ink signature. Official BRS check: SMS &ldquo;BRS&rdquo; to 21546.
                    </p>
                  </div>

                  {stampSvg && (
                    <div
                      className="shrink-0"
                      dangerouslySetInnerHTML={{ __html: stampSvg }}
                    />
                  )}
                </div>

                {/* Official Payment Instructions & Portal Link */}
                {result.paymentChannels && (
                  <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                    <div>
                      <strong>Authorized Payment Channels:</strong> Lipa Na M-Pesa Paybill{' '}
                      <span className="font-mono font-bold text-emerald-700">
                        {result.paymentChannels.mpesaPaybill}
                      </span>{' '}
                      (A/C{' '}
                      <span className="font-mono font-bold text-emerald-700">
                        {result.paymentChannels.mpesaAccountNumber}
                      </span>
                      ) · {result.paymentChannels.bankName} ({result.paymentChannels.bankBranch}) A/C{' '}
                      <span className="font-mono font-bold text-slate-900">
                        {result.paymentChannels.bankAccountNumber}
                      </span>{' '}
                      (SWIFT: <span className="font-mono font-bold">{result.paymentChannels.bankSwiftCode}</span>)
                    </div>
                    <Link
                      href="/portal/invoices"
                      className="inline-flex items-center gap-1.5 font-extrabold text-blue-600 hover:text-blue-700"
                    >
                      Open Client Billing Portal
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-slate-700 font-medium">{result.message}</p>
                <p className="text-xs text-slate-500">
                  Double-check the reference code printed on the top-right (`REF: INV-...`) or directly beneath the security barcode, or contact{' '}
                  <a href="mailto:billing@bazionweb.com" className="text-blue-600 font-bold underline">
                    billing@bazionweb.com
                  </a>
                  .
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyDocumentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      }
    >
      <VerifyPortalContent />
    </Suspense>
  );
}

