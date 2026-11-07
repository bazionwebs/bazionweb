import {
  BAZION_CORPORATE_DETAILS,
  generateCode128BarcodeSvg,
  renderBrandLogoSvg,
  renderDocumentLetterheadHtml,
  renderPaymentInstructionsHtml,
  renderSecurityVerificationSectionHtml,
} from '../src/lib/document-branding';

describe('document-branding corporate SSOT', () => {
  it('uses official KRA PIN A006926734I and official BazionWeb logo asset', () => {
    expect(BAZION_CORPORATE_DETAILS.taxPin).toBe('A006926734I');
    expect(BAZION_CORPORATE_DETAILS.logoPath).toBe('/brand/logo-with-background.png');

    const logoHtml = renderBrandLogoSvg(72);
    expect(logoHtml).toContain('/brand/logo-with-background.png');

    const letterhead = renderDocumentLetterheadHtml({
      docType: 'OFFICIAL INVOICE',
      docNumber: 'INV-MAN-40770343-3099D6',
    });
    expect(letterhead).toContain('A006926734I');
    expect(letterhead).not.toContain('P052198745M');
    expect(letterhead).toContain('/brand/logo-with-background.png');
  });

  it('renders official Lipa Na M-Pesa Paybill and Co-operative Bank payment channels', () => {
    const paymentHtml = renderPaymentInstructionsHtml({
      docNumber: 'INV-MAN-40770343-3099D6',
    });
    expect(paymentHtml).toContain('400200');
    expect(paymentHtml).toContain('1205232');
    expect(paymentHtml).toContain('Co-operative Bank of Kenya');
    expect(paymentHtml).toContain('Dandora Branch');
    expect(paymentHtml).toContain('01103361465001');
    expect(paymentHtml).toContain('KCOOKENA');
  });

  it('renders a high-contrast ISO/IEC 15417 Code-128 Auto B/C security barcode without QR code in verification block', () => {
    expect(BAZION_CORPORATE_DETAILS.registryUrl).toBe('https://bazionweb.com/verify');

    const barcodeSvg = generateCode128BarcodeSvg('INV-MAN-40770343-3099D6');
    expect(barcodeSvg).toContain('<svg');
    expect(barcodeSvg).toContain('fill="#000000"');
    expect(barcodeSvg).toContain('INV-MAN-40770343-3099D6');

    const securityHtml = renderSecurityVerificationSectionHtml({
      docNumber: 'INV-MAN-40770343-3099D6',
      docType: 'OFFICIAL INVOICE',
      totalAmount: 74240,
      currency: 'KES',
      recipientEmail: 'globalmissionfc@gmail.com',
      issueDate: '2026-11-07T08:50:00.000Z',
    });
    expect(securityHtml).toContain('Security Barcode (Code-128B)');
    expect(securityHtml).toContain('https://bazionweb.com/verify?ref=INV-MAN-40770343-3099D6');
    expect(securityHtml).toContain('A006926734I');
    expect(securityHtml).not.toContain('Scan via smartphone camera');
  });
});

