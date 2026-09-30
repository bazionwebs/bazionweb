import { NextRequest, NextResponse } from 'next/server';
import { resolveMarket } from '@/lib/marketEngine';

export interface CommercialLead {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  country: string;
  marketId: string; // 'KE' | 'GLOBAL'
  currency: string; // 'KES' | 'USD'
  priceBookId: string; // 'KE-2026-v1' | 'GLOBAL-2026-v1'
  source: string;
  serviceInterest: string;
  proposalId?: string;
  estimatedBudget?: number;
  notes?: string;
  createdAt: string;
}

// In-memory persistent queue for active dev runtime, easily connectable to DB
const leadStore: CommercialLead[] = [];

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

    // Resolve commercial identity via confirmed country
    const resolution = resolveMarket({
      billingCountry: country,
      ipCountry: request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country'),
      marketCookie: request.cookies.get('bazion_market')?.value,
    });

    const lead: CommercialLead = {
      id: `LEAD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || undefined,
      phone: phone?.trim() || undefined,
      country: country.trim().toUpperCase(),
      marketId: resolution.code,
      currency: resolution.currency,
      priceBookId: resolution.priceBookId,
      source,
      serviceInterest,
      proposalId,
      estimatedBudget: Number(estimatedBudget) || undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    leadStore.unshift(lead);

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      marketId: lead.marketId,
      currency: lead.currency,
      priceBookId: lead.priceBookId,
      message: 'Commercial lead registered successfully',
    });
  } catch (error) {
    console.error('Lead registration error:', error);
    return NextResponse.json({ error: 'Failed to record lead' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    totalLeads: leadStore.length,
    leads: leadStore.slice(0, 50),
  });
}
