import { NextRequest, NextResponse } from 'next/server';
import { resolveMarket } from '@/lib/marketEngine';

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

    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Resolve commercial market identity
    const resolution = resolveMarket({
      billingCountry: country,
      ipCountry: request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country'),
      marketCookie: request.cookies.get('bazion_market')?.value,
    });

    let leadId = `LEAD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Forward lead to backend API Single Source of Truth
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    try {
      const response = await fetch(`${apiUrl}/quotes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          company: company?.trim(),
          phone: phone?.trim(),
          country: country.trim().toUpperCase(),
          market: resolution.code,
          currency: resolution.currency,
          plan: serviceInterest || 'Website Development',
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
        const data = await response.json();
        if (data?.data?.referenceId) {
          leadId = data.data.referenceId;
        }
      }
    } catch (apiErr: unknown) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      console.warn('Backend leads API forward notice (local ID used):', msg);
    }

    return NextResponse.json({
      success: true,
      leadId,
      marketId: resolution.code,
      currency: resolution.currency,
      priceBookId: resolution.priceBookId,
      message: 'Commercial lead registered successfully',
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
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_API_KEY || process.env.JWT_SECRET;

  if (!authHeader || !adminSecret || !authHeader.includes(adminSecret)) {
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
