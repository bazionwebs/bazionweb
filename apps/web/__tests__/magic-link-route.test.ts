/**
 * @jest-environment node
 */

import { POST } from '../src/app/api/auth/magic-link/route';

describe('POST /api/auth/magic-link', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      API_INTERNAL_URL: 'http://api.internal:4000',
      NEXT_PUBLIC_SITE_URL: 'https://bazionweb.com',
    };
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.INTERNAL_DISPATCH_SECRET;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.JWT_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('short-circuits with 200 when bazionweb-api already dispatched and delivered the email', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            magicToken: '',
            expiresIn: 900,
            emailDispatched: true,
            delivered: true,
            provider: 'resend',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = new Request('https://bazionweb.com/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({
        email: 'bazion001@gmail.com',
        redirect: '/checkout?cart=1',
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      delivered: true,
      provider: 'resend',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'bazion001@gmail.com',
      redirect: '/checkout?cart=1',
    });
  });

  it('returns 503 EMAIL_NOT_CONFIGURED in production instead of a fake 200 when neither service can send mail', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            magicToken: '',
            expiresIn: 0,
            emailDispatched: false,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const req = new Request('https://bazionweb.com/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.11' },
      body: JSON.stringify({ email: 'bazion001@gmail.com' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      code: 'EMAIL_NOT_CONFIGURED',
      delivered: false,
    });
    errorSpy.mockRestore();
  });

  it('dispatches via web Resend mailer with sanitized redirect when API returns magicToken', async () => {
    process.env.INTERNAL_DISPATCH_SECRET = 'shared_dispatch_secret_123456';
    process.env.RESEND_API_KEY = 'test-resend-dummy-key-123456';

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              magicToken: 'tok_live_987654321',
              expiresIn: 900,
              emailDispatched: false,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email_resend_123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = new Request('https://bazionweb.com/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.12' },
      body: JSON.stringify({
        email: 'bazion001@gmail.com',
        redirect: '/checkout?plan=care-essential&cart=1',
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      delivered: true,
      provider: 'resend',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers['x-internal-dispatch']).toBe(
      'shared_dispatch_secret_123456',
    );
    const resendPayload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(resendPayload.to).toEqual(['bazion001@gmail.com']);
    expect(resendPayload.text).toContain(
      'https://bazionweb.com/portal/login/verify?token=tok_live_987654321&redirect=%2Fcheckout%3Fplan%3Dcare-essential%26cart%3D1',
    );
    expect(resendPayload.html).toContain(
      'https://bazionweb.com/portal/login/verify?token=tok_live_987654321&amp;redirect=%2Fcheckout%3Fplan%3Dcare-essential%26cart%3D1',
    );
  });
});
