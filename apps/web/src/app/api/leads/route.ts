import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    // Persist to Database Single Source of Truth
    try {
      // Find or verify DB market and price book
      const dbMarket = await prisma.market.findUnique({
        where: { code: resolution.code },
      });

      if (dbMarket) {
        const dbPriceBook = await prisma.priceBook.findFirst({
          where: { marketId: dbMarket.id, status: 'active' },
          orderBy: { effectiveFrom: 'desc' },
        });

        if (dbPriceBook) {
          const dbLead = await prisma.lead.create({
            data: {
              name: name.trim(),
              email: email.trim().toLowerCase(),
              company: company?.trim() || null,
              phone: phone?.trim() || null,
              country: country.trim().toUpperCase(),
              marketId: dbMarket.id,
              currency: resolution.currency,
              priceBookId: dbPriceBook.id,
              serviceInterest: serviceInterest || 'Website Development',
              source,
              notes: notes
                ? `${notes}${estimatedBudget ? ` | Budget: ${estimatedBudget}` : ''}`
                : estimatedBudget
                  ? `Estimated Budget: ${estimatedBudget}`
                  : null,
            },
          });
          leadId = dbLead.id;
        }
      }
    } catch (dbErr: any) {
      console.warn('Database lead persistence notice (fallback ID used):', dbErr.message);
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
 * PROTECTED: Requires valid Authorization header to prevent PII leakage.
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

  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        market: { select: { code: true, name: true } },
      },
    });

    return NextResponse.json({
      totalLeads: leads.length,
      leads,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve leads from database' }, { status: 500 });
  }
}
