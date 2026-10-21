import { NextResponse } from 'next/server';
import { resolveApiBase } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

/**
 * @deprecated — replaced by the billing domain endpoint
 *   POST {API}/api/v1/invoices/guest/subscribe/paystack
 *
 * This route priced payments in the frontend process and never created an
 * invoice, so the webhook could not activate anything — payments made here
 * were invisible to the database (money in, nothing provisioned). All card
 * checkout now flows through the API: server-priced, invoice-backed,
 * webhook-activated.
 *
 * Kept briefly as a 410 for any stale clients/bookmarks.
 */
const MIGRATION_TARGET = '/api/v1/invoices/guest/subscribe/paystack';

export async function POST() {
  const apiBaseUrl = resolveApiBase();

  return NextResponse.json(
    {
      error: 'This payment endpoint was retired.',
      code: 'ENDPOINT_MIGRATED',
      target: MIGRATION_TARGET,
      checkoutUrl: apiBaseUrl ? '/checkout' : undefined,
      hint: 'Checkout now runs server-side: POST an email, plan and billing cycle to the billing API; it returns a hosted Paystack URL.',
    },
    { status: 410 },
  );
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed', code: 'ENDPOINT_MIGRATED' }, { status: 405 });
}
