import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Paystack webhook — HMAC-verified receiver for charge events.
 * Primary activation hookpoint for card & mobile-money payments.
 *
 * Events handled:
 *   charge.success → activate subscription (log now; persist to DB when API ready)
 *   charge.failed  → log for alerting / retry logic
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
    const tx = event.data || {};

    if (event.event === 'charge.success') {
      const activationPayload = {
        reference: tx.reference,
        amount: (tx.amount || 0) / 100,
        currency: tx.currency,
        channel: tx.channel,                        // 'card' | 'mobile_money'
        customerEmail: tx.customer?.email,
        planSlug: tx.metadata?.planSlug || 'unknown',
        source: tx.metadata?.source || 'unknown',
        paidAt: tx.paid_at,
      };

      console.log('[Paystack] ✅ charge.success — activating subscription:', activationPayload);

      // TODO: POST to internal API to activate subscription in DB:
      // await fetch(`${process.env.INTERNAL_API_URL}/subscriptions/activate`, {
      //   method: 'POST',
      //   headers: { 'x-webhook-secret': process.env.WEBHOOK_INTERNAL_SECRET! },
      //   body: JSON.stringify(activationPayload),
      // });
    }

    if (event.event === 'charge.failed') {
      console.warn('[Paystack] ❌ charge.failed:', {
        reference: tx.reference,
        customerEmail: tx.customer?.email,
        gatewayResponse: tx.gateway_response,
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
