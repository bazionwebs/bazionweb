import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';

    // If real secret key configured, verify HMAC signature
    if (secretKey && !secretKey.includes('replace_with_your')) {
      const hash = crypto
        .createHmac('sha512', secretKey)
        .update(bodyText)
        .digest('hex');

      if (hash !== signature) {
        return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(bodyText);

    // Event handling
    switch (event.event) {
      case 'charge.success':
        // Log transaction, customer email, payment channel (M-Pesa or Card)
        console.log('[Paystack Webhook] Charge Success:', {
          reference: event.data?.reference,
          amount: (event.data?.amount || 0) / 100,
          currency: event.data?.currency,
          channel: event.data?.channel,
          email: event.data?.customer?.email,
        });
        break;

      case 'subscription.create':
        console.log('[Paystack Webhook] Subscription Created:', event.data?.subscription_code);
        break;

      case 'invoice.payment_failed':
        console.warn('[Paystack Webhook] Invoice Payment Failed:', event.data?.invoice_code);
        break;

      default:
        console.log('[Paystack Webhook] Unhandled event:', event.event);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
