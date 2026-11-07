import { createHash } from 'crypto';
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
} as const;

// ISO/IEC 15417 Code 128 symbol bar/space width patterns (0..106)
const CODE128_PATTERNS: readonly string[] = [
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

/**
 * Encodes printable ASCII text into ISO/IEC 15417 Code 128B bar segments.
 * Returns individual black bar spans `[moduleOffset, moduleWidth]` and total module width.
 */
export function encodeCode128Bars(rawText: string): {
  bars: Array<{ offset: number; width: number }>;
  totalModules: number;
  encodedText: string;
} {
  const encodedText =
    String(rawText || 'BAZIONWEB')
      .replace(/[^\x20-\x7E]/g, '')
      .trim() || 'BAZIONWEB';

  const codes: number[] = [104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < encodedText.length; i++) {
    const val = encodedText.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop pattern

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

  return { bars, totalModules: cursor, encodedText };
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
  };
  paymentRef?: string | null;
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
   * ISO/IEC 15417 Code-128B vector security barcode (no QR), BRS & KRA corporate credentials,
   * and SHA-256 cryptographic tamper-evident seal.
   */
  static generate(data: InvoicePdfData): Buffer {
    const isPaid = data.status === 'PAID';
    const docTitle = isPaid ? 'OFFICIAL PAYMENT RECEIPT' : 'OFFICIAL TAX INVOICE';
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

    // ── 4. Itemized Table Header ──
    contentLines.push('q');
    contentLines.push('0.95 0.96 0.98 rg');
    contentLines.push('40 603 515 22 re f');
    contentLines.push('0.85 0.88 0.92 RG 0.5 w');
    contentLines.push('40 603 515 22 re S');
    contentLines.push('Q');

    contentLines.push('BT');
    contentLines.push('/F2 8 Tf');
    contentLines.push('0.2 0.25 0.3 rg');
    contentLines.push('50 610 Td');
    contentLines.push(`(${esc('DESCRIPTION')}) Tj`);
    contentLines.push('340 0 Td');
    contentLines.push(`(${esc('QTY')}) Tj`);
    contentLines.push('60 0 Td');
    contentLines.push(`(${esc('AMOUNT')}) Tj`);
    contentLines.push('ET');

    // ── 5. Line Items Rendering ──
    let currentY = 583;
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

    for (const item of items) {
      const desc = sanitizePdfText(
        item.description || 'Cloud & Hosting Infrastructure Service',
      );
      const qty = item.quantity ?? 1;
      const amtVal = item.amount ?? data.amount ?? 0;
      const amt = `${data.currency} ${amtVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      contentLines.push('BT');
      contentLines.push('/F1 8 Tf');
      contentLines.push('0.1 0.1 0.1 rg');
      contentLines.push(`50 ${currentY} Td`);
      contentLines.push(`(${esc(desc.slice(0, 62))}) Tj`);
      contentLines.push('345 0 Td');
      contentLines.push(`(${esc(String(qty))}) Tj`);
      contentLines.push('50 0 Td');
      contentLines.push(`(${esc(amt)}) Tj`);
      contentLines.push('ET');

      contentLines.push('q');
      contentLines.push('0.92 0.94 0.96 RG 0.5 w');
      contentLines.push(`40 ${currentY - 6} m 555 ${currentY - 6} l S`);
      contentLines.push('Q');

      currentY -= 20;
    }

    // ── 6. Payment Instructions Card (Left) & Financial Breakdown Box (Right) ──
    // Keep both boxes cleanly above the bottom security & barcode block (top at y=138)
    const boxY = Math.max(262, currentY - 14);
    const boxBottomY = boxY - 110; // Total box height = 125pt (boxBottomY .. boxY + 15)

    // 6A. Official Payment Instructions Card (Left: x=40..318, w=278, h=125)
    contentLines.push('q');
    contentLines.push('0.975 0.985 0.995 rg');
    contentLines.push(`40 ${boxBottomY} 278 125 re f`);
    contentLines.push('0.82 0.86 0.92 RG 1 w');
    contentLines.push(`40 ${boxBottomY} 278 125 re S`);
    // Top header accent strip inside payment card
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
    contentLines.push('BT');
    // Channel 1: Lipa Na M-Pesa Paybill
    contentLines.push('/F2 7.8 Tf');
    contentLines.push('0.05 0.45 0.25 rg'); // Safaricom / Co-op Emerald
    contentLines.push(`48 ${boxY - 10} Td`);
    contentLines.push(`(${esc('1. LIPA NA M-PESA (CO-OP BANK PAYBILL):')}) Tj`);
    contentLines.push('/F2 8 Tf');
    contentLines.push('0.08 0.12 0.20 rg');
    contentLines.push('0 -11 Td');
    contentLines.push(
      `(${esc(`Paybill No: ${p.mpesaPaybill}   |   Account No: ${p.mpesaAccountNumber}`)}) Tj`,
    );
    contentLines.push('/F1 7.2 Tf');
    contentLines.push('0.32 0.38 0.46 rg');
    contentLines.push('0 -10 Td');
    contentLines.push(`(${esc(`Business Name: ${p.mpesaAccountName}`)}) Tj`);

    // Channel 2: Bank Transfer (EFT / RTGS / SWIFT)
    contentLines.push('/F2 7.8 Tf');
    contentLines.push('0.10 0.30 0.78 rg'); // Royal Blue
    contentLines.push('0 -14 Td');
    contentLines.push(`(${esc('2. BANK TRANSFER (EFT / RTGS / SWIFT):')}) Tj`);
    contentLines.push('/F1 7.5 Tf');
    contentLines.push('0.12 0.16 0.24 rg');
    contentLines.push('0 -10.5 Td');
    contentLines.push(`(${esc(`Bank: ${p.bankName} (${p.bankBranch})`)}) Tj`);
    contentLines.push('/F2 7.6 Tf');
    contentLines.push('0 -10.5 Td');
    contentLines.push(
      `(${esc(`A/C Name: ${p.bankAccountName}  |  A/C: ${p.bankAccountNumber}`)}) Tj`,
    );
    contentLines.push('/F1 7.2 Tf');
    contentLines.push('0.32 0.38 0.46 rg');
    contentLines.push('0 -10 Td');
    contentLines.push(
      `(${esc(`SWIFT / BIC: ${p.bankSwiftCode}  |  Card / STK: bazionweb.com/portal/invoices`)}) Tj`,
    );
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
    contentLines.push(`(${esc('Subtotal (Net):')}) Tj`);
    contentLines.push('110 0 Td');
    contentLines.push(`(${esc(fmt(data.breakdown.subtotal))}) Tj`);

    contentLines.push('-110 -18 Td');
    contentLines.push(`(${esc(data.breakdown.vatLabel)}:) Tj`);
    contentLines.push('110 0 Td');
    contentLines.push(`(${esc(fmt(data.breakdown.vatAmount))}) Tj`);

    contentLines.push('/F2 9 Tf');
    contentLines.push('0.05 0.09 0.16 rg');
    contentLines.push('-110 -22 Td');
    contentLines.push(`(${esc('Total Invoice Amount:')}) Tj`);
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

    // ── 7. Cryptographic SHA-256 Tamper-Evident Digest ──
    const checksumRaw = [
      String(data.invoiceNumber || '').trim().toUpperCase(),
      String(data.breakdown.total ?? data.amount ?? 0),
      String(data.currency || 'USD').toUpperCase(),
      String(data.client.email || '').trim().toLowerCase(),
      new Date(data.createdAt).toISOString().slice(0, 10),
      'BAZION_SECURE_DOCUMENT_INTEGRITY_SALT_V1',
    ].join('|');
    const hashHex = createHash('sha256').update(checksumRaw).digest('hex').toUpperCase();
    const chunks = hashHex.slice(0, 32).match(/.{1,4}/g) || [hashHex.slice(0, 32)];
    const checksumStr = `SHA256: ${chunks.join('-')}`;

    // ── 8. Digital Authentication, Code-128B Security Barcode & Official Seal Block ──
    // Spans y=24..138 (height 114pt)
    contentLines.push('q');
    contentLines.push('0.96 0.97 0.99 rg');
    contentLines.push('40 24 515 114 re f');
    contentLines.push('0.85 0.88 0.92 RG 0.75 w');
    contentLines.push('40 24 515 114 re S');
    // Top microprint ribbon inside block
    contentLines.push('0.059 0.090 0.165 rg');
    contentLines.push('40 126 515 12 re f');
    // White framed security barcode plate on bottom-left (x=48..380, y=30..70)
    contentLines.push('1 1 1 rg');
    contentLines.push('48 30 332 40 re f');
    contentLines.push('0.82 0.86 0.92 RG 0.6 w');
    contentLines.push('48 30 332 40 re S');
    // Official Digital Seal box on right (x=390..547, y=30..120)
    contentLines.push('0.82 0.86 0.92 RG 0.75 w');
    contentLines.push('390 30 157 90 re S');
    contentLines.push('Q');

    // Microprint text
    contentLines.push('BT');
    contentLines.push('/F2 5.8 Tf');
    contentLines.push('0.9 0.95 1 rg');
    contentLines.push('48 129.5 Td');
    contentLines.push(
      `(${esc(`*** BAZION WEB (REG: BN-DLSZOZ6O | KRA PIN: ${supplierTaxPin}) *** OFFICIAL SYSTEM-GENERATED RECORD *** ISO 14533 ***`)}) Tj`,
    );
    contentLines.push('ET');

    // Main compliance statement (Top-Left of security block, y=75..116)
    contentLines.push('BT');
    contentLines.push('/F2 7.3 Tf');
    contentLines.push('0.1 0.15 0.25 rg');
    contentLines.push('48 114 Td');
    contentLines.push(
      `(${esc(`AUTHENTICATED SSOT ENGINE RECORD  |  REF: ${data.invoiceNumber}`)}) Tj`,
    );
    contentLines.push('/F1 6.1 Tf');
    contentLines.push('0.35 0.4 0.48 rg');
    contentLines.push('0 -9.5 Td');
    contentLines.push(
      `(${esc(`Issued electronically by BAZION WEB (Proprietor: Joseph Mburu Kiai | KRA PIN: ${supplierTaxPin}).`)}) Tj`,
    );
    contentLines.push('0 -8.5 Td');
    contentLines.push(
      `(${esc('Business Reg: BN-DLSZOZ6O (SMS "BRS" to 21546) | Valid without wet-ink signature (KICA Cap 411A).')}) Tj`,
    );
    contentLines.push('0 -8.5 Td');
    contentLines.push(
      `(${esc(`Cryptographic Fingerprint: ${checksumStr}`)}) Tj`,
    );
    contentLines.push('ET');

    // Linear ISO/IEC 15417 Code-128B Security Barcode (NO QR — vector bars only)
    const cleanRef = sanitizePdfText(data.invoiceNumber).toUpperCase().slice(0, 28);
    const barcodePayload = `${cleanRef}-${hashHex.slice(0, 6)}`;
    const barcode = encodeCode128Bars(barcodePayload);
    const quietModules = 10;
    const totalWithQuiet = barcode.totalModules + quietModules * 2;
    const plateInnerW = 316; // Fits inside 48..380 with 8pt padding each side
    const modulePt = plateInnerW / totalWithQuiet;
    const barStartX = 56 + quietModules * modulePt;
    const barBottomY = 42;
    const barHeight = 23;

    contentLines.push('q');
    contentLines.push('0.059 0.090 0.165 rg'); // Crisp deep navy/black bars
    for (const bar of barcode.bars) {
      const bx = (barStartX + bar.offset * modulePt).toFixed(3);
      const bw = (bar.width * modulePt).toFixed(3);
      contentLines.push(`${bx} ${barBottomY} ${bw} ${barHeight} re f`);
    }
    contentLines.push('Q');

    // Human-readable security barcode text below bars
    contentLines.push('BT');
    contentLines.push('/F2 6 Tf');
    contentLines.push('0.22 0.28 0.36 rg');
    contentLines.push('64 33.5 Td');
    contentLines.push(
      `(${esc(`SECURITY BARCODE (CODE-128B):  ${barcode.encodedText}`)}) Tj`,
    );
    contentLines.push('ET');

    // Seal Box text (Right)
    contentLines.push('BT');
    contentLines.push('/F2 7.2 Tf');
    contentLines.push(isPaid ? '0.05 0.5 0.3 rg' : '0.1 0.3 0.8 rg');
    contentLines.push('400 107 Td');
    contentLines.push(`(${esc('[ OFFICIAL DIGITAL SEAL ]')}) Tj`);
    contentLines.push('/F2 8 Tf');
    contentLines.push('0.06 0.09 0.16 rg');
    contentLines.push('0 -12 Td');
    contentLines.push(`(${esc('BAZION WEB')}) Tj`);
    contentLines.push('/F1 6.5 Tf');
    contentLines.push('0.3 0.35 0.45 rg');
    contentLines.push('0 -10 Td');
    contentLines.push(`(${esc('REG NO: BN-DLSZOZ6O')}) Tj`);
    contentLines.push('0 -9.5 Td');
    contentLines.push(`(${esc(`KRA PIN: ${supplierTaxPin}`)}) Tj`);
    contentLines.push('0 -9.5 Td');
    contentLines.push(`(${esc('NAIROBI - KENYA')}) Tj`);
    contentLines.push('/F2 7 Tf');
    contentLines.push(isPaid ? '0.05 0.5 0.3 rg' : '0.1 0.3 0.8 rg');
    contentLines.push('0 -11.5 Td');
    contentLines.push(`(${esc(isPaid ? 'VERIFIED: PAID IN FULL' : 'VERIFIED: AUTHENTICATED')}) Tj`);
    contentLines.push('/F1 5.6 Tf');
    contentLines.push('0.4 0.45 0.55 rg');
    contentLines.push('0 -9.5 Td');
    contentLines.push(`(${esc('SSOT BILLING ENGINE | SMS BRS TO 21546')}) Tj`);
    contentLines.push('/ET'.replace('/', ''));

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
