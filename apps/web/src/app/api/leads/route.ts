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
    const response = await fetch(`${apiUrl}/quotes/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
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

    const envelope = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: 'We could not securely record your request. Please try again.' },
        { status: 502 },
      );
    }

    const result = envelope?.data ?? envelope;
    if (!result?.submitted || !result?.referenceId) {
      return NextResponse.json({ error: 'We could not confirm that your request was saved.' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      leadId: result.referenceId,
      marketId: resolution.code,
      currency: resolution.currency,
      priceBookId: resolution.priceBookId,
      message: result.message,
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
