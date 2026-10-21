'use server';

import { redirect } from 'next/navigation';

const KNOWN_PLANS = new Set([
  'starter', 'growth', 'business', 'enterprise',
  'care-essential', 'care-business', 'care-professional',
]);

/**
 * /portal/register is retired. The simulated signup created client sessions
 * that never existed server-side, and a real account requires a paid
 * subscription (pay-first: checkout → webhook activation → one-step claim).
 * This route now forwards to the real checkout with the selected plan.
 */
export default async function RegisterRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string }>;
}) {
  const params = (await searchParams) || {};
  const requested = (params.plan || '').toLowerCase();
  const plan = KNOWN_PLANS.has(requested) ? requested : 'growth';

  redirect(`/checkout?plan=${plan}`);
}
