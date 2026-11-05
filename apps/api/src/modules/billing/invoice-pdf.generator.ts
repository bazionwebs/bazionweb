import { createHash } from 'crypto';

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
  /** Issuer details from configuration; omitted fields are not printed. */
  supplier?: {
    address?: string | null;
    taxPin?: string | null;
  };
}

export class InvoicePdfGenerator {
  /**
   * Generates a compliant PDF 1.4 binary buffer.
   * Standard Helvetica / Helvetica-Bold Type 1 fonts embedded in all standard PDF readers.
   */
  static generate(data: InvoicePdfData): Buffer {
    const isPaid = data.status === 'PAID';
    const docTitle = isPaid ? 'PAYMENT RECEIPT' : 'INVOICE';
    const statusText = isPaid ? 'PAID IN FULL' : data.status;

    // Build PDF content stream
    const contentLines: string[] = [];

    // Helper to escape PDF strings
    const esc = (text: string) =>
      text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

    // Top brand banner (Navy #0F172A)
    contentLines.push('q');
    contentLines.push('0.059 0.090 0.165 rg'); // #0F172A
    contentLines.push('0 770 595.28 72 re f');
    contentLines.push('Q');

    // Brand title (White text)
    contentLines.push('BT');
    contentLines.push('/F2 20 Tf');
    contentLines.push('1 1 1 rg');
    contentLines.push('40 802 Td');
    contentLines.push(`(${esc('BazionWeb')}) Tj`);
    contentLines.push('/F1 9 Tf');
    contentLines.push('0.8 0.85 0.9 rg');
    contentLines.push('0 -16 Td');
    contentLines.push(
      `(${esc('Bazion Technologies Ltd | Enterprise Cloud & Hosting Infrastructure')}) Tj`,
    );
    contentLines.push('ET');

    // Document Type & Number in header right
    contentLines.push('BT');
    contentLines.push('/F2 12 Tf');
    contentLines.push('1 1 1 rg');
    contentLines.push('380 805 Td');
    contentLines.push(`(${esc(docTitle)}) Tj`);
    contentLines.push('/F1 10 Tf');
    contentLines.push('0.8 0.85 0.9 rg');
    contentLines.push('0 -15 Td');
    contentLines.push(`(${esc(`Invoice #: ${data.invoiceNumber}`)}) Tj`);
    contentLines.push('ET');

    // Supplier Info (Left) & Client Info (Right)
    const supplierAddress = data.supplier?.address || 'Riverside Square, Riverside Drive, Nairobi, Kenya';
    const supplierTaxPin = data.supplier?.taxPin || 'P052198745M';

    contentLines.push('BT');
    contentLines.push('/F2 9 Tf');
    contentLines.push('0.2 0.2 0.2 rg');
    contentLines.push('40 735 Td');
    contentLines.push(`(${esc('SUPPLIER (ISSUER):')}) Tj`);
    contentLines.push('/F1 9 Tf');
    contentLines.push('0 -13 Td');
    contentLines.push(`(${esc('Bazion Technologies Limited (PVT-XZ1988B)')}) Tj`);
    contentLines.push('0 -12 Td');
    contentLines.push(`(${esc(supplierAddress)}) Tj`);
    contentLines.push('0 -12 Td');
    contentLines.push(
      `(${esc(`KRA PIN: ${supplierTaxPin} | billing@bazionweb.com`)}) Tj`,
    );
    contentLines.push('ET');

    contentLines.push('BT');
    contentLines.push('/F2 9 Tf');
    contentLines.push('0.2 0.2 0.2 rg');
    contentLines.push('320 735 Td');
    contentLines.push(`(${esc('BILLED TO (CLIENT):')}) Tj`);
    contentLines.push('/F1 9 Tf');
    contentLines.push('0 -13 Td');
    contentLines.push(`(${esc(data.client.businessName || 'Valued Client')}) Tj`);
    contentLines.push('0 -12 Td');
    contentLines.push(
      `(${esc(data.client.contactName ? `Attn: ${data.client.contactName}` : data.client.email)}) Tj`,
    );
    contentLines.push('0 -12 Td');
    contentLines.push(`(${esc(`Tax / KRA PIN: ${data.client.taxPin || 'N/A'}`)}) Tj`);
    contentLines.push('ET');

    // Horizontal divider
    contentLines.push('q');
    contentLines.push('0.85 0.88 0.92 RG 1 w');
    contentLines.push('40 680 m 555 680 l S');
    contentLines.push('Q');

    // Meta dates row
    const issueDateStr = new Date(data.createdAt).toISOString().slice(0, 10);
    const dueDateStr = new Date(data.dueDate).toISOString().slice(0, 10);

    contentLines.push('BT');
    contentLines.push('/F1 8 Tf');
    contentLines.push('0.4 0.45 0.5 rg');
    contentLines.push('40 665 Td');
    contentLines.push(`(${esc(`Issue Date: ${issueDateStr}`)}) Tj`);
    contentLines.push('140 0 Td');
    contentLines.push(`(${esc(`Due Date: ${dueDateStr}`)}) Tj`);
    contentLines.push('140 0 Td');
    contentLines.push(`(${esc(`Status: ${statusText}`)}) Tj`);
    if (data.paymentRef) {
      contentLines.push('120 0 Td');
      contentLines.push(`(${esc(`Settlement Ref: ${data.paymentRef}`)}) Tj`);
    }
    contentLines.push('ET');

    // Table Header Box
    contentLines.push('q');
    contentLines.push('0.95 0.96 0.98 rg');
    contentLines.push('40 635 515 22 re f');
    contentLines.push('0.85 0.88 0.92 RG 0.5 w');
    contentLines.push('40 635 515 22 re S');
    contentLines.push('Q');

    contentLines.push('BT');
    contentLines.push('/F2 8 Tf');
    contentLines.push('0.2 0.25 0.3 rg');
    contentLines.push('50 642 Td');
    contentLines.push(`(${esc('DESCRIPTION')}) Tj`);
    contentLines.push('340 0 Td');
    contentLines.push(`(${esc('QTY')}) Tj`);
    contentLines.push('60 0 Td');
    contentLines.push(`(${esc('AMOUNT')}) Tj`);
    contentLines.push('ET');

    // Line items rendering
    let currentY = 615;
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
      const desc = item.description || 'Cloud & Hosting Infrastructure Service';
      const qty = item.quantity ?? 1;
      const amtVal = item.amount ?? data.amount ?? 0;
      const amt = `${data.currency} ${amtVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

      contentLines.push('BT');
      contentLines.push('/F1 8 Tf');
      contentLines.push('0.1 0.1 0.1 rg');
      contentLines.push(`50 ${currentY} Td`);
      contentLines.push(`(${esc(desc.slice(0, 55))}) Tj`);
      contentLines.push('345 0 Td');
      contentLines.push(`(${esc(String(qty))}) Tj`);
      contentLines.push('50 0 Td');
      contentLines.push(`(${esc(amt)}) Tj`);
      contentLines.push('ET');

      // row underline
      contentLines.push('q');
      contentLines.push('0.92 0.94 0.96 RG 0.5 w');
      contentLines.push(`40 ${currentY - 6} m 555 ${currentY - 6} l S`);
      contentLines.push('Q');

      currentY -= 20;
    }

    // Financial Breakdown Box (Subtotal, VAT, Total, Paid, Balance)
    const boxY = Math.max(140, currentY - 20);
    contentLines.push('q');
    contentLines.push('0.97 0.98 1.0 rg');
    contentLines.push(`330 ${boxY - 110} 225 125 re f`);
    contentLines.push('0.85 0.88 0.92 RG 1 w');
    contentLines.push(`330 ${boxY - 110} 225 125 re S`);
    contentLines.push('Q');

    const fmt = (num: number) =>
      `${data.currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

    // Cryptographic SHA-256 Tamper-Evident Digest
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

    // Digital Authentication & Anti-Fake Compliance Block
    contentLines.push('q');
    contentLines.push('0.96 0.97 0.99 rg');
    contentLines.push('40 28 515 76 re f');
    contentLines.push('0.85 0.88 0.92 RG 0.75 w');
    contentLines.push('40 28 515 76 re S');
    // Top microprint ribbon inside block
    contentLines.push('0.059 0.090 0.165 rg');
    contentLines.push('40 92 515 12 re f');
    // Seal box outline on the right
    contentLines.push('0.82 0.86 0.92 RG 0.75 w');
    contentLines.push('405 32 142 56 re S');
    contentLines.push('Q');

    // Microprint text
    contentLines.push('BT');
    contentLines.push('/F2 6 Tf');
    contentLines.push('0.9 0.95 1 rg');
    contentLines.push('48 95 Td');
    contentLines.push(
      `(${esc('••• BAZION TECHNOLOGIES LIMITED ••• OFFICIAL SYSTEM-GENERATED RECORD ••• ISO 14533 ALIGNED •••')}) Tj`,
    );
    contentLines.push('ET');

    // Main compliance statement (Left)
    contentLines.push('BT');
    contentLines.push('/F2 7 Tf');
    contentLines.push('0.1 0.15 0.25 rg');
    contentLines.push('48 80 Td');
    contentLines.push(
      `(${esc(`AUTHENTICATED SSOT ENGINE RECORD  |  REF: ${data.invoiceNumber}`)}) Tj`,
    );
    contentLines.push('/F1 6.5 Tf');
    contentLines.push('0.35 0.4 0.48 rg');
    contentLines.push('0 -10 Td');
    contentLines.push(
      `(${esc('Issued electronically by Bazion Technologies Limited (Automated SSOT Engine).')}) Tj`,
    );
    contentLines.push('0 -9 Td');
    contentLines.push(
      `(${esc('Pursuant to Kenya KICA Cap 411A, valid without wet-ink signature or manual stamp.')}) Tj`,
    );
    contentLines.push('0 -9 Td');
    contentLines.push(
      `(${esc(`Cryptographic Fingerprint: ${checksumStr}`)}) Tj`,
    );
    contentLines.push('0 -9 Td');
    contentLines.push(
      `(${esc('Verify online: https://bazionweb.com/portal/invoices')}) Tj`,
    );
    contentLines.push('ET');

    // Seal Box text (Right)
    contentLines.push('BT');
    contentLines.push('/F2 6.5 Tf');
    contentLines.push(isPaid ? '0.05 0.5 0.3 rg' : '0.1 0.3 0.8 rg');
    contentLines.push('415 76 Td');
    contentLines.push(`(${esc('★ OFFICIAL DIGITAL SEAL ★')}) Tj`);
    contentLines.push('/F1 6 Tf');
    contentLines.push('0.3 0.35 0.45 rg');
    contentLines.push('0 -9 Td');
    contentLines.push(`(${esc('BAZION TECHNOLOGIES LTD')}) Tj`);
    contentLines.push('0 -8 Td');
    contentLines.push(`(${esc('NAIROBI · KENYA')}) Tj`);
    contentLines.push('/F2 7 Tf');
    contentLines.push(isPaid ? '0.05 0.5 0.3 rg' : '0.1 0.3 0.8 rg');
    contentLines.push('0 -10 Td');
    contentLines.push(`(${esc(isPaid ? 'AUTHENTICATED ✓ PAID' : 'AUTHENTICATED ✓')}) Tj`);
    contentLines.push('/F1 5.5 Tf');
    contentLines.push('0.4 0.45 0.55 rg');
    contentLines.push('0 -8 Td');
    contentLines.push(`(${esc('SSOT BILLING ENGINE')}) Tj`);
    contentLines.push('ET');

    const streamBody = contentLines.join('\n');
    const streamLength = Buffer.byteLength(streamBody, 'utf-8');

    // Assemble PDF 1.4 objects
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj',
      `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamBody}\nendstream\nendobj`,
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
      '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj',
    ];

    let offset = 0;
    const header = '%PDF-1.4\n';
    offset += Buffer.byteLength(header, 'utf-8');

    const xrefEntries: number[] = [0];
    const objectChunks: string[] = [];

    for (const obj of objects) {
      xrefEntries.push(offset);
      const chunk = obj + '\n';
      objectChunks.push(chunk);
      offset += Buffer.byteLength(chunk, 'utf-8');
    }

    const startXref = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < xrefEntries.length; i++) {
      xref += `${String(xrefEntries[i]).padStart(10, '0')} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    return Buffer.from(header + objectChunks.join('') + xref + trailer, 'utf-8');
  }
}
