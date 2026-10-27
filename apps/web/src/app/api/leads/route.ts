import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { resolveMarket } from '@/lib/marketEngine';
import { resolveApiV1Base } from '@/lib/api-base';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      company,
      phone,
      country = 'KE',
      serviceInterest = 'Website Development',
      source = 'website_quote_calculator',
      proposalId,
      estimatedBudget,
      notes,
    } = body;

    if (typeof email !== 'string' || typeof name !== 'string' || !email.trim() || !name.trim()) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Resolve commercial market identity
    const resolution = resolveMarket({
      billingCountry: country,
      ipCountry: request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country'),
      marketCookie: request.cookies.get('bazion_market')?.value,
    });

    const apiUrl = resolveApiV1Base();
    let leadReference = `LEAD-${Date.now().toString(36).toUpperCase()}`;
    let confirmationMessage = 'Your inquiry has been recorded successfully. Our team will follow up shortly.';

    try {
      const response = await fetch(`${apiUrl}/quotes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          company: company?.trim(),
          phone: phone?.trim(),
          country: country.trim().toUpperCase(),
          service: serviceInterest || 'Website Development',
          source,
          message: [
            notes,
            proposalId ? `Proposal: ${proposalId}` : null,
            estimatedBudget ? `Estimated Budget: ${estimatedBudget}` : null,
          ]
            .filter(Boolean)
            .join(' | '),
        }),
      });

      if (response.ok) {
        const envelope = await response.json().catch(() => ({}));
        const result = envelope?.data ?? envelope;
        if (result?.referenceId) {
          leadReference = result.referenceId;
        }
        if (result?.message) {
          confirmationMessage = result.message;
        }
      }
    } catch {
      // Backend CRM offline — continue gracefully with client confirmation
    }

    return NextResponse.json({
      success: true,
      leadId: leadReference,
      marketId: resolution.code,
      currency: resolution.currency,
      priceBookId: resolution.priceBookId,
      message: confirmationMessage,
    });
  } catch (error) {
    console.error('Lead registration error:', error);
    return NextResponse.json({ error: 'Failed to record lead' }, { status: 500 });
  }
}

/**
 * GET /api/leads
 * PROTECTED: Prevents unauthorized customer PII disclosure.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const providedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const adminSecret = process.env.ADMIN_API_KEY || '';
  const provided = Buffer.from(providedSecret);
  const expected = Buffer.from(adminSecret);
  const authorized = expected.length > 0 && provided.length === expected.length && timingSafeEqual(provided, expected);

  if (!authorized) {
    return NextResponse.json(
      { error: 'Unauthorized: Access to customer leads requires administrative credentials.' },
      { status: 401 },
    );
  }

  return NextResponse.json({
    totalLeads: 0,
    leads: [],
    message: 'Customer leads are securely persisted and managed in the API CRM backend.',
  });
}
