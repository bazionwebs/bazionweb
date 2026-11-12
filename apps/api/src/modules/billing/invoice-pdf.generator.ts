import { createHmac } from 'crypto';
import { BAZION_LOGO_PDF_ASSET } from './brand-logo.asset';

export const OFFICIAL_BAZION_KRA_PIN = 'A006926734I';

export const OFFICIAL_BAZION_PAYMENT_DETAILS = {
  mpesaPaybill: '400200',
  mpesaAccountNumber: '1205232',
  mpesaAccountName: 'BAZION WEB',
  bankName: 'Co-operative Bank of Kenya',
  bankBranch: 'Dandora Branch',
  bankAccountName: 'BAZION WEB',
  bankAccountNumber: '01103361465001',
  bankSwiftCode: 'KCOOKENA',
  onlinePortalUrl: 'https://bazionweb.com/portal/invoices',
  verificationPortalUrl: 'https://bazionweb.com/verify',
} as const;

/**
 * VAT registration status of the supplier (BAZION WEB, KRA PIN A006926734I).
 *
 * Under the Kenya VAT Act, 2013 only a person registered for the VAT obligation
 * may charge VAT or issue a "Tax Invoice". BazionWeb is NOT VAT-registered, so by
 * default no VAT is charged, split out, or labelled anywhere. Set the env var
 * `COMPANY_VAT_REGISTERED=true` only after the VAT obligation is active on iTax.
 */
export function isSupplierVatRegistered(raw?: string | boolean | null): boolean {
  if (typeof raw === 'boolean') return raw;
  return ['true', '1', 'yes'].includes(String(raw ?? '').trim().toLowerCase());
}

export const NON_VAT_REGISTERED_NOTICE = '';

/** Line items that represent a tax charge rather than a deliverable (legacy VAT rows). */
export function isTaxLineItem(description?: string | null): boolean {
  return /\bvat\b|value added tax/i.test(String(description || ''));
}

// ISO/IEC 15417 Code 128 symbol bar/space width patterns (0..106)
export const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

function countDigitsAt(str: string, pos: number): number {
  let count = 0;
  while (pos + count < str.length) {
    const ch = str.charCodeAt(pos + count);
    if (ch < 48 || ch > 57) break;
    count++;
  }
  return count;
}

/**
 * ISO/IEC 15417 Annex E compliant Code 128 Auto-Subset (B/C) encoder.
 * Automatically switches into double-density numeric Subset C (Code 99 / Start 105)
 * for runs of 4+ digits (e.g. `40770343` in `INV-MAN-40770343-3099D6`), maximizing
 * X-dimension bar width for numeric references while preserving the encoded value.
 */
export function encodeCode128Bars(rawText: string): {
  codes: number[];
  bars: Array<{ offset: number; width: number }>;
  totalModules: number;
  encodedText: string;
} {
  const encodedText =
    String(rawText || 'BAZIONWEB')
      .replace(/[^\x20-\x7E]/g, '')
      .trim() || 'BAZIONWEB';

  const codes: number[] = [];
  let pos = 0;
  const leadingDigits = countDigitsAt(encodedText, 0);
  let mode: 'B' | 'C' =
    leadingDigits >= 4 || (leadingDigits === 2 && encodedText.length === 2)
      ? 'C'
      : 'B';
  codes.push(mode === 'C' ? 105 : 104);

  while (pos < encodedText.length) {
    if (mode === 'C') {
      const digits = countDigitsAt(encodedText, pos);
      if (digits >= 2) {
        codes.push(Number(encodedText.slice(pos, pos + 2)));
        pos += 2;
      } else {
        codes.push(100); // Switch to Code B
        mode = 'B';
      }
    } else {
      const digits = countDigitsAt(encodedText, pos);
      if (digits >= 4) {
        if (digits % 2 === 1) {
          codes.push(encodedText.charCodeAt(pos) - 32);
          pos += 1;
        }
        codes.push(99); // Switch to Code C
        mode = 'C';
      } else {
        codes.push(encodedText.charCodeAt(pos) - 32);
        pos += 1;
      }
    }
  }

  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);
  codes.push(106); // Stop pattern (13 modules, 4 bars)

  const bars: Array<{ offset: number; width: number }> = [];
  let cursor = 0;

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let j = 0; j < pattern.length; j++) {
      const w = Number(pattern[j]);
      if (j % 2 === 0) {
        bars.push({ offset: cursor, width: w });
      }
      cursor += w;
    }
  }

  return { codes, bars, totalModules: cursor, encodedText };
}

/**
 * Decodes Code 128 bar segments back into ASCII text and verifies the ISO/IEC 15417
 * Modulo-103 checksum and Stop symbol. Used by tests to validate the encoded sequence.
 */
