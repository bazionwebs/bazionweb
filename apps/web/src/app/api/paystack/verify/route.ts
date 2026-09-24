import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Missing transaction reference' }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    // In demo mode or if key is placeholder
    if (!secretKey || secretKey.includes('replace_with_your')) {
      return NextResponse.json({
        success: true,
        status: 'success',
        isDemo: true,
        reference,
        amount: 25000,
        channel: 'mobile_money',
        message: 'Payment verified successfully (simulated environment).',
      });
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const data = await res.json();

    if (data.status && data.data.status === 'success') {
      return NextResponse.json({
        success: true,
        status: data.data.status,
        reference: data.data.reference,
        amount: data.data.amount / 100,
        currency: data.data.currency,
        channel: data.data.channel, // 'mobile_money' (M-Pesa) or 'card'
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
