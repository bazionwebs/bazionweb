import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface InitializePayload {
  email: string;
  amount: number;
  currency?: 'KES' | 'USD';
  planSlug?: string;
  phone?: string;
  channels?: string[];
  callbackUrl?: string;
}

export async function POST(req: Request) {
  try {
    const body: InitializePayload = await req.json();
    const { email, amount, currency = 'KES', planSlug, phone, channels, callbackUrl } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Paystack is not configured on server' }, { status: 503 });
    }

    // Paystack expects amount in lowest currency unit (cents / kobo: multiply by 100)
    const amountInSubunits = Math.round(numericAmount * 100);

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const finalCallbackUrl = callbackUrl || `${origin}/checkout/verify`;

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInSubunits,
        currency: currency.toUpperCase() === 'USD' ? 'USD' : 'KES',
        channels: channels && channels.length > 0 ? channels : ['card', 'mobile_money'],
        callback_url: finalCallbackUrl,
        metadata: {
          planSlug: planSlug || 'custom',
          phone: phone || '',
          customer_type: 'managed_client',
          source: 'bazionweb_checkout',
        },
      }),
    });

    const data = await paystackRes.json();

    if (!data.status || !data.data?.authorization_url) {
      return NextResponse.json(
        { error: data.message || 'Payment initialization rejected by Paystack' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (error: unknown) {
    console.error('Paystack initialization error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal payment initialization error' },
      { status: 500 },
    );
  }
}
