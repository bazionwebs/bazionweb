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
  const plans = [
    {
      name: 'Starter',
      tier: PlanTier.STARTER,
      priceMonthly: 49,
      priceAnnual: 490,    // 2 months free
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
      name: 'Growth',
      tier: PlanTier.GROWTH,
      priceMonthly: 99,
      priceAnnual: 990,
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
      name: 'Business',
      tier: PlanTier.BUSINESS,
      priceMonthly: 199,
      priceAnnual: 1990,
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
      name: 'Enterprise',
      tier: PlanTier.ENTERPRISE,
      priceMonthly: 0, // Custom — negotiated
      priceAnnual: 0,
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
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`  ✓ Plan: ${plan.name}`);
  }

  // ─── Demo Admin User ─────────────────────────────────────────────────────────
  // Local password comes from ADMIN_PASSWORD env (never committed). Without it
  // the admin row is created but cannot log in until the password is seeded.
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPasswordHash = adminPassword ? await hashPassword(adminPassword) : undefined;
  if (!adminPassword) {
    console.log('  ! ADMIN_PASSWORD not set — admin created without a local password');
  }
  await prisma.user.upsert({
    where: { email: 'admin@bazionweb.com' },
    update: adminPasswordHash ? { passwordHash: adminPasswordHash } : {},
    create: {
      email: 'admin@bazionweb.com',
      role: UserRole.SUPER_ADMIN,
      firstName: 'BazionWeb',
      lastName: 'Admin',
      mfaEnabled: true,
      ...(adminPasswordHash ? { passwordHash: adminPasswordHash } : {}),
    },
  });
  console.log('  ✓ Admin user: admin@bazionweb.com');

  console.log('✅ Seed complete.');
}

main()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
