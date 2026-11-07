import {
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
      {
        description: 'Value Added Tax (VAT 16%)',
        quantity: 1,
        amount: 10240,
      },
    ],
    breakdown: {
      subtotal: 64000,
      vatRate: 0.16,
      vatAmount: 10240,
      vatLabel: '16% KRA VAT (Inclusive)',
      total: 74240,
      amountPaid: 0,
      balanceDue: 74240,
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

  it('encodes ISO/IEC 15417 Code-128B security barcode bars accurately', () => {
    const encoded = encodeCode128Bars('INV-MAN-40770343-3099D6-3AEBCD');
    expect(encoded.encodedText).toBe('INV-MAN-40770343-3099D6-3AEBCD');
    // Start (11) + 30 chars * 11 (330) + checksum (11) + Stop (13) = 365 modules
    expect(encoded.totalModules).toBe(11 + 30 * 11 + 11 + 13);
    expect(encoded.bars.length).toBeGreaterThan(90);
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

    // Code-128B Security Barcode present, no QR code
    expect(latin1).toContain('SECURITY BARCODE \\(CODE-128B\\):');
    expect(latin1.toUpperCase()).not.toContain('QR CODE');

    // Sanitized em-dash in line item description
    expect(latin1).toContain('Host Business Container - 1 Year \\(12 Months\\) \\(25% off\\)');

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