export function decodeCode128Bars(
  bars: Array<{ offset: number; width: number }>,
  totalModules: number,
): string {
  const widths: number[] = [];
  let pos = 0;
  for (const b of bars) {
    if (b.offset > pos) widths.push(b.offset - pos);
    widths.push(b.width);
    pos = b.offset + b.width;
  }
  if (totalModules > pos) widths.push(totalModules - pos);

  const codes: number[] = [];
  let i = 0;
  while (i < widths.length) {
    const len = widths.length - i === 7 ? 7 : 6;
    const pat = widths.slice(i, i + len).join('');
    const idx = CODE128_PATTERNS.indexOf(pat);
    if (idx === -1) {
      throw new Error(`Invalid Code 128 bar/space pattern: ${pat}`);
    }
    codes.push(idx);
    i += len;
  }

  const stop = codes[codes.length - 1];
  const check = codes[codes.length - 2];
  let sum = codes[0];
  for (let k = 1; k < codes.length - 2; k++) {
    sum += codes[k] * k;
  }
  if (stop !== 106 || sum % 103 !== check) {
    throw new Error('Code 128 Modulo-103 checksum or stop pattern verification failed');
  }

  let mode: 'B' | 'C' = codes[0] === 105 ? 'C' : 'B';
  let out = '';
  for (let k = 1; k < codes.length - 2; k++) {
    const c = codes[k];
    if (mode === 'C') {
      if (c === 100) mode = 'B';
      else out += String(c).padStart(2, '0');
    } else {
      if (c === 99) mode = 'C';
      else out += String.fromCharCode(c + 32);
    }
  }
  return out;
}

/**
 * Creates a server-keyed document signature. A plain checksum is not an
 * authenticity control because document fields and browser code are public.
 */
function canonicalizeDocumentValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalizeDocumentValue);
  if (!value || typeof value !== 'object') return value ?? null;
  const candidate = value as Record<string, unknown> & { toJSON?: () => unknown };
  if (typeof candidate.toJSON === 'function') {
    const jsonValue = candidate.toJSON();
    if (jsonValue !== value) return canonicalizeDocumentValue(jsonValue);
  }
  return Object.fromEntries(
    Object.keys(candidate).sort().map((key) => [key, canonicalizeDocumentValue(candidate[key])]),
  );
}
export function computeDocumentFingerprint(
  params: {
    docNumber: string;
    totalAmount: number | string;
    currency: string;
    recipientEmail: string;
    issueDate: Date | string;
    documentContent?: unknown;
  },
  signingKey: string,
): { hashHex: string; formatted: string } {
  if (!signingKey || signingKey.length < 32) {
    throw new Error('A document signing key of at least 32 characters is required.');
  }
  const canonicalPayload = JSON.stringify([
    'bazionweb-document-v2',
    String(params.docNumber || '').trim().toUpperCase(),
    String(params.totalAmount ?? 0),
    String(params.currency || 'USD').toUpperCase(),
    String(params.recipientEmail || '').trim().toLowerCase(),
    new Date(params.issueDate).toISOString().slice(0, 10),
    canonicalizeDocumentValue(params.documentContent ?? null),
  ]);
  const hashHex = createHmac('sha256', signingKey).update(canonicalPayload).digest('hex').toUpperCase();
  return { hashHex, formatted: `HMAC-SHA256: ${hashHex}` };
}

export function resolveSupplierTaxPin(configuredPin?: string | null): string {
  const cleaned = (configuredPin || '').trim();
  if (
    !cleaned ||
    cleaned.toUpperCase() === 'P052198745M' ||
    cleaned.toUpperCase().includes('CHANGE_ME')
  ) {
    return OFFICIAL_BAZION_KRA_PIN;
  }
  return cleaned;
}

export function sanitizePdfText(raw: string): string {
  return String(raw ?? '')
    .replace(/[\u2014\u2013\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022\u00B7]/g, '|')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '');
}

function wrapPdfTextLines(text: string, maxCharacters: number): string[] {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines: string[] = [];
  let line = '';
  for (let word of words) {
    while (word.length > maxCharacters) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(word.slice(0, maxCharacters));
      word = word.slice(maxCharacters);
    }
    if (!word) continue;
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxCharacters) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
export interface InvoicePdfData {
  invoiceNumber: string;
  currency: string;
  amount: number;
  status: string;
  createdAt: Date | string;
  dueDate: Date | string;
  paidAt?: Date | string | null;
  notes?: string | null;
  client: {
    businessName: string;
    contactName?: string | null;
    email: string;
    address?: string | null;
    country?: string | null;
    taxPin?: string | null;
  };
  lineItems: Array<{
    description?: string;
    quantity?: number;
    amount?: number;
    unitPrice?: number;
  }>;
  breakdown: {
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    vatLabel: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
    /** Whether the supplier is VAT-registered. Defaults to vatAmount > 0. */
    vatRegistered?: boolean;
  };
  paymentRef?: string | null;
  /** Per-invoice bank details created by the billing service. */
  bankTransferDetails?: {
    currency?: string;
    beneficiary?: string | null;
    accountNumber?: string | null;
    iban?: string | null;
    routingNumber?: string | null;
    swiftBic?: string | null;
    bankName?: string | null;
    bankAddress?: string | null;
    paymentReference?: string | null;
  };
  /** Server-generated HMAC signature; never generate this in browser code. */
  documentFingerprint?: string;
  /** Issuer details from configuration; omitted fields fall back to official corporate defaults. */
  supplier?: {
    address?: string | null;
    taxPin?: string | null;
  };
}

