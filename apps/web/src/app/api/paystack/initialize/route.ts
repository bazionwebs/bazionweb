import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DEPRECATED — cards are initialized via the API with server-side pricing:
 * POST {NEXT_PUBLIC_API_URL}/invoices/subscribe/paystack { planId, billingCycle, currency }
 * This route is fail-closed to prevent client-controlled `amount` tampering.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Gone: use API POST /invoices/subscribe/paystack with planId (server-side pricing).',
    },
    { status: 410 },
  );
}
