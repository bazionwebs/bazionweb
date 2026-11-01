import {
  generateContactNotificationEmailHtml,
  generateContactConfirmationEmailHtml,
  generateQuoteSummaryEmailHtml,
  sendContactInquiryEmail,
  sendQuoteSummaryEmail,
  sendMagicLinkEmail,
  sendClaimLinkEmail,
} from '@/lib/email';

describe('Email Service & Template Generators (apps/web/src/lib/email.ts)', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Template Generators', () => {
    it('generateContactNotificationEmailHtml renders lead details and escapes HTML entities', () => {
      const html = generateContactNotificationEmailHtml({
        clientName: '<script>alert("hack")</script>John Doe',
        clientEmail: 'john@example.com',
        company: 'Acme & Sons Ltd.',
        phone: '+254700000000',
        serviceInterest: 'E-Commerce Development',
        message: 'Looking for a custom store with M-Pesa integration <test>.',
        leadId: 'LEAD-XYZ-123',
        country: 'KE',
      });

      expect(html).toContain('John Doe');
      expect(html).not.toContain('<script>alert("hack")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;');
      expect(html).toContain('Acme &amp; Sons Ltd.');
      expect(html).toContain('LEAD-XYZ-123');
      expect(html).toContain('john@example.com');
      expect(html).toContain('E-Commerce Development');
      expect(html).toContain('+254700000000');
    });

    it('generateContactConfirmationEmailHtml renders confirmation message and reference ID', () => {
      const html = generateContactConfirmationEmailHtml({
        clientName: 'Jane Smith',
        clientEmail: 'jane@example.com',
        serviceInterest: 'Mobile-First Website Care',
        leadId: 'LEAD-CONF-456',
      });

      expect(html).toContain('Jane Smith');
      expect(html).toContain('Mobile-First Website Care');
      expect(html).toContain('LEAD-CONF-456');
      expect(html).toContain('+254 721 287 053');
      expect(html).toContain('bazionweb.com/faq');
      expect(html).not.toContain('help.bazionweb.com');
      expect(html).toContain('status.bazionweb.com');
    });

    it('generateQuoteSummaryEmailHtml renders proposal code, package name, and cost breakdown', () => {
      const html = generateQuoteSummaryEmailHtml({
        clientName: 'Alice Johnson',
        clientEmail: 'alice@example.com',
        proposalId: 'PROP-KE-2026-ABC',
        proposalCode: 'BZ-KE-2026-9999',
        packageName: 'Business Website Package',
        currency: 'KES',
        totalBuild: 90000,
        formattedTotalBuild: 'KSh 90,000',
        monthlyCare: 10000,
        formattedMonthlyCare: 'KSh 10,000',
        annualHosting: 8500,
        formattedAnnualHosting: 'KSh 8,500',
        totalYearOne: 218500,
        formattedTotalYearOne: 'KSh 218,500',
        proposalUrl: 'https://bazionweb.com/quote?proposal=BZ-KE-2026-9999',
      });

      expect(html).toContain('Alice Johnson');
      expect(html).toContain('BZ-KE-2026-9999');
      expect(html).toContain('PROP-KE-2026-ABC');
      expect(html).toContain('Business Website Package');
      expect(html).toContain('KSh 90,000');
      expect(html).toContain('KSh 10,000/month');
      expect(html).toContain('KSh 8,500/year');
      expect(html).toContain('KSh 218,500');
      expect(html).toContain('https://bazionweb.com/quote?proposal=BZ-KE-2026-9999');
    });
  });

  describe('Email Dispatching Functions', () => {
    it('sendContactInquiryEmail sends both team notification and client acknowledgment via Resend', async () => {
      process.env.RESEND_API_KEY = 're_test_dummy_key_123';
      process.env.LEADS_NOTIFICATION_EMAIL = 'leads-internal@bazionweb.com';
      process.env.SMTP_FROM = 'BazionWeb <noreply@bazionweb.com>';

      const mockFetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        const body = JSON.parse((init?.body as string) || '{}');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: `resend_id_${Math.random().toString(36).substring(7)}`, to: body.to }),
        });
      });
      global.fetch = mockFetch;

      const result = await sendContactInquiryEmail({
        clientName: 'David Kim',
        clientEmail: 'david@company.com',
        company: 'Kim Tech',
        serviceInterest: 'Custom Portal',
        message: 'Need a client portal with Keycloak SSO.',
        leadId: 'LEAD-DK-1',
      });

      expect(result.teamNotification.success).toBe(true);
      expect(result.teamNotification.delivered).toBe(true);
      expect(result.teamNotification.provider).toBe('resend');

      expect(result.clientConfirmation.success).toBe(true);
      expect(result.clientConfirmation.delivered).toBe(true);
      expect(result.clientConfirmation.provider).toBe('resend');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const teamCall = mockFetch.mock.calls.find((call) =>
        JSON.parse(call[1].body).to.includes('leads-internal@bazionweb.com')
      );
      const clientCall = mockFetch.mock.calls.find((call) =>
        JSON.parse(call[1].body).to.includes('david@company.com')
      );
      expect(teamCall).toBeDefined();
      expect(clientCall).toBeDefined();
    });

    it('sendQuoteSummaryEmail delivers itemized quote via Resend', async () => {
      process.env.RESEND_API_KEY = 're_test_dummy_key_123';
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'resend_quote_id_101' }),
      });
      global.fetch = mockFetch;

      const result = await sendQuoteSummaryEmail({
        clientName: 'Sarah Connor',
        clientEmail: 'sarah@skynet-defense.com',
        proposalId: 'PROP-INTL-1',
        proposalCode: 'BZ-INTL-2026-SC01',
        packageName: 'Enterprise Custom Systems',
        currency: 'USD',
        totalBuild: 15000,
        formattedTotalBuild: '$15,000',
        totalYearOne: 18600,
        formattedTotalYearOne: '$18,600',
      });

      expect(result.success).toBe(true);
      expect(result.delivered).toBe(true);
      expect(result.provider).toBe('resend');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.to).toContain('sarah@skynet-defense.com');
      expect(callBody.subject).toContain('BZ-INTL-2026-SC01');
      expect(callBody.html).toContain('Enterprise Custom Systems');
    });

    it('falls back to local development preview URL when no live credentials are set', async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const result = await sendQuoteSummaryEmail({
        clientName: 'Local Dev User',
        clientEmail: 'dev@localhost',
        proposalId: 'PROP-DEV-1',
        proposalCode: 'BZ-DEV-2026-0001',
        packageName: 'Launch Website',
        currency: 'KES',
        totalBuild: 25000,
        formattedTotalBuild: 'KSh 25,000',
      });

      expect(result.success).toBe(true);
      expect(result.delivered).toBe(false);
      expect(result.provider).toBe('local-development');
      expect(result.previewUrl).toContain('BZ-DEV-2026-0001');
    });

    it('retries with onboarding@resend.dev when custom sender is unverified (HTTP 403)', async () => {
      process.env.RESEND_API_KEY = 're_test_dummy_key_123';
      process.env.SMTP_FROM = 'BazionWeb <noreply@bazionweb.com>';

      let callCount = 0;
      const mockFetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        callCount++;
        const body = JSON.parse((init?.body as string) || '{}');
        if (callCount === 1) {
          // First attempt with custom domain fails with 403
          return Promise.resolve({
            ok: false,
            status: 403,
            json: () => Promise.resolve({ message: 'Domain not verified' }),
          });
        }
        // Second attempt with onboarding@resend.dev succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'resend_retry_id_200' }),
        });
      });
      global.fetch = mockFetch;

      const result = await sendMagicLinkEmail({
        to: 'user@example.com',
        magicLinkUrl: 'https://bazionweb.com/auth/verify?token=xyz',
      });

      expect(result.success).toBe(true);
      expect(result.delivered).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(firstCallBody.from).toBe('BazionWeb <noreply@bazionweb.com>');
      expect(secondCallBody.from).toBe('BazionWeb <onboarding@resend.dev>');
    });
  });
});
