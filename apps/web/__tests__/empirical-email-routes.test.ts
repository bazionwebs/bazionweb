/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import {
  generateContactNotificationEmailHtml,
  generateContactConfirmationEmailHtml,
  generateQuoteSummaryEmailHtml,
  sendContactInquiryEmail,
  sendQuoteSummaryEmail,
} from '@/lib/email';
import { POST as handleLeadsPost } from '@/app/api/leads/route';
import { POST as handleQuotePost } from '@/app/api/quote/route';

jest.mock('../src/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetMs: 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.99'),
}));

jest.mock('../src/lib/email', () => {
  const actual = jest.requireActual('../src/lib/email');
  return {
    ...actual,
    sendContactInquiryEmail: jest.fn(),
    sendQuoteSummaryEmail: jest.fn(),
  };
});

describe('Empirical Verification: Email & Route Handlers (Node Environment)', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Email Sanitization Edge Cases', () => {
    it('neutralizes malicious XSS in contact notification email', () => {
      const html = generateContactNotificationEmailHtml({
        clientName: '<script>alert("PWNED_NAME")</script>Evil Corp',
        clientEmail: 'attacker@evil.com"><script>alert("EMAIL")</script>',
        company: '"><img src=x onerror=alert("COMPANY")>',
        phone: '<svg/onload=alert("PHONE")>+254700000000',
        serviceInterest: '<iframe src="javascript:alert(1)"></iframe>Custom System',
        message: 'Normal text & "quotes" and \'single\' <script>alert("MSG")</script>',
        leadId: '<b onmouseover="alert(1)">LEAD-999</b>',
        country: '<script>alert("KE")</script>KE',
      });

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('</script>');
      expect(html).not.toContain('<img src=x onerror');
      expect(html).not.toContain('<svg/onload');
      expect(html).not.toContain('<iframe');

      expect(html).toContain('&lt;script&gt;alert(&quot;PWNED_NAME&quot;)&lt;/script&gt;');
      expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(&quot;COMPANY&quot;)&gt;');
      expect(html).toContain('&lt;svg/onload=alert(&quot;PHONE&quot;)&gt;');
      expect(html).toContain('&lt;iframe src=&quot;javascript:alert(1)&quot;&gt;&lt;/iframe&gt;');
      expect(html).toContain('&amp; &quot;quotes&quot; and &#39;single&#39;');
      expect(html).toContain('&lt;b onmouseover=&quot;alert(1)&quot;&gt;LEAD-999&lt;/b&gt;');
    });

    it('neutralizes malicious XSS in contact confirmation email', () => {
      const html = generateContactConfirmationEmailHtml({
        clientName: '<script>alert("CONF_NAME")</script>',
        clientEmail: 'user@example.com',
        serviceInterest: '<script>alert("CONF_SERVICE")</script>',
        leadId: '<b>REF-123</b>',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;CONF_NAME&quot;)&lt;/script&gt;');
      expect(html).toContain('&lt;script&gt;alert(&quot;CONF_SERVICE&quot;)&lt;/script&gt;');
      expect(html).toContain('&lt;b&gt;REF-123&lt;/b&gt;');
    });

    it('handles missing optional fields and empty strings gracefully', () => {
      const htmlNotification = generateContactNotificationEmailHtml({
        clientName: '',
        clientEmail: '',
      });

      expect(htmlNotification).not.toContain('undefined');
      expect(htmlNotification).toContain('Not specified');
      expect(htmlNotification).toContain('No additional project notes provided.');

      const htmlConfirmation = generateContactConfirmationEmailHtml({
        clientName: '',
        clientEmail: '',
      });

      expect(htmlConfirmation).not.toContain('undefined');
      expect(htmlConfirmation).toContain('your upcoming project');
      expect(htmlConfirmation).toContain('CONFIRMED');
    });

    it('neutralizes malicious XSS across quote summary breakdown', () => {
      const html = generateQuoteSummaryEmailHtml({
        clientName: '<script>alert("CLIENT")</script>',
        clientEmail: 'test@victim.com',
        clientCompany: '<script>alert("COMP")</script>',
        proposalId: '<script>alert("PID")</script>',
        proposalCode: '<img src=x onerror=alert("CODE")>',
        packageName: '<svg onload=alert("PKG")>',
        currency: 'USD',
        totalBuild: 5000,
        formattedTotalBuild: '$5,000 <script>alert("BUILD")</script>',
        monthlyCare: 500,
        formattedMonthlyCare: '$500 <script>alert("CARE")</script>',
        annualHosting: 300,
        formattedAnnualHosting: '$300 <script>alert("HOST")</script>',
        totalYearOne: 11300,
        formattedTotalYearOne: '$11,300 <script>alert("Y1")</script>',
        proposalUrl: 'https://bazionweb.com/quote?param="><script>alert("URL")</script>',
      });

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('</script>');
      expect(html).not.toContain('<img src=x onerror');
      expect(html).not.toContain('<svg onload');

      expect(html).toContain('&lt;script&gt;alert(&quot;CLIENT&quot;)&lt;/script&gt;');
      expect(html).toContain('&lt;img src=x onerror=alert(&quot;CODE&quot;)&gt;');
      expect(html).toContain('&lt;svg onload=alert(&quot;PKG&quot;)&gt;');
      expect(html).toContain('$5,000 &lt;script&gt;alert(&quot;BUILD&quot;)&lt;/script&gt;');
      expect(html).toContain('$500 &lt;script&gt;alert(&quot;CARE&quot;)&lt;/script&gt;');
      expect(html).toContain('$300 &lt;script&gt;alert(&quot;HOST&quot;)&lt;/script&gt;');
      expect(html).toContain('$11,300 &lt;script&gt;alert(&quot;Y1&quot;)&lt;/script&gt;');
    });
  });

  describe('Route Handlers Non-Fatal Error Resiliency', () => {
    it('/api/leads returns HTTP 200 with success: true when sendContactInquiryEmail throws an unhandled exception', async () => {
      (sendContactInquiryEmail as jest.Mock).mockRejectedValueOnce(
        new Error('FATAL_RESEND_NETWORK_TIMEOUT_SIMULATION')
      );

      const request = new NextRequest('http://localhost:3000/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.99',
        },
        body: JSON.stringify({
          name: 'Empirical Test User',
          email: 'empirical-lead@example.com',
          company: 'Resilience Testing Co',
          phone: '+254700123456',
          serviceInterest: 'Custom Web Application',
          notes: 'Testing email failure non-fatal behavior',
        }),
      });

      const response = await handleLeadsPost(request);

      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.leadId).toBeDefined();
      expect(json.marketId).toBeDefined();
      expect(json.message).toBeDefined();

      expect(sendContactInquiryEmail).toHaveBeenCalledTimes(1);
    });

    it('/api/quote returns HTTP 200 with success: true when sendQuoteSummaryEmail throws in local fallback path', async () => {
      (sendQuoteSummaryEmail as jest.Mock).mockRejectedValueOnce(
        new Error('FATAL_SMTP_SOCKET_DESTROYED_SIMULATION')
      );

      // Backend CRM unreachable
      global.fetch = jest.fn().mockRejectedValue(new Error('CRM backend offline'));

      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.98',
        },
        body: JSON.stringify({
          clientName: 'Quote Stress Tester',
          clientEmail: 'quote-resilience@example.com',
          clientCompany: 'Stress Harness LLC',
          billingCountry: 'KE',
          packageType: 'business',
          selectedAddOns: ['seo-starter'],
        }),
      });

      const response = await handleQuotePost(request);

      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.status).toBe('LOCKED');
      expect(json.proposalCode).toBeDefined();
      expect(json.totals).toBeDefined();
      expect(json.totals.totalBuild).toBeGreaterThan(0);

      expect(sendQuoteSummaryEmail).toHaveBeenCalledTimes(1);
    });

    it('/api/quote returns HTTP 200 with success: true when sendQuoteSummaryEmail throws in CRM response path', async () => {
      (sendQuoteSummaryEmail as jest.Mock).mockRejectedValueOnce(
        new Error('RESEND_API_503_SERVICE_UNAVAILABLE')
      );

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: {
              proposalId: 'CRM-PROP-999',
              proposalCode: 'BZ-CRM-999',
              marketCode: 'KE',
              currency: 'KES',
              currencySymbol: 'KSh',
              breakdown: {
                package: { productId: 'pkg-1', name: 'Business Website', amount: 90000 },
                totalBuildGross: 90000,
                hostingAnnual: { amount: 8500 },
                careMonthly: { amount: 10000 },
              },
            },
          }),
      });

      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.97',
        },
        body: JSON.stringify({
          clientName: 'CRM Path Tester',
          clientEmail: 'crm-tester@example.com',
          billingCountry: 'KE',
          packageType: 'business',
        }),
      });

      const response = await handleQuotePost(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.proposalCode).toBe('BZ-CRM-999');
      expect(sendQuoteSummaryEmail).toHaveBeenCalledTimes(1);
    });
  });
});
