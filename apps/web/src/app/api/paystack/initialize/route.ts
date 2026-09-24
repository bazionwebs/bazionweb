import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, amount, planSlug, phone, currency = 'KES' } = body;

    if (!email || !amount) {
      return NextResponse.json(
        { error: 'Email and amount are required.' },
        { status: 400 },
      );
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // If in demo/test mode with placeholder key, simulate a successful initialization
    if (!secretKey || secretKey.includes('replace_with_your')) {
      const mockReference = `bzw_demo_${Date.now()}`;
      return NextResponse.json({
        success: true,
        isDemo: true,
        reference: mockReference,
        authorizationUrl: `${appUrl}/checkout/verify?reference=${mockReference}`,
        message: 'Demo mode active. Add real Paystack Secret Key to .env.local to activate live gateway.',
      });
    }

    // Paystack amounts are in subunits (multiply KES or USD by 100)
    const amountInSubunits = Math.round(Number(amount) * 100);

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInSubunits,
        currency,
        channels: ['card', 'mobile_money'], // Enables Safaricom M-Pesa & Cards
        callback_url: `${appUrl}/checkout/verify`,
        metadata: {
          planSlug,
          phone,
          customer_type: 'managed_client',
        },
      }),
    });

    const data = await paystackRes.json();

    if (!data.status) {
      return NextResponse.json(
        { error: data.message || 'Payment initialization rejected by Paystack.' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (error) {
    console.error('Paystack initialization error:', error);
    return NextResponse.json(
      { error: 'Internal error communicating with Paystack gateway.' },
      { status: 500 },
    );
  }
}
