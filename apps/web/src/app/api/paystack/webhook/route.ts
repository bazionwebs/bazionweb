import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Fail-closed Paystack webhook (cards). Primary receiver is the API
 * POST /api/v1/webhooks/paystack. This Next route only logs if used.
 */
export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secretKey =
      process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || '';

    if (!secretKey) {
      return NextResponse.json({ error: 'Payments misconfigured' }, { status: 503 });
    }

    const hash = crypto.createHmac('sha512', secretKey).update(bodyText).digest('hex');
    const a = Buffer.from(signature || '', 'utf8');
    const b = Buffer.from(hash, 'utf8');
    if (!signature || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const event = JSON.parse(bodyText);
    if (event.event === 'charge.success') {
      console.log('[Paystack Webhook] Charge Success:', {
        reference: event.data?.reference,
        amount: (event.data?.amount || 0) / 100,
        currency: event.data?.currency,
        channel: event.data?.channel,
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
