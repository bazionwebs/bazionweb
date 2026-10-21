import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DEV ONLY — Live payment smoke-test endpoint.
 * Initializes a real KES 100 charge to verify end-to-end payment flow.
 * Auto-disabled in production (NODE_ENV=production).
 * Usage: GET /api/paystack/test-payment?email=you@example.com
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { error: 'Provide ?email=youraddress@example.com' },
      { status: 400 },
    );
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'PAYSTACK_SECRET_KEY not set' }, { status: 503 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
  });

  const data = await res.json();

  if (!data.status || !data.data?.authorization_url) {
    return NextResponse.json(
      { error: data.message || 'Paystack rejected the request', raw: data },
      { status: 400 },
    );
  }

  return Response.redirect(data.data.authorization_url, 302);
}
