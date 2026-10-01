import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Fail-closed verify proxy — no demo amounts. Requires server secret. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Missing transaction reference' }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Payments misconfigured' }, { status: 503 });
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const data = await res.json();

    if (data.status && data.data.status === 'success') {
      return NextResponse.json({
        success: true,
        status: data.data.status,
        reference: data.data.reference,
        amount: data.data.amount / 100,
        currency: data.data.currency,
        channel: data.data.channel,
        paidAt: data.data.paid_at,
        customer: data.data.customer,
      });
    }

    return NextResponse.json(
      { success: false, message: data.message || 'Payment verification failed' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Paystack verification error:', error);
    return NextResponse.json({ error: 'Failed to verify transaction' }, { status: 500 });
  }
}
