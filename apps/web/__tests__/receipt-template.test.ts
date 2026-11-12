import { generateReceiptHtml } from '../src/app/api/paystack/verify/receipt-template';

describe('BazionWeb payment receipt document', () => {
  it('uses the branded print layout without leaking a full customer email or loading remote fonts', () => {
    const html = generateReceiptHtml({
      reference: 'PAY-TEST-2026-123',
      invoiceNumber: 'INV-2026-0042',
      status: 'success',
      amount: 12500,
      currency: 'KES',
      channel: 'mobile_money',
      paidAt: '2026-11-12T10:00:00.000Z',
      customer: { email: 'billing.customer@example.org' },
    });

    expect(html).toContain('Payment confirmed');
    expect(html).toContain('BazionWeb Invoice: INV-2026-0042');
    expect(html).toContain('https://bazionweb.com/verify?ref=INV-2026-0042');
    expect(html).not.toContain('https://bazionweb.com/verify?ref=REC-PAY-TEST-2026-123');
    expect(html).toContain('table-header-group');
    expect(html).toContain('page-break-inside: avoid');
    expect(html).toContain('bi***@example.org');
    expect(html).not.toContain('billing.customer@example.org');
    expect(html).not.toContain('https://bazionweb.com/brand/');
    expect(html).toContain('@page');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('SHA256');
    expect(html).not.toContain('256-bit SSL');
    expect(html).toContain('BazionWeb document verification');
  });
});
