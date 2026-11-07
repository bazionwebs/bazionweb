import {
  computeDocumentFingerprint,
  decodeCode128Bars,
  encodeCode128Bars,
  InvoicePdfGenerator,
  OFFICIAL_BAZION_KRA_PIN,
  OFFICIAL_BAZION_PAYMENT_DETAILS,
  resolveSupplierTaxPin,
  sanitizePdfText,
} from '../invoice-pdf.generator';

describe('InvoicePdfGenerator', () => {
  const sampleData = {
    invoiceNumber: 'INV-MAN-40770343-3099D6',
    currency: 'KES',
    amount: 74240,
    status: 'SENT',
    createdAt: '2026-11-07T08:50:00.000Z',
    dueDate: '2026-11-21T08:50:00.000Z',
    client: {
      businessName: 'Global Missions For Christ International',
      contactName: 'Global Mission',
      email: 'globalmissionfc@gmail.com',
      taxPin: null,
    },
    lineItems: [
      {
        description: 'Host Business Container — 1 Year (12 Months) (25% off)',
        quantity: 1,
        amount: 8500,
      },
    ],
    breakdown: {
      subtotal: 8500,
      vatRate: 0,
      vatAmount: 0,
      vatLabel: 'VAT Not Applicable',
      total: 8500,
      amountPaid: 0,
      balanceDue: 8500,
      vatRegistered: false,
    },
  };

  it('resolves official KRA PIN A006926734I and upgrades legacy placeholder PIN', () => {
    expect(OFFICIAL_BAZION_KRA_PIN).toBe('A006926734I');
    expect(resolveSupplierTaxPin(undefined)).toBe('A006926734I');
    expect(resolveSupplierTaxPin('')).toBe('A006926734I');
    expect(resolveSupplierTaxPin('P052198745M')).toBe('A006926734I');
    expect(resolveSupplierTaxPin('CHANGE_ME_PIN')).toBe('A006926734I');
  });

  it('sanitizes Unicode dashes and punctuation without UTF-8 mojibake', () => {
    expect(
      sanitizePdfText('Host Business Container — 1 Year (12 Months) • “Pro”'),
    ).toBe('Host Business Container - 1 Year (12 Months) | "Pro"');
  });

  it('encodes and round-trip decodes ISO/IEC 15417 Code-128 Auto B/C security barcode bars with Subset C digit compression', () => {
    const encoded = encodeCode128Bars('INV-MAN-40770343-3099D6');
    expect(encoded.encodedText).toBe('INV-MAN-40770343-3099D6');
    // Subset C compresses the 8-digit block 40770343 into 4 symbol pairs (+ switch symbols),
    // reducing total module width from 365 down to 266 modules for Grade-A optical scannability.
    expect(encoded.totalModules).toBe(266);
    expect(encoded.bars.length).toBeGreaterThan(60);

    // Round-trip optical bar-and-space decoder + Modulo-103 checksum verification
    const decoded = decodeCode128Bars(encoded.bars, encoded.totalModules);
    expect(decoded).toBe('INV-MAN-40770343-3099D6');

    // Pure numeric strings start directly in Subset C (Start C = 105)
    const numericEncoded = encodeCode128Bars('40770343');
    const numericDecoded = decodeCode128Bars(numericEncoded.bars, numericEncoded.totalModules);
    expect(numericDecoded).toBe('40770343');
    // Start C (11) + 4 digit pairs * 11 (44) + Checksum (11) + Stop (13) = 79 modules
    expect(numericEncoded.totalModules).toBe(79);
  });

  it('computes deterministic SHA-256 document fingerprint', () => {
    const fp = computeDocumentFingerprint({
      docNumber: sampleData.invoiceNumber,
      currency: sampleData.currency,
      totalAmount: sampleData.breakdown.total,
      recipientEmail: sampleData.client.email,
      issueDate: sampleData.createdAt,
    });
    expect(fp.hashHex).toMatch(/^[0-9A-F]{64}$/);
    expect(fp.formatted).toMatch(/^SHA256: ([0-9A-F]{4}-){7}[0-9A-F]{4}$/);
  });

  it('embeds the official BazionWeb raster logo XObject, KRA PIN, payment info, and Code-128B barcode', () => {
    const pdfBuf = InvoicePdfGenerator.generate({
      ...sampleData,
      supplier: { taxPin: 'P052198745M' },
    });

    const latin1 = pdfBuf.toString('latin1');
    expect(latin1.startsWith('%PDF-1.4\n')).toBe(true);
    expect(latin1).toContain('/Subtype /Image /Width 320 /Height 287 /ColorSpace /DeviceRGB');
    expect(latin1).toContain('/Im1 Do');

    // Official KRA PIN (no legacy placeholder)
    expect(latin1).toContain('A006926734I');
    expect(latin1).not.toContain('P052198745M');

    // Official Payment Instructions (Lipa Na M-Pesa Paybill + Co-operative Bank)
    expect(latin1).toContain(OFFICIAL_BAZION_PAYMENT_DETAILS.mpesaPaybill);
    expect(latin1).toContain(OFFICIAL_BAZION_PAYMENT_DETAILS.mpesaAccountNumber);
    expect(latin1).toContain(OFFICIAL_BAZION_PAYMENT_DETAILS.bankName);
    expect(latin1).toContain(OFFICIAL_BAZION_PAYMENT_DETAILS.bankBranch);
    expect(latin1).toContain(OFFICIAL_BAZION_PAYMENT_DETAILS.bankAccountNumber);
    expect(latin1).toContain(OFFICIAL_BAZION_PAYMENT_DETAILS.bankSwiftCode);

    // Code-128 Security Barcode present with pure black bars (0 0 0 rg), public /verify URL, no QR code
    expect(latin1).toContain('SECURITY BARCODE \\(CODE-128B\\): INV-MAN-40770343-3099D6');
    expect(latin1).toContain('Verify: bazionweb.com/verify?ref=INV-MAN-40770343-3099D6');
    expect(latin1).toContain('0 0 0 rg\n');
    expect(latin1.toUpperCase()).not.toContain('QR CODE');

    // Official Tax Invoice vs Official Invoice (VAT Act, 2013: only VAT-registered suppliers may issue Tax Invoices)
    expect(latin1).toContain('OFFICIAL INVOICE');
    expect(latin1).toContain('Supplier not registered for VAT');

    // Verify xref byte offset points directly to 7 0 obj (logo XObject)
    const xrefIdx = latin1.lastIndexOf('\nxref\n');
    expect(xrefIdx).toBeGreaterThan(0);
    const xrefBlock = latin1.slice(xrefIdx + 1);
    const lines = xrefBlock.split('\n');
    const obj7Entry = lines[9]; // 0=xref, 1=0 8, 2=obj0, 3=obj1 ... 9=obj7
    const obj7Offset = Number(obj7Entry.slice(0, 10));
    expect(pdfBuf.subarray(obj7Offset, obj7Offset + 8).toString('ascii')).toBe('7 0 obj\n');
  });
});