export class InvoicePdfGenerator {
  /**
   * Generates a compliant PDF 1.4 binary buffer.
   * Embeds the official BazionWeb brand logo as a 300-DPI /FlateDecode RGB XObject (/Im1),
   * official Co-operative Bank & M-Pesa Paybill payment instructions,
   * Code-128 document-reference barcode, BRS/KRA corporate credentials, and the
   * server-generated HMAC signature for independent record verification.
   */
  static generate(data: InvoicePdfData): Buffer {
    const isPaid = data.status === 'PAID';
    // Only a VAT-registered supplier may title a document "Tax Invoice" (VAT Act, 2013).
    const chargesVat =
      (data.breakdown.vatRegistered ?? data.breakdown.vatAmount > 0) &&
      data.breakdown.vatAmount > 0;
    const docTitle = isPaid
      ? 'OFFICIAL PAYMENT RECEIPT'
      : chargesVat
        ? 'OFFICIAL TAX INVOICE'
        : 'OFFICIAL INVOICE';
    const statusText = isPaid ? 'PAID IN FULL' : data.status;

    const supplierAddress =
      data.supplier?.address || 'Mwiki, Gituamba, Embakasi District, Nairobi';
    const supplierPoBox = 'P.O. Box 46376, 00100 - G.P.O Nairobi, Kenya';
    const supplierTaxPin = resolveSupplierTaxPin(data.supplier?.taxPin);

    const contentLines: string[] = [];

    const esc = (text: string) =>
      sanitizePdfText(text)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

    // ── 1. Top Brand Banner (Navy #0F172A + Royal Accent Bar) ──
    contentLines.push('q');
    contentLines.push('0.059 0.090 0.165 rg'); // #0F172A
    contentLines.push('0 746 595.28 95.89 re f');
    contentLines.push('0.145 0.388 0.921 rg'); // #2563EB bottom accent line
    contentLines.push('0 746 595.28 2.5 re f');

    // Crisp light border & backing around the embedded official logo (aspect ratio 320:287 = 82:73.54)
    contentLines.push('0.922 0.922 0.922 rg');
    contentLines.push('39 756.5 84 75.5 re f');
    contentLines.push('0.28 0.36 0.48 RG 0.75 w');
    contentLines.push('39 756.5 84 75.5 re S');
    contentLines.push('Q');

    // Render Official BazionWeb Logo Image XObject (/Im1) at (40, 757.5), size 82 x 73.5 pt (~300 DPI)
    contentLines.push('q');
    contentLines.push('82 0 0 73.5 40 757.5 cm');
    contentLines.push('/Im1 Do');
    contentLines.push('Q');

    // Brand Identity & Registration Credentials (cleanly positioned at x=134, zero overlap)
    contentLines.push('BT');
    contentLines.push('/F2 15.5 Tf');
    contentLines.push('1 1 1 rg');
    contentLines.push('134 811 Td');
    contentLines.push(`(${esc('BAZION')}) Tj`);
    contentLines.push('0.22 0.74 0.97 rg'); // Sky Blue #38BDF8
    contentLines.push(`(${esc(' WEB')}) Tj`);
    contentLines.push('/F1 8 Tf');
    contentLines.push('0.85 0.9 0.98 rg');
    contentLines.push('0 -14 Td');
    contentLines.push(
      `(${esc('Enterprise Web Systems & Managed Cloud Infrastructure')}) Tj`,
    );
    contentLines.push('/F1 7.2 Tf');
    contentLines.push('0.68 0.77 0.90 rg');
    contentLines.push('0 -11 Td');
    contentLines.push(
      `(${esc('Gov. of Kenya Reg. No. BN-DLSZOZ6O (Cap 499, Sec 14)')}) Tj`,
    );
    contentLines.push('/F2 7.2 Tf');
    contentLines.push('0.49 0.83 0.99 rg');
    contentLines.push('0 -11 Td');
    contentLines.push(
      `(${esc(`Official KRA PIN: ${supplierTaxPin}  |  www.bazionweb.com`)}) Tj`,
    );
    contentLines.push('ET');

    // Document Title & Reference in header right
    contentLines.push('BT');
    contentLines.push('/F2 11.5 Tf');
    contentLines.push('1 1 1 rg');
    contentLines.push('382 812 Td');
    contentLines.push(`(${esc(docTitle)}) Tj`);
    contentLines.push('/F2 8.8 Tf');
    contentLines.push('0.85 0.9 0.98 rg');
    contentLines.push('0 -14 Td');
    contentLines.push(`(${esc(`REF: ${data.invoiceNumber}`)}) Tj`);
    contentLines.push('ET');

    // Status Pill in header right
    contentLines.push('q');
    contentLines.push(isPaid ? '0.063 0.725 0.651 rg' : '0.145 0.388 0.921 rg');
    contentLines.push('382 775 118 15 re f');
    contentLines.push('Q');
    contentLines.push('BT');
    contentLines.push('/F2 7.5 Tf');
    contentLines.push('1 1 1 rg');
    contentLines.push('390 779.5 Td');
    contentLines.push(`(${esc(isPaid ? 'PAID IN FULL' : `STATUS: ${data.status}`)}) Tj`);
    contentLines.push('ET');

    // ── 2. Supplier (Issuer) & Client Information ──
    contentLines.push('BT');
    contentLines.push('/F2 9 Tf');
    contentLines.push('0.06 0.09 0.16 rg');
    contentLines.push('40 726 Td');
    contentLines.push(`(${esc('SUPPLIER (ISSUER):')}) Tj`);
    contentLines.push('/F2 9.5 Tf');
    contentLines.push('0.1 0.15 0.25 rg');
    contentLines.push('0 -13 Td');
    contentLines.push(`(${esc('BAZION WEB')}) Tj`);
    contentLines.push('/F1 8.5 Tf');
    contentLines.push('0.35 0.4 0.45 rg');
    contentLines.push('0 -12 Td');
    contentLines.push(`(${esc('Proprietor: Joseph Mburu Kiai')}) Tj`);
    contentLines.push('0 -11 Td');
    contentLines.push(`(${esc('Reg. Number: BN-DLSZOZ6O (Cap 499, Sec 14)')}) Tj`);
    contentLines.push('0 -11 Td');
    contentLines.push(`(${esc(supplierAddress)}) Tj`);
    contentLines.push('0 -11 Td');
    contentLines.push(`(${esc(supplierPoBox)}) Tj`);
    contentLines.push('0 -11 Td');
    contentLines.push(
      `(${esc(`KRA PIN: ${supplierTaxPin} | billing@bazionweb.com`)}) Tj`,
    );
    contentLines.push('ET');

    // Client Info (Right Column)
    contentLines.push('BT');
    contentLines.push('/F2 9 Tf');
    contentLines.push('0.06 0.09 0.16 rg');
    contentLines.push('320 726 Td');
    contentLines.push(`(${esc('BILLED TO (CLIENT):')}) Tj`);
    contentLines.push('/F2 9.5 Tf');
    contentLines.push('0.1 0.15 0.25 rg');
    contentLines.push('0 -13 Td');
    contentLines.push(`(${esc(data.client.businessName || 'Valued Client')}) Tj`);
    contentLines.push('/F1 8.5 Tf');
    contentLines.push('0.35 0.4 0.45 rg');
    contentLines.push('0 -12 Td');
    contentLines.push(
      `(${esc(data.client.contactName ? `Attn: ${data.client.contactName}` : data.client.email)}) Tj`,
    );
    contentLines.push('0 -11 Td');
    contentLines.push(`(${esc(`Email: ${data.client.email}`)}) Tj`);
    if (data.client.address) {
      contentLines.push('0 -11 Td');
      contentLines.push(`(${esc(`Address: ${data.client.address}`)}) Tj`);
    }
    contentLines.push('0 -11 Td');
    contentLines.push(`(${esc(`Tax / KRA PIN: ${data.client.taxPin || 'N/A'}`)}) Tj`);
    contentLines.push('ET');

    // Horizontal Divider
    contentLines.push('q');
    contentLines.push('0.85 0.88 0.92 RG 1 w');
    contentLines.push('40 646 m 555 646 l S');
    contentLines.push('Q');

    // ── 3. Meta Dates & Financial Settlement Row ──
    const issueDateStr = new Date(data.createdAt).toISOString().slice(0, 10);
    const dueDateStr = new Date(data.dueDate).toISOString().slice(0, 10);

    contentLines.push('BT');
    contentLines.push('/F1 8 Tf');
    contentLines.push('0.4 0.45 0.5 rg');
    contentLines.push('40 631 Td');
    contentLines.push(`(${esc(`Issue Date: ${issueDateStr}`)}) Tj`);
    contentLines.push('130 0 Td');
    contentLines.push(`(${esc(`Due Date: ${dueDateStr}`)}) Tj`);
    contentLines.push('130 0 Td');
    contentLines.push(`(${esc(`Status: ${statusText}`)}) Tj`);
    if (data.paymentRef) {
      contentLines.push('120 0 Td');
      contentLines.push(`(${esc(`Settlement Ref: ${data.paymentRef}`)}) Tj`);
    } else {
      contentLines.push('120 0 Td');
      contentLines.push(`(${esc(`Currency: ${data.currency}`)}) Tj`);
    }
    contentLines.push('ET');

    // ── 4. Executive Itemized Table Header (High-Contrast Navy + Royal Accent) ──
    const tableTopY = 625;
    const headerH = 23;
    const headerBottomY = tableTopY - headerH; // 602

    contentLines.push('q');
    contentLines.push('0.059 0.090 0.165 rg');
    contentLines.push(`40 ${headerBottomY} 515 ${headerH} re f`);
    contentLines.push('0.145 0.388 0.921 rg');
    contentLines.push(`40 ${tableTopY - 2.5} 515 2.5 re f`);
    contentLines.push('Q');

    contentLines.push('BT');
    contentLines.push('/F2 7.8 Tf');
    contentLines.push('0.49 0.83 0.99 rg');
    contentLines.push(`47 ${headerBottomY + 7.5} Td`);
    contentLines.push(`(${esc('NO.')}) Tj`);
    contentLines.push('1 1 1 rg');
    contentLines.push('25 0 Td');
    contentLines.push(`(${esc('SERVICE / DELIVERABLE DESCRIPTION')}) Tj`);
    contentLines.push('273 0 Td');
    contentLines.push(`(${esc('QTY')}) Tj`);
    contentLines.push('40 0 Td');
    contentLines.push(`(${esc('UNIT PRICE')}) Tj`);
    contentLines.push('85 0 Td');
    contentLines.push(`(${esc('LINE TOTAL')}) Tj`);
    contentLines.push('ET');

    // ── 5. Standout Zebra-Striped & Framed Line Items Rendering ──
    const baseRowH = 21;
    let rowTopY = headerBottomY;
    const items =
      data.lineItems && data.lineItems.length > 0
        ? data.lineItems
        : [
            {
              description: data.notes || 'Engineering Services',
              quantity: 1,
              amount: data.amount,
            },
          ];

    items.forEach((item, idx) => {
      const desc = sanitizePdfText(
        item.description || 'Cloud & Hosting Infrastructure Service',
      );
      const descriptionLines = wrapPdfTextLines(desc, 42);
      const rowH = Math.max(baseRowH, descriptionLines.length * 9 + 12);
      const rowBottomY = rowTopY - rowH;
      const descriptionFirstLineY = rowBottomY + rowH - 14;
      const valueTextY = rowBottomY + (rowH - 8) / 2;
      const isTaxRow = isTaxLineItem(desc);
      const qty = Math.max(1, Number(item.quantity ?? 1));
      const amtVal = Number(item.amount ?? data.amount ?? 0);
      const unitVal =
        item.unitPrice !== undefined && Number(item.unitPrice) > 0
          ? Number(item.unitPrice)
          : amtVal / qty;

      const unitStr = `${data.currency} ${unitVal.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
      const amtStr = `${data.currency} ${amtVal.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
      const rowNumStr = String(idx + 1).padStart(2, '0');

      contentLines.push('q');
      if (isTaxRow) {
        contentLines.push('0.935 0.958 0.992 rg');
      } else if (idx % 2 === 1) {
        contentLines.push('0.968 0.978 0.995 rg');
      } else {
        contentLines.push('1 1 1 rg');
      }
      contentLines.push(`40 ${rowBottomY} 515 ${rowH} re f`);

      contentLines.push(isTaxRow ? '0.051 0.580 0.533 rg' : '0.145 0.388 0.921 rg');
      contentLines.push(`40 ${rowBottomY} 3 ${rowH} re f`);

      contentLines.push(isTaxRow ? '0.86 0.95 0.93 rg' : '0.918 0.945 0.996 rg');
      contentLines.push(`342 ${rowBottomY + (rowH - 13) / 2} 24 13 re f`);

      contentLines.push('0.84 0.88 0.93 RG 0.6 w');
      contentLines.push(`40 ${rowBottomY} m 555 ${rowBottomY} l S`);
      contentLines.push('Q');

      contentLines.push('BT');
      contentLines.push('/F2 7.8 Tf');
      contentLines.push(isTaxRow ? '0.051 0.580 0.533 rg' : '0.145 0.388 0.921 rg');
      contentLines.push(`48 ${valueTextY} Td`);
      contentLines.push(`(${esc(rowNumStr)}) Tj`);

      contentLines.push('/F2 7.8 Tf');
      contentLines.push(isTaxRow ? '0.08 0.28 0.36 rg' : '0.06 0.09 0.16 rg');
      contentLines.push(`1 0 0 1 71 ${descriptionFirstLineY} Tm`);
      descriptionLines.forEach((line, lineIndex) => {
        contentLines.push(`(${esc(line)}) Tj`);
        if (lineIndex < descriptionLines.length - 1) contentLines.push('0 -9 Td');
      });

      contentLines.push('/F2 7.8 Tf');
      contentLines.push(isTaxRow ? '0.04 0.45 0.40 rg' : '0.11 0.30 0.85 rg');
      contentLines.push(`1 0 0 1 351 ${valueTextY} Tm`);
      contentLines.push(`(${esc(String(qty))}) Tj`);

      contentLines.push('/F1 7.8 Tf');
      contentLines.push('0.30 0.36 0.44 rg');
      contentLines.push(`1 0 0 1 385 ${valueTextY} Tm`);
      contentLines.push(`(${esc(unitStr)}) Tj`);

      contentLines.push('/F2 8.4 Tf');
      contentLines.push(isTaxRow ? '0.05 0.38 0.35 rg' : '0.059 0.090 0.165 rg');
      contentLines.push(`1 0 0 1 470 ${valueTextY} Tm`);
      contentLines.push(`(${esc(amtStr)}) Tj`);
      contentLines.push('ET');

      rowTopY = rowBottomY;
    });
    const tableBottomY = rowTopY;
    const totalTableH = tableTopY - tableBottomY;
    contentLines.push('q');
    contentLines.push('0.86 0.89 0.94 RG 0.5 w');
    contentLines.push(`66 ${tableBottomY} m 66 ${headerBottomY} l S`);
    contentLines.push(`336 ${tableBottomY} m 336 ${headerBottomY} l S`);
    contentLines.push(`376 ${tableBottomY} m 376 ${headerBottomY} l S`);
    contentLines.push(`462 ${tableBottomY} m 462 ${headerBottomY} l S`);
    contentLines.push('0.145 0.388 0.921 RG 1 w');
    contentLines.push(`40 ${tableBottomY} 515 ${totalTableH} re S`);
    contentLines.push('Q');

    const currentY = tableBottomY - 6;

    // ── 6. Payment Instructions Card (Left) & Financial Breakdown Box (Right) ──
    const boxY = Math.max(268, currentY - 14);
    const boxBottomY = boxY - 110;

    contentLines.push('q');
    contentLines.push('0.975 0.985 0.995 rg');
    contentLines.push(`40 ${boxBottomY} 278 125 re f`);
    contentLines.push('0.82 0.86 0.92 RG 1 w');
    contentLines.push(`40 ${boxBottomY} 278 125 re S`);
    contentLines.push('0.059 0.090 0.165 rg');
    contentLines.push(`40 ${boxY + 1} 278 14 re f`);
    contentLines.push('Q');

    contentLines.push('BT');
    contentLines.push('/F2 7.2 Tf');
    contentLines.push('1 1 1 rg');
    contentLines.push(`48 ${boxY + 5} Td`);
    contentLines.push(`(${esc('OFFICIAL PAYMENT INSTRUCTIONS  (QUOTE INVOICE REF)')}) Tj`);
    contentLines.push('ET');

    const p = OFFICIAL_BAZION_PAYMENT_DETAILS;
    const bank = data.bankTransferDetails;
    contentLines.push('BT');
    contentLines.push('/F2 7.2 Tf');
    contentLines.push('0.05 0.45 0.25 rg');
    contentLines.push(`48 ${boxY - 10} Td`);
    if (bank && !isPaid) {
      contentLines.push(`(${esc(`BANK TRANSFER IN ${bank.currency || data.currency} | USE THE REFERENCE BELOW`)}) Tj`);
      contentLines.push('/F1 7.1 Tf');
      contentLines.push('0.08 0.12 0.20 rg');
      contentLines.push('0 -11 Td');
      contentLines.push(`(${esc(`Beneficiary: ${bank.beneficiary || 'BAZION WEB'}`)}) Tj`);
      contentLines.push('0 -10 Td');
      contentLines.push(`(${esc(`Account / IBAN: ${bank.iban || bank.accountNumber || 'Contact billing'}`)}) Tj`);
      if (bank.routingNumber) {
        contentLines.push('0 -10 Td');
        contentLines.push(`(${esc(`Routing / ABA: ${bank.routingNumber}`)}) Tj`);
      }
      if (bank.swiftBic) {
        contentLines.push('0 -10 Td');
        contentLines.push(`(${esc(`SWIFT / BIC: ${bank.swiftBic}`)}) Tj`);
      }
      if (bank.bankName || bank.bankAddress) {
        contentLines.push('0 -10 Td');
        contentLines.push(`(${esc(`Bank: ${bank.bankName || bank.bankAddress}`)}) Tj`);
      }
      contentLines.push('/F2 7.4 Tf');
      contentLines.push('0.10 0.30 0.78 rg');
      contentLines.push('0 -12 Td');
      contentLines.push(`(${esc(`Payment reference: ${bank.paymentReference || data.paymentRef || data.invoiceNumber}`)}) Tj`);
      contentLines.push('/F1 6.7 Tf');
      contentLines.push('0.32 0.38 0.46 rg');
      contentLines.push('0 -10 Td');
      contentLines.push(`(${esc('Confirm receipt with billing@bazionweb.com')}) Tj`);
    } else if (isPaid) {
      contentLines.push(`(${esc('PAYMENT CONFIRMED')}) Tj`);
      contentLines.push('/F1 7.2 Tf');
      contentLines.push('0.32 0.38 0.46 rg');
      contentLines.push('0 -12 Td');
      contentLines.push(`(${esc(`Settlement reference: ${data.paymentRef || 'On record'}`)}) Tj`);
      contentLines.push('0 -10 Td');
      contentLines.push(`(${esc('View your current billing record at bazionweb.com/portal/invoices')}) Tj`);
    } else {
      contentLines.push(`(${esc('LIPA NA M-PESA (CO-OP BANK PAYBILL)')}) Tj`);
      contentLines.push('/F1 7.2 Tf');
      contentLines.push('0.08 0.12 0.20 rg');
      contentLines.push('0 -11 Td');
      contentLines.push(`(${esc(`Paybill: ${p.mpesaPaybill} | Account: ${p.mpesaAccountNumber} | Name: ${p.mpesaAccountName}`)}) Tj`);
      contentLines.push('/F2 7.2 Tf');
      contentLines.push('0.10 0.30 0.78 rg');
      contentLines.push('0 -13 Td');
      contentLines.push(`(${esc(`BANK TRANSFER (${p.bankName} - ${p.bankBranch})`)}) Tj`);
      contentLines.push('/F1 7 Tf');
      contentLines.push('0.12 0.16 0.24 rg');
      contentLines.push('0 -10 Td');
      contentLines.push(`(${esc(`Beneficiary: ${p.bankAccountName} | Account: ${p.bankAccountNumber}`)}) Tj`);
      contentLines.push('0 -10 Td');
      contentLines.push(`(${esc(`SWIFT / BIC: ${p.bankSwiftCode} | Portal: bazionweb.com/portal/invoices`)}) Tj`);
    }
    contentLines.push('ET');

    // 6B. Financial Breakdown Box (Right: x=330..555, w=225, h=125)
    contentLines.push('q');
    contentLines.push('0.97 0.98 1.0 rg');
    contentLines.push(`330 ${boxBottomY} 225 125 re f`);
    contentLines.push('0.85 0.88 0.92 RG 1 w');
    contentLines.push(`330 ${boxBottomY} 225 125 re S`);
    contentLines.push('Q');

    const fmt = (num: number) =>
      `${data.currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    contentLines.push('BT');
    contentLines.push('/F1 8 Tf');
    contentLines.push('0.3 0.35 0.4 rg');
    contentLines.push(`345 ${boxY} Td`);
    contentLines.push(`(${esc(chargesVat ? 'Subtotal (Excl. VAT):' : 'Subtotal:')}) Tj`);
    contentLines.push('110 0 Td');
    contentLines.push(`(${esc(fmt(data.breakdown.subtotal))}) Tj`);

    if (chargesVat) {
      contentLines.push('-110 -18 Td');
      contentLines.push(`(${esc(`Add: ${data.breakdown.vatLabel}:`)}) Tj`);
      contentLines.push('110 0 Td');
      contentLines.push(`(${esc(fmt(data.breakdown.vatAmount))}) Tj`);
    }

    contentLines.push('/F2 9 Tf');
    contentLines.push('0.05 0.09 0.16 rg');
    contentLines.push(chargesVat ? '-110 -22 Td' : '-110 -24 Td');
    contentLines.push(`(${esc(chargesVat ? 'Total (Incl. VAT):' : 'Total Invoice Amount:')}) Tj`);
    contentLines.push('110 0 Td');
    contentLines.push(`(${esc(fmt(data.breakdown.total))}) Tj`);

    contentLines.push('/F1 8 Tf');
    contentLines.push('0.1 0.5 0.2 rg');
    contentLines.push('-110 -18 Td');
    contentLines.push(`(${esc('Amount Paid:')}) Tj`);
    contentLines.push('110 0 Td');
    contentLines.push(`(${esc(fmt(data.breakdown.amountPaid))}) Tj`);

    contentLines.push('/F2 9 Tf');
    contentLines.push(data.breakdown.balanceDue > 0 ? '0.7 0.1 0.1 rg' : '0.1 0.5 0.2 rg');
    contentLines.push('-110 -20 Td');
    contentLines.push(`(${esc('Balance Due:')}) Tj`);
    contentLines.push('110 0 Td');
    contentLines.push(`(${esc(fmt(data.breakdown.balanceDue))}) Tj`);
    contentLines.push('ET');

    // ── 7. Document reference and server-keyed HMAC verification panel ──
    // Keep a compact footer and balance whitespace around it.
    const securityPanelHeight = 120;
    // Balance whitespace above and below this compact verification block.
    // Longer invoices retain a 22pt bottom margin beneath the verification block.
    // Center the compact verification block within the space after the payment card.
    // Keep at least 22pt of bottom margin on invoices that use most of the page.
    const securityPanelBottomY = Math.max(
      22,
      Math.round((boxBottomY - 16 - securityPanelHeight) / 2),
    );
    const securityPanelTopY = securityPanelBottomY + securityPanelHeight;

    contentLines.push('q');
    contentLines.push('0.96 0.97 0.99 rg');
    contentLines.push(`40 ${securityPanelBottomY} 515 ${securityPanelHeight} re f`);
    contentLines.push('0.85 0.88 0.92 RG 0.75 w');
    contentLines.push(`40 ${securityPanelBottomY} 515 ${securityPanelHeight} re S`);
    contentLines.push('0.059 0.090 0.165 rg');
    contentLines.push(`40 ${securityPanelTopY - 12} 515 12 re f`);
    contentLines.push('1 1 1 rg');
    contentLines.push(`46 ${securityPanelBottomY + 5} 356 49 re f`);
    contentLines.push('0.82 0.86 0.92 RG 0.75 w');
    contentLines.push(`408 ${securityPanelBottomY + 5} 141 88 re S`);
    contentLines.push('Q');

    contentLines.push('BT');
    contentLines.push('/F2 5.8 Tf');
    contentLines.push('0.9 0.95 1 rg');
    contentLines.push(`48 ${securityPanelTopY - 8.5} Td`);
    contentLines.push(
      `(${esc(`BAZION WEB | REG: BN-DLSZOZ6O | KRA PIN: ${supplierTaxPin} | SYSTEM-GENERATED DOCUMENT`)}) Tj`,
    );
    contentLines.push('ET');

    contentLines.push('BT');
    contentLines.push('/F2 7.3 Tf');
    contentLines.push('0.1 0.15 0.25 rg');
    contentLines.push(`48 ${securityPanelTopY - 23} Td`);
    contentLines.push(`(${esc(`DOCUMENT RECORD | REF: ${data.invoiceNumber}`)}) Tj`);
    contentLines.push('/F1 6.1 Tf');
    contentLines.push('0.35 0.4 0.48 rg');
    contentLines.push('0 -9 Td');
    contentLines.push(`(${esc(`Issued by BAZION WEB | KRA PIN: ${supplierTaxPin}`)}) Tj`);
    contentLines.push('0 -8.5 Td');
    contentLines.push(`(${esc('Business Reg: BN-DLSZOZ6O | Verify at bazionweb.com/verify')}) Tj`);
    if (data.documentFingerprint) {
      contentLines.push('0 -8.5 Td');
      contentLines.push(`(${esc(data.documentFingerprint)}) Tj`);
    }
    contentLines.push('ET');

    // Code-128 encodes the public invoice reference for registry lookup. It is
    // an identifier, not an authenticity signature; the HMAC above is the proof.
    const cleanRef = sanitizePdfText(data.invoiceNumber).toUpperCase().slice(0, 26);
    const barcode = encodeCode128Bars(cleanRef);
    const maxActiveW = 320;
    const modulePt = Math.min(1.4, Math.floor((maxActiveW / barcode.totalModules) * 20) / 20);
    const actualBarcodeW = barcode.totalModules * modulePt;
    const barStartX = Math.round(46 + (356 - actualBarcodeW) / 2);
    const barBottomY = securityPanelBottomY + 20;
    const barHeight = 29;

    contentLines.push('q');
    contentLines.push('0 0 0 rg');
    for (const bar of barcode.bars) {
      const bx = (barStartX + bar.offset * modulePt).toFixed(2);
      const bw = (bar.width * modulePt).toFixed(2);
      contentLines.push(`${bx} ${barBottomY} ${bw} ${barHeight} re f`);
    }
    contentLines.push('Q');

    contentLines.push('BT');
    contentLines.push('/F2 6 Tf');
    contentLines.push('0.12 0.16 0.24 rg');
    contentLines.push(`54 ${securityPanelBottomY + 9} Td`);
    contentLines.push(
      `(${esc(`REFERENCE BARCODE (CODE-128): ${barcode.encodedText}  |  Verify: bazionweb.com/verify?ref=${barcode.encodedText}`)}) Tj`,
    );
    contentLines.push('ET');

    contentLines.push('BT');
    contentLines.push('/F2 7 Tf');
    contentLines.push(isPaid ? '0.05 0.5 0.3 rg' : '0.1 0.3 0.8 rg');
    contentLines.push(`416 ${securityPanelTopY - 31} Td`);
    contentLines.push(`(${esc('BAZION WEB DOCUMENT RECORD')}) Tj`);
    contentLines.push('/F2 7.8 Tf');
    contentLines.push('0.06 0.09 0.16 rg');
    contentLines.push('0 -12 Td');
    contentLines.push(`(${esc('BAZION WEB')}) Tj`);
    contentLines.push('/F1 6.3 Tf');
    contentLines.push('0.3 0.35 0.45 rg');
    contentLines.push('0 -10 Td');
    contentLines.push(`(${esc('REG NO: BN-DLSZOZ6O')}) Tj`);
    contentLines.push('0 -9.5 Td');
    contentLines.push(`(${esc(`KRA PIN: ${supplierTaxPin}`)}) Tj`);
    contentLines.push('0 -9.5 Td');
    contentLines.push(`(${esc('NAIROBI - KENYA')}) Tj`);
    contentLines.push('/F2 6.8 Tf');
    contentLines.push(isPaid ? '0.05 0.5 0.3 rg' : '0.1 0.3 0.8 rg');
    contentLines.push('0 -11.5 Td');
    contentLines.push(`(${esc(isPaid ? 'STATUS: PAID IN FULL' : `STATUS: ${data.status}`)}) Tj`);
    contentLines.push('/F1 5.4 Tf');
    contentLines.push('0.4 0.45 0.55 rg');
    contentLines.push('0 -9.5 Td');
    contentLines.push(`(${esc('DOCUMENT REFERENCE | bazionweb.com/verify')}) Tj`);
    contentLines.push('ET');

    const streamBody = contentLines.join('\n');
    const contentStreamBuf = Buffer.from(streamBody, 'latin1');
    const logoStreamBuf = Buffer.from(BAZION_LOGO_PDF_ASSET.flateBase64, 'base64');

    const objectBuffers: Buffer[] = [
      Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 'ascii'),
      Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', 'ascii'),
      Buffer.from(
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> >>\nendobj\n',
        'ascii',
      ),
      Buffer.concat([
        Buffer.from(`4 0 obj\n<< /Length ${contentStreamBuf.length} >>\nstream\n`, 'ascii'),
        contentStreamBuf,
        Buffer.from('\nendstream\nendobj\n', 'ascii'),
      ]),
      Buffer.from(
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
        'ascii',
      ),
      Buffer.from(
        '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
        'ascii',
      ),
      Buffer.concat([
        Buffer.from(
          `7 0 obj\n<< /Type /XObject /Subtype /Image /Width ${BAZION_LOGO_PDF_ASSET.width} /Height ${BAZION_LOGO_PDF_ASSET.height} /ColorSpace /${BAZION_LOGO_PDF_ASSET.colorSpace} /BitsPerComponent ${BAZION_LOGO_PDF_ASSET.bitsPerComponent} /Filter /${BAZION_LOGO_PDF_ASSET.filter} /Length ${logoStreamBuf.length} >>\nstream\n`,
          'ascii',
        ),
        logoStreamBuf,
        Buffer.from('\nendstream\nendobj\n', 'ascii'),
      ]),
    ];

    const headerBuf = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1');
    let offset = headerBuf.length;

    const xrefEntries: number[] = [0];
    for (const objBuf of objectBuffers) {
      xrefEntries.push(offset);
      offset += objBuf.length;
    }

    const startXref = offset;
    let xref = `xref\n0 ${objectBuffers.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < xrefEntries.length; i++) {
      xref += `${String(xrefEntries[i]).padStart(10, '0')} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${objectBuffers.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    return Buffer.concat([
      headerBuf,
      ...objectBuffers,
      Buffer.from(xref, 'ascii'),
      Buffer.from(trailer, 'ascii'),
    ]);
  }
}
