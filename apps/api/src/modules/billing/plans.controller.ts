import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/guards/jwt-auth.guard';

const PLAN_ORDER = [
  'Care Essential',
  'Care Business',
  'Care Professional',
  'Care Enterprise',
  'Starter',
  'Growth',
  'Business',
  'Enterprise',
];

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return Number((value as { toNumber: () => number }).toNumber());
  }
  return Number(String(value));
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@ApiTags('billing')
@Controller({ path: 'plans', version: '1' })
export class PlansController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public, server-driven subscription catalog.
   *
   * This is the single source of truth for plan IDs and prices. The web
   * checkout/onboarding must render from this endpoint instead of shipping
   * hardcoded copies that can drift from the database pricebook.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'List active subscription plans with server prices' })
  async findAll() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });

    const data = plans
      .map(plan => {
        const priceMonthly = toNumber(plan.priceMonthly);
        const priceAnnual = toNumber(plan.priceAnnual);
        const monthlyYearly = priceMonthly * 12;
        return {
          id: plan.id,
          slug: slugify(plan.name),
          name: plan.name,
          tier: plan.tier,
          priceMonthly,
          priceAnnual,
          priceMonthlyKes:
            plan.priceMonthlyKes != null
              ? toNumber(plan.priceMonthlyKes)
              : Math.round(priceMonthly * 130),
          priceAnnualKes:
            plan.priceAnnualKes != null
              ? toNumber(plan.priceAnnualKes)
              : Math.round(priceAnnual * 130),
          currency: 'USD',
          annualDiscountPct:
            monthlyYearly > 0 && priceAnnual > 0
              ? Math.round((1 - priceAnnual / monthlyYearly) * 100)
              : 0,
          uptimeSla: plan.uptimeSla,
          p1ResponseMinutes: plan.p1ResponseMinutes,
          p2ResponseMinutes: plan.p2ResponseMinutes,
          p3ResponseMinutes: plan.p3ResponseMinutes,
        };
      })
      .sort((a, b) => {
        const ai = PLAN_ORDER.indexOf(a.name);
        const bi = PLAN_ORDER.indexOf(b.name);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

    return { data };
  }
}
