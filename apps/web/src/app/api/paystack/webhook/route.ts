import { NextResponse } from 'next/server';
import { resolveApiBase } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

/**
 * Paystack webhook — pass-through relay.
 *
 * The Next.js side does NOT activate subscriptions. It verifies the HMAC
 * signature (cheap defense — the API verifies independently) and forwards
 * the EXACT raw bytes plus the original signature header to the NestJS API
 * (`POST /api/v1/webhooks/paystack`), the single activation authority that
 * writes invoices, subscriptions and client access to the database.
 *
 * This keeps payment processing on one backend while Paystack still points
 * at the public Next.js domain.
 */
export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secretKey =
      process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || '';
    const apiBaseUrl = resolveApiBase();

    if (!secretKey) {
      return NextResponse.json({ error: 'Payments misconfigured' }, { status: 503 });
    }
    if (!apiBaseUrl) {
      return NextResponse.json({ error: 'Payments backend not configured' }, { status: 503 });
    }

    const crypto = await import('crypto');
    const hash = crypto.createHmac('sha512', secretKey).update(bodyText).digest('hex');
    const a = Buffer.from(signature || '', 'utf8');
    const b = Buffer.from(hash, 'utf8');
    if (!signature || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const upstream = await fetch(`${apiBaseUrl}/api/v1/webhooks/paystack`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-paystack-signature': signature,
      },
      body: bodyText,
      signal: AbortSignal.timeout(15000),
    });

    // Relay the API's decision verbatim (status + body).
    const payload = await upstream.json().catch(() => ({ relayed: true }));
    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    console.error('Paystack webhook relay error:', error);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
