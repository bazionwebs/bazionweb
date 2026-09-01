import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitQuoteDto } from './dto/submit-quote.dto';
import { CalculateQuoteDto } from './dto/calculate-quote.dto';

// ─── Build pricing matrix (aligned with MPD Section 6 / Pricing) ─────────────
const PAGE_RATES = { simple: 150, standard: 250, complex: 450 };
const CMS_ADD_ON = 300;
const ECOMMERCE_ADD_ON = 800;
const MIGRATION_ADD_ON = 150;
const CUSTOM_DESIGN_ADD_ON = 400;

const PLAN_MONTHLY: Record<string, number> = {
  starter: 49,
  growth: 99,
  business: 199,
  enterprise: 0, // custom
};

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submit(dto: SubmitQuoteDto) {
    // Persist to DB for CRM follow-up
    this.logger.log(`Quote submission from ${dto.email} — plan: ${dto.plan ?? 'unspecified'}`);

    // TODO: emit event to trigger:
    // 1. CRM entry creation
    // 2. Auto-reply email to lead
    // 3. Slack notification to sales

    return {
      data: {
        submitted: true,
        message: 'Thank you! We\'ll be in touch within 24 hours.',
        referenceId: `QR-${Date.now().toString(36).toUpperCase()}`,
      },
    };
  }

  calculate(dto: CalculateQuoteDto) {
    // ── One-time build cost ────────────────────────────────────────────────────
    const pageBreakdown = dto.pages.reduce(
      (acc, p) => {
        const rate = PAGE_RATES[p.type] ?? PAGE_RATES.standard;
        return { ...acc, total: acc.total + rate, detail: [...acc.detail, { type: p.type, count: 1, rate }] };
      },
      { total: 0, detail: [] as any[] },
    );

    let buildCost = pageBreakdown.total;
    const addOns: { name: string; cost: number }[] = [];

    if (dto.hasCms) {
      buildCost += CMS_ADD_ON;
      addOns.push({ name: 'CMS Integration (Strapi)', cost: CMS_ADD_ON });
    }
    if (dto.hasEcommerce) {
      buildCost += ECOMMERCE_ADD_ON;
      addOns.push({ name: 'E-commerce (Stripe + Cart)', cost: ECOMMERCE_ADD_ON });
    }
    if (dto.needsMigration) {
      buildCost += MIGRATION_ADD_ON;
      addOns.push({ name: 'Site Migration', cost: MIGRATION_ADD_ON });
    }
    if (dto.customDesign) {
      buildCost += CUSTOM_DESIGN_ADD_ON;
      addOns.push({ name: 'Custom UI/UX Design (Figma)', cost: CUSTOM_DESIGN_ADD_ON });
    }

    // ── Monthly plan cost ─────────────────────────────────────────────────────
    const monthlyPlan = PLAN_MONTHLY[dto.tier] ?? PLAN_MONTHLY.starter;
    const annualSaving = monthlyPlan > 0 ? monthlyPlan * 2 : 0; // 2 months free

    // ── Year-1 total ──────────────────────────────────────────────────────────
    const year1Total = buildCost + monthlyPlan * 12;

    return {
      data: {
        buildCost,
        pageBreakdown: pageBreakdown.detail,
        addOns,
        monthly: monthlyPlan,
        annual: monthlyPlan * 10,  // 10 months price = 2 months free
        annualSaving,
        year1Total,
        currency: 'USD',
        note: dto.tier === 'enterprise'
          ? 'Enterprise pricing is custom. Contact us for a tailored quote.'
          : undefined,
      },
    };
  }
}
