import { PrismaClient, PlanTier, BillingCycle, UserRole, ClientStatus } from '@prisma/client';
import { randomBytes, scrypt as _scrypt } from 'crypto';

function scryptAsync(
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    _scrypt(password, salt, keylen, opts, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}

/** Must stay in sync with hashPassword() in apps/api/src/modules/auth/auth.service.ts */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 })) as Buffer;
  return `scrypt$16384$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding BazionWeb database...');

  // ─── Plans ──────────────────────────────────────────────────────────────────
  // Fixed IDs so the web catalog, API pricebook and the DB agree without a DB
  // round-trip. Prices mirror the authoritative checkout catalog (USD + KES);
  // annual = 10× monthly for legacy service tiers, 9.6× for Care tiers (20% commitment discount).
  const plans = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Starter',
      tier: PlanTier.STARTER,
      priceMonthly: 29,
      priceMonthlyKes: 3800,
      priceAnnual: 290,
      priceAnnualKes: 38000,
      uptimeSla: '99.9%',
      p1ResponseMinutes: 60,
      p2ResponseMinutes: 240,
      p3ResponseMinutes: 1440,
      maxBackupRetention: 30,
      hasMaintenance: false,
      hasSecurityMgmt: false,
      hasPerformanceOpt: false,
      hasUnlimitedUpdates: false,
      hasDedicatedAM: false,
      hasCustomSla: false,
      maxServiceCredPct: 5,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Growth',
      tier: PlanTier.GROWTH,
      priceMonthly: 59,
      priceMonthlyKes: 7700,
      priceAnnual: 590,
      priceAnnualKes: 77000,
      uptimeSla: '99.95%',
      p1ResponseMinutes: 30,
      p2ResponseMinutes: 120,
      p3ResponseMinutes: 240,
      maxBackupRetention: 60,
      hasMaintenance: true,
      hasSecurityMgmt: true,
      hasPerformanceOpt: false,
      hasUnlimitedUpdates: false,
      hasDedicatedAM: false,
      hasCustomSla: false,
      maxServiceCredPct: 10,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Business',
      tier: PlanTier.BUSINESS,
      priceMonthly: 119,
      priceMonthlyKes: 15500,
      priceAnnual: 1190,
      priceAnnualKes: 155000,
      uptimeSla: '99.95%',
      p1ResponseMinutes: 15,
      p2ResponseMinutes: 60,
      p3ResponseMinutes: 240,
      maxBackupRetention: 90,
      hasMaintenance: true,
      hasSecurityMgmt: true,
      hasPerformanceOpt: true,
      hasUnlimitedUpdates: true,
      hasDedicatedAM: false,
      hasCustomSla: false,
      maxServiceCredPct: 15,
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Enterprise',
      tier: PlanTier.ENTERPRISE,
      priceMonthly: 299,
      priceMonthlyKes: 39000,
      priceAnnual: 2990,
      priceAnnualKes: 390000,
      uptimeSla: '99.99%',
      p1ResponseMinutes: 5,
      p2ResponseMinutes: 30,
      p3ResponseMinutes: 120,
      maxBackupRetention: 365,
      hasMaintenance: true,
      hasSecurityMgmt: true,
      hasPerformanceOpt: true,
      hasUnlimitedUpdates: true,
      hasDedicatedAM: true,
      hasCustomSla: true,
      maxServiceCredPct: 25,
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Care Essential',
      tier: PlanTier.STARTER,
      priceMonthly: 75,
      priceMonthlyKes: 5000,
      priceAnnual: 720,
      priceAnnualKes: 48000,
      uptimeSla: '99.9%',
      p1ResponseMinutes: 60,
      p2ResponseMinutes: 240,
      p3ResponseMinutes: 1440,
      maxBackupRetention: 30,
      hasMaintenance: true,
      hasSecurityMgmt: false,
      hasPerformanceOpt: false,
      hasUnlimitedUpdates: false,
      hasDedicatedAM: false,
      hasCustomSla: false,
      maxServiceCredPct: 5,
    },
    {
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Care Business',
      tier: PlanTier.BUSINESS,
      priceMonthly: 150,
      priceMonthlyKes: 10000,
      priceAnnual: 1440,
      priceAnnualKes: 96000,
      uptimeSla: '99.95%',
      p1ResponseMinutes: 30,
      p2ResponseMinutes: 120,
      p3ResponseMinutes: 240,
      maxBackupRetention: 60,
      hasMaintenance: true,
      hasSecurityMgmt: true,
      hasPerformanceOpt: true,
      hasUnlimitedUpdates: false,
      hasDedicatedAM: false,
      hasCustomSla: false,
      maxServiceCredPct: 10,
    },
    {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Care Professional',
      tier: PlanTier.ENTERPRISE,
      priceMonthly: 300,
      priceMonthlyKes: 20000,
      priceAnnual: 2880,
      priceAnnualKes: 192000,
      uptimeSla: '99.99%',
      p1ResponseMinutes: 15,
      p2ResponseMinutes: 60,
      p3ResponseMinutes: 120,
      maxBackupRetention: 90,
      hasMaintenance: true,
      hasSecurityMgmt: true,
      hasPerformanceOpt: true,
      hasUnlimitedUpdates: true,
      hasDedicatedAM: true,
      hasCustomSla: false,
      maxServiceCredPct: 15,
    },
    {
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Care Enterprise',
      tier: PlanTier.ENTERPRISE,
      priceMonthly: 400,
      priceMonthlyKes: 40000,
      priceAnnual: 3840,
      priceAnnualKes: 384000,
      uptimeSla: '99.99%',
      p1ResponseMinutes: 15,
      p2ResponseMinutes: 30,
      p3ResponseMinutes: 120,
      maxBackupRetention: 365,
      hasMaintenance: true,
      hasSecurityMgmt: true,
      hasPerformanceOpt: true,
      hasUnlimitedUpdates: true,
      hasDedicatedAM: true,
      hasCustomSla: true,
      maxServiceCredPct: 25,
    },
  ];

  for (const plan of plans) {
    // Seed by name: pre-seeded DBs keep their existing row id (FKs to clients/
    // subscriptions stay intact); fresh DBs get the documented fixed IDs.
    const existing = await prisma.plan.findUnique({ where: { name: plan.name } });
    if (existing) {
      const { id, ...rest } = plan;
      await prisma.plan.update({ where: { id: existing.id }, data: rest });
    } else {
      await prisma.plan.create({ data: plan });
    }
    console.log(`  ✓ Plan: ${plan.name} ($${plan.priceMonthly} / KES ${plan.priceMonthlyKes})`);
  }

  // ─── Currencies ─────────────────────────────────────────────────────────────
  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, exchangeRateToBase: 1.0, baseCurrency: true },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 0, exchangeRateToBase: 129.50, baseCurrency: false },
    { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, exchangeRateToBase: 0.92, baseCurrency: false },
    { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2, exchangeRateToBase: 0.79, baseCurrency: false },
  ];

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
    console.log(`  ✓ Currency: ${c.code} (${c.name})`);
  }

  // ─── Markets ────────────────────────────────────────────────────────────────
  const markets = [
    {
      code: 'KE',
      name: 'Kenya',
      currencyCode: 'KES',
      countryCodes: ['KE'],
      active: true,
      defaultLocale: 'en-KE',
      vatRate: 0.1600,
      taxIncludedInPrice: true,
      roundingRule: 'INTEGER',
    },
    {
      code: 'GLOBAL',
      name: 'International / Global',
      currencyCode: 'USD',
      countryCodes: [],
      active: true,
      defaultLocale: 'en-US',
      vatRate: 0.0000,
      taxIncludedInPrice: false,
      roundingRule: 'EXACT',
    },
    {
      code: 'EA',
      name: 'East Africa (Uganda, Tanzania, Rwanda)',
      currencyCode: 'USD',
      countryCodes: ['UG', 'TZ', 'RW', 'BI', 'SS'],
      active: false,
      defaultLocale: 'en-US',
      vatRate: 0.0000,
      taxIncludedInPrice: false,
      roundingRule: 'EXACT',
    },
  ];

  const seededMarkets: Record<string, any> = {};
  for (const m of markets) {
    seededMarkets[m.code] = await prisma.market.upsert({
      where: { code: m.code },
      update: m,
      create: m,
    });
    console.log(`  ✓ Market: ${m.code} (${m.name})`);
  }

  // ─── Tax Rules ──────────────────────────────────────────────────────────────
  const taxRules = [
    {
      marketId: seededMarkets['KE'].id,
      name: 'Kenya KRA Standard VAT (16%)',
      taxType: 'VAT',
      rate: 0.1600,
      isInclusive: true,
      countryCode: 'KE',
      active: true,
    },
    {
      marketId: seededMarkets['GLOBAL'].id,
      name: 'Exported Digital Services (Zero-Rated / Reverse Charge)',
      taxType: 'VAT',
      rate: 0.0000,
      isInclusive: false,
      active: true,
    },
  ];

  for (const tr of taxRules) {
    const existing = await prisma.taxRule.findFirst({
      where: { marketId: tr.marketId, name: tr.name },
    });
    if (existing) {
      await prisma.taxRule.update({ where: { id: existing.id }, data: tr });
    } else {
      await prisma.taxRule.create({ data: tr });
    }
    console.log(`  ✓ Tax Rule: ${tr.name}`);
  }

  // ─── Price Books ────────────────────────────────────────────────────────────
  const priceBooks = [
    {
      id: 'KE-2026-v1',
      marketId: seededMarkets['KE'].id,
      name: 'Kenya Commercial Price Book 2026 v1',
      version: '2026-v1',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      effectiveUntil: new Date('2026-12-31T23:59:59Z'),
      status: 'active',
    },
    {
      id: 'GLOBAL-2026-v1',
      marketId: seededMarkets['GLOBAL'].id,
      name: 'Global Commercial Price Book 2026 v1',
      version: '2026-v1',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      effectiveUntil: new Date('2026-12-31T23:59:59Z'),
      status: 'active',
    },
  ];

  for (const pb of priceBooks) {
    await prisma.priceBook.upsert({
      where: { id: pb.id },
      update: pb,
      create: pb,
    });
    console.log(`  ✓ Price Book: ${pb.id}`);
  }

  // ─── Prices (Authoritative Database SSOT) ──────────────────────────────────
  const priceCatalog = [
    // Kenya prices (KES)
    { priceBookId: 'KE-2026-v1', productId: 'website-existing', amount: 0, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'website-launch', amount: 25000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'website-business', amount: 90000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'website-professional', amount: 160000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'website-enterprise', amount: 320000, billingPeriod: 'starting' },
    { priceBookId: 'KE-2026-v1', productId: 'ecommerce-starter', amount: 90000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'ecommerce-business', amount: 175000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'ecommerce-enterprise', amount: 320000, billingPeriod: 'starting' },
    { priceBookId: 'KE-2026-v1', productId: 'service-admin-hub-starter', amount: 45000, billingPeriod: 'starting' },
    { priceBookId: 'KE-2026-v1', productId: 'service-admin-hub-corporate', amount: 85000, billingPeriod: 'starting' },
    { priceBookId: 'KE-2026-v1', productId: 'custom-tier-1', amount: 180000, billingPeriod: 'starting' },
    { priceBookId: 'KE-2026-v1', productId: 'custom-tier-2', amount: 350000, billingPeriod: 'starting' },
    { priceBookId: 'KE-2026-v1', productId: 'custom-tier-3', amount: 750000, billingPeriod: 'starting' },
    { priceBookId: 'KE-2026-v1', productId: 'rate-extra-page', amount: 2000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'rate-extra-landing-page', amount: 15000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'domain-existing', amount: 0, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'domain-co-ke', amount: 1500, billingPeriod: 'year' },
    { priceBookId: 'KE-2026-v1', productId: 'domain-com', amount: 2500, billingPeriod: 'year' },
    { priceBookId: 'KE-2026-v1', productId: 'domain-org', amount: 3500, billingPeriod: 'year' },
    { priceBookId: 'KE-2026-v1', productId: 'care-essential', amount: 5000, billingPeriod: 'month' },
    { priceBookId: 'KE-2026-v1', productId: 'care-business', amount: 10000, billingPeriod: 'month' },
    { priceBookId: 'KE-2026-v1', productId: 'care-professional', amount: 20000, billingPeriod: 'month' },
    { priceBookId: 'KE-2026-v1', productId: 'care-enterprise', amount: 40000, billingPeriod: 'month' },
    { priceBookId: 'KE-2026-v1', productId: 'host-essential', amount: 4500, billingPeriod: 'year' },
    { priceBookId: 'KE-2026-v1', productId: 'host-business', amount: 8500, billingPeriod: 'year' },
    { priceBookId: 'KE-2026-v1', productId: 'host-pro', amount: 15000, billingPeriod: 'year' },
    { priceBookId: 'KE-2026-v1', productId: 'host-professional', amount: 15000, billingPeriod: 'year' },
    { priceBookId: 'KE-2026-v1', productId: 'host-cloud', amount: 30000, billingPeriod: 'year' },
    { priceBookId: 'KE-2026-v1', productId: 'host-cloud-monthly', amount: 3200, billingPeriod: 'month' },
    { priceBookId: 'KE-2026-v1', productId: 'host-cloud-quarterly', amount: 9120, billingPeriod: 'quarter' },
    { priceBookId: 'KE-2026-v1', productId: 'host-cloud-semiannual', amount: 17280, billingPeriod: 'half-year' },
    { priceBookId: 'KE-2026-v1', productId: 'host-cloud-annual', amount: 30000, billingPeriod: 'year' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-blog-news', amount: 7500, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-advanced-form', amount: 5000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-booking', amount: 15000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-payment-gateway', amount: 10000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-mpesa', amount: 10000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-newsletter', amount: 5000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-seo-advanced', amount: 15000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-copywriting', amount: 10000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-migration', amount: 5000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-extra-revision', amount: 3000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-custom-api', amount: 15000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-multilingual', amount: 15000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-document-hub', amount: 6000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-admin-dashboard', amount: 25000, billingPeriod: 'one-time' },
    { priceBookId: 'KE-2026-v1', productId: 'addon-branded-sms', amount: 18500, billingPeriod: 'one-time' },

    // Global prices (USD) — Aggressive Market-Penetration Tier (40-60% below US/UK agency rates)
    { priceBookId: 'GLOBAL-2026-v1', productId: 'website-existing', amount: 0, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'website-launch', amount: 450, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'website-business', amount: 950, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'website-professional', amount: 1750, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'website-enterprise', amount: 3600, billingPeriod: 'starting' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'ecommerce-starter', amount: 890, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'ecommerce-business', amount: 1650, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'ecommerce-enterprise', amount: 3600, billingPeriod: 'starting' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'service-admin-hub-starter', amount: 490, billingPeriod: 'starting' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'service-admin-hub-corporate', amount: 890, billingPeriod: 'starting' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'custom-tier-1', amount: 2200, billingPeriod: 'starting' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'custom-tier-2', amount: 3900, billingPeriod: 'starting' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'custom-tier-3', amount: 8500, billingPeriod: 'starting' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'rate-extra-page', amount: 40, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'rate-extra-landing-page', amount: 149, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'domain-existing', amount: 0, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'domain-co-ke', amount: 15, billingPeriod: 'year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'domain-com', amount: 20, billingPeriod: 'year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'domain-org', amount: 28, billingPeriod: 'year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'care-essential', amount: 75, billingPeriod: 'month' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'care-business', amount: 150, billingPeriod: 'month' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'care-professional', amount: 300, billingPeriod: 'month' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'care-enterprise', amount: 400, billingPeriod: 'month' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'host-essential', amount: 49, billingPeriod: 'year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'host-business', amount: 99, billingPeriod: 'year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'host-pro', amount: 189, billingPeriod: 'year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'host-professional', amount: 189, billingPeriod: 'year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'host-cloud', amount: 300, billingPeriod: 'year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'host-cloud-monthly', amount: 32, billingPeriod: 'month' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'host-cloud-quarterly', amount: 91, billingPeriod: 'quarter' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'host-cloud-semiannual', amount: 172, billingPeriod: 'half-year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'host-cloud-annual', amount: 290, billingPeriod: 'year' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-blog-news', amount: 120, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-advanced-form', amount: 80, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-booking', amount: 220, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-payment-gateway', amount: 150, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-mpesa', amount: 150, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-newsletter', amount: 80, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-seo-advanced', amount: 220, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-copywriting', amount: 180, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-migration', amount: 80, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-extra-revision', amount: 50, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-custom-api', amount: 240, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-multilingual', amount: 240, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-document-hub', amount: 120, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-admin-dashboard', amount: 299, billingPeriod: 'one-time' },
    { priceBookId: 'GLOBAL-2026-v1', productId: 'addon-branded-sms', amount: 220, billingPeriod: 'one-time' },
  ];

  for (const p of priceCatalog) {
    await prisma.price.upsert({
      where: {
        priceBookId_productId: {
          priceBookId: p.priceBookId,
          productId: p.productId,
        },
      },
      update: p,
      create: p,
    });
  }
  console.log(`  ✓ Seeded ${priceCatalog.length} authoritative prices into database`);

  // ─── Market Adjustments / Coupons ──────────────────────────────────────────
  const adjustments = [
    {
      marketId: seededMarkets['KE'].id,
      name: 'Kenya SME Growth Incentive',
      adjustmentType: 'PERCENTAGE_DISCOUNT',
      value: 10, // 10%
      couponCode: 'SMEKE10',
      minSpend: 50000,
      active: true,
    },
    {
      marketId: seededMarkets['GLOBAL'].id,
      name: 'Global First-Project Launch Credit',
      adjustmentType: 'FIXED_DISCOUNT',
      value: 100, // $100 off
      couponCode: 'GLOBAL100',
      minSpend: 800,
      active: true,
    },
    {
      marketId: seededMarkets['GLOBAL'].id,
      name: 'Global Scale Partner Discount',
      adjustmentType: 'PERCENTAGE_DISCOUNT',
      value: 10, // 10% off
      couponCode: 'GLOBAL10',
      minSpend: 1500,
      active: true,
    },
  ];

  for (const adj of adjustments) {
    const existing = await prisma.marketAdjustment.findFirst({
      where: { marketId: adj.marketId, name: adj.name },
    });
    if (existing) {
      await prisma.marketAdjustment.update({ where: { id: existing.id }, data: adj });
    } else {
      await prisma.marketAdjustment.create({ data: adj });
    }
    console.log(`  ✓ Market Adjustment: ${adj.name}`);
  }

  // ─── Demo Admin User ─────────────────────────────────────────────────────────
  // Local password comes from ADMIN_PASSWORD env (never committed).
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    const adminPasswordHash = await hashPassword(adminPassword);
    await prisma.user.upsert({
      where: { email: 'admin@bazionweb.com' },
      update: { passwordHash: adminPasswordHash },
      create: {
        email: 'admin@bazionweb.com',
        role: UserRole.SUPER_ADMIN,
        firstName: 'BazionWeb',
        lastName: 'Admin',
        mfaEnabled: true,
        passwordHash: adminPasswordHash,
      },
    });
    console.log('  ✓ Admin user: admin@bazionweb.com');
  } else {
    console.log('  ! ADMIN_PASSWORD not set — skipping admin user seed');
  }

  console.log('✅ Seed complete.');
}

main()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
