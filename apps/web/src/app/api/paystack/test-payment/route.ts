import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * DEV ONLY — Live payment smoke-test endpoint.
 * Initializes a real KES 100 charge to verify end-to-end payment flow.
 *
 * Locked down:
 *   - POST only (a GET performing a charge is a link-prefetch hazard).
 *   - 404 in production, AND requires a shared secret header on top:
 *     `x-test-token: $PAYSTACK_TEST_TOKEN` — fail-closed when the env var
 *     is unset, so an omitted NODE_ENV never silently exposes real charges.
 *   - The raw gateway error payload is never echoed to the caller.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const clientIp = getClientIp(req);
  const rl = checkRateLimit(`paystack:test-payment:${clientIp}`, 5, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many smoke-test attempts.' }, { status: 429 });
  }

  const expectedToken = (process.env.PAYSTACK_TEST_TOKEN || '').trim();
  const providedToken = (req.headers.get('x-test-token') || '').trim();
  if (!expectedToken) {
    return NextResponse.json(
      { error: 'Smoke-test disabled. Set PAYSTACK_TEST_TOKEN to enable it.' },
      { status: 404 },
    );
  }
  const providedBuf = Buffer.from(providedToken);
  const expectedBuf = Buffer.from(expectedToken);
  const authorized =
    expectedBuf.length > 0 &&
    providedBuf.length === expectedBuf.length &&
    timingSafeEqual(providedBuf, expectedBuf);
  if (!authorized) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: { email?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // fallthrough — validated below
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const EMAIL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62})@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,62})\.[A-Za-z]{2,14}$/;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: 'Provide a JSON body like { "email": "you@example.com" }' },
      { status: 400 },
    );
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'PAYSTACK_SECRET_KEY not set' }, { status: 503 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  let data: { status?: boolean; message?: string; data?: { authorization_url?: string } };
  try {
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: 10000,
        currency: 'KES',
        channels: ['card', 'mobile_money'],
        callback_url: `${origin}/checkout/verify`,
        metadata: {
          planSlug: 'smoke-test',
          customer_type: 'test',
          source: 'bazionweb_live_test',
          test_amount: 'KES 100',
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    data = await res.json().catch(() => ({ status: false, message: 'Invalid response' }));
  } catch {
    return NextResponse.json({ error: 'Payment gateway unreachable.' }, { status: 502 });
  }

  const authorizationUrl = data?.data?.authorization_url;
  if (!data?.status || !authorizationUrl) {
    // Log the gateway message server-side only — never echo raw payloads.
    console.warn('[Paystack Test Payment] Rejected by gateway:', data?.message || 'unknown');
    return NextResponse.json({ error: 'Paystack rejected the smoke-test request.' }, { status: 400 });
  }

  return Response.redirect(authorizationUrl, 302);
}
