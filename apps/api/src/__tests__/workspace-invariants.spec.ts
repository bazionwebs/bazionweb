import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../../..');

describe('Bazionweb workspace & delivery invariants (Phase 0)', () => {
  it('enforces a single root workspace lockfile and strict npm ci without fallback installs in CI/Docker', () => {
    expect(existsSync(join(repoRoot, 'package-lock.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'apps', 'api', 'package-lock.json'))).toBe(false);
    expect(existsSync(join(repoRoot, 'apps', 'web', 'package-lock.json'))).toBe(false);

    const targets = [
      join(repoRoot, '.github', 'workflows', 'ci-cd.yml'),
      join(repoRoot, 'apps', 'api', 'Dockerfile'),
      join(repoRoot, 'apps', 'web', 'Dockerfile'),
    ];
    for (const file of targets) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/\|\|\s*npm\s+install|else\s+npm\s+install/);
      expect(content).toMatch(/\bnpm\s+ci\b/);
    }
  });

  it('keeps root prisma/schema.prisma and migrations synced with apps/api/prisma', () => {
    const rootSchema = readFileSync(join(repoRoot, 'prisma', 'schema.prisma'), 'utf8').replace(/\r\n/g, '\n');
    const apiSchema = readFileSync(join(repoRoot, 'apps', 'api', 'prisma', 'schema.prisma'), 'utf8').replace(/\r\n/g, '\n');
    expect(rootSchema).toBe(apiSchema);

    const apiMigrationsDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
    for (const entry of readdirSync(apiMigrationsDir)) {
      const dirPath = join(apiMigrationsDir, entry);
      if (!statSync(dirPath).isDirectory()) continue;
      const rootSql = readFileSync(join(repoRoot, 'prisma', 'migrations', entry, 'migration.sql'), 'utf8').replace(/\r\n/g, '\n');
      const apiSql = readFileSync(join(dirPath, 'migration.sql'), 'utf8').replace(/\r\n/g, '\n');
      expect(rootSql).toBe(apiSql);
    }
  });

  it('creates the base PaymentProvider enum before provider-specific migrations', () => {
    const migrationsDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
    const migrationNames = readdirSync(migrationsDir)
      .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
      .sort();
    const baseMigration = '20260930000000_payment_provider_enum';
    const paystackMigration = '20261001000000_paystack_provider';
    const darajaMigration = '20261023000000_daraja_provider';

    expect(migrationNames.indexOf(baseMigration)).toBeGreaterThanOrEqual(0);
    expect(migrationNames.indexOf(baseMigration)).toBeLessThan(migrationNames.indexOf(paystackMigration));
    expect(migrationNames.indexOf(paystackMigration)).toBeLessThan(migrationNames.indexOf(darajaMigration));

    const baseSql = readFileSync(join(migrationsDir, baseMigration, 'migration.sql'), 'utf8').replace(/\s+/g, ' ');
    expect(baseSql).toContain(
      'CREATE TYPE "PaymentProvider" AS ENUM ( \'INTASEND\', \'WISE\', \'MANUAL_BANK_TRANSFER\' );',
    );
  });

  it('creates payment_logs and its enums before the pricing migration alters the table', () => {
    const migrationsDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
    const baseMigration = '20261018000000_payment_log_base';
    const pricingMigration = '20261019000000_multi_market_pricing_ssot';
    const migrationNames = readdirSync(migrationsDir)
      .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
      .sort();

    expect(migrationNames.indexOf(baseMigration)).toBeGreaterThanOrEqual(0);
    expect(migrationNames.indexOf(baseMigration)).toBeLessThan(migrationNames.indexOf(pricingMigration));

    const baseSql = readFileSync(join(migrationsDir, baseMigration, 'migration.sql'), 'utf8');
    expect(baseSql).toContain('CREATE TYPE "PaymentMethodType" AS ENUM');
    expect(baseSql).toContain('CREATE TYPE "PaymentStatus" AS ENUM');
    expect(baseSql).toContain('CREATE TABLE "payment_logs"');
    expect(baseSql).toContain('"idempotency_key" TEXT NOT NULL');
  });

  it('normalizes legacy commercial identifier columns before dependent foreign keys are added', () => {
    const migrationsDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
    const migrationNames = readdirSync(migrationsDir)
      .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
      .sort();
    const referenceMigration = '20261029000000_normalize_commercial_reference_ids';
    const vaultMigration = '20261030012500_add_vault_secrets';
    const outboxMigration = '20261111000000_platform_provisioning_outbox';
    const oidcMigration = '20261113050000_phase5_oidc_identity_links';

    expect(migrationNames.indexOf(referenceMigration)).toBeGreaterThanOrEqual(0);
    expect(migrationNames.indexOf(referenceMigration)).toBeLessThan(migrationNames.indexOf(vaultMigration));
    expect(migrationNames.indexOf(referenceMigration)).toBeLessThan(migrationNames.indexOf(outboxMigration));
    expect(migrationNames.indexOf(referenceMigration)).toBeLessThan(migrationNames.indexOf(oidcMigration));

    const sql = readFileSync(join(migrationsDir, referenceMigration, 'migration.sql'), 'utf8');
    expect(sql).toContain('ALTER TABLE "clients" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT');
    expect(sql).toContain('ALTER TABLE "subscriptions" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT');
    expect(sql).toContain('ALTER TABLE "invoices" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT');
  });

  it('keeps the unified price-book upsert free of duplicate column assignments', () => {
    const migrationPath = join(
      repoRoot,
      'apps',
      'api',
      'prisma',
      'migrations',
      '20261030021500_unify_commercial_pricebooks',
      'migration.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');
    const updateClause = sql.match(/ON CONFLICT \("id"\) DO UPDATE SET([\s\S]*?);/);

    expect(updateClause).not.toBeNull();
    const assignedColumns = Array.from(
      updateClause![1]!.matchAll(/^\s*"([^"]+)"\s*=/gm),
      (match) => match[1],
    );
    expect(new Set(assignedColumns).size).toBe(assignedColumns.length);
  });

  it('adds the Prisma client tax PIN field through a mirrored migration', () => {
    const migrationsDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
    const migration = '20261113060000_add_client_tax_pin';
    const migrationNames = readdirSync(migrationsDir)
      .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
      .sort();
    const sql = readFileSync(join(migrationsDir, migration, 'migration.sql'), 'utf8');

    expect(migrationNames).toContain(migration);
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "tax_pin" TEXT');
  });

  it('adds the Prisma client payment-provider profile fields with the declared uniqueness', () => {
    const migrationsDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
    const migration = '20261113070000_add_client_payment_profile_ids';
    const migrationNames = readdirSync(migrationsDir)
      .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
      .sort();
    const sql = readFileSync(join(migrationsDir, migration, 'migration.sql'), 'utf8');

    expect(migrationNames).toContain(migration);
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "intasend_customer_id" TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "wise_profile_id" TEXT');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "clients_intasend_customer_id_key"');
  });

  it('keeps every Prisma enum value represented in the SQL migration history', () => {
    const schema = readFileSync(join(repoRoot, 'apps/api/prisma/schema.prisma'), 'utf8');
    const migrationsDir = join(repoRoot, 'apps/api/prisma/migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
      .map((name) => join(migrationsDir, name, 'migration.sql'));
    const valuesByEnum = new Map<string, Set<string>>();

    const addValue = (enumName: string, value: string) => {
      const values = valuesByEnum.get(enumName) ?? new Set<string>();
      values.add(value);
      valuesByEnum.set(enumName, values);
    };

    for (const migrationFile of migrationFiles) {
      const sql = readFileSync(migrationFile, 'utf8');
      for (const match of sql.matchAll(/CREATE TYPE\s+"([^"]+)"\s+AS ENUM\s*\(([^)]*)\)/g)) {
        for (const valueMatch of match[2]!.matchAll(/'([^']+)'/g)) {
          addValue(match[1]!, valueMatch[1]!);
        }
      }
      for (const match of sql.matchAll(/ALTER TYPE\s+"([^"]+)"\s+ADD VALUE(?:\s+IF NOT EXISTS)?\s+'([^']+)'/g)) {
        addValue(match[1]!, match[2]!);
      }
    }

    for (const match of schema.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
      const enumName = match[1]!;
      const expectedValues = (match[2] ?? '')
        .split('\n')
        .map((value) => value.trim())
        .filter((value) => /^[A-Z][A-Z0-9_]*$/.test(value));
      const migratedValues = valuesByEnum.get(enumName) ?? new Set<string>();

      for (const value of expectedValues) {
        expect(migratedValues.has(value)).toBe(true);
      }
    }
  });
  it('adds the SubscriptionStatus value used by the dunning lifecycle', () => {
    const migrationsDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
    const migration = '20261113080000_add_suspended_subscription_status';
    const sql = readFileSync(join(migrationsDir, migration, 'migration.sql'), 'utf8');

    expect(sql).toContain('ALTER TYPE "SubscriptionStatus"');
    expect(sql).toContain("ADD VALUE IF NOT EXISTS 'SUSPENDED'");
  });

  it('adds subscription lifecycle fields before the performance index migration uses them', () => {
    const migrationsDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
    const migrationNames = readdirSync(migrationsDir)
      .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
      .sort();
    const lifecycleMigration = '20261030030000_subscription_payment_lifecycle_columns';
    const performanceMigration = '20261030054500_add_performance_indexes';

    expect(migrationNames.indexOf(lifecycleMigration)).toBeGreaterThanOrEqual(0);
    expect(migrationNames.indexOf(lifecycleMigration)).toBeLessThan(migrationNames.indexOf(performanceMigration));

    const sql = readFileSync(join(migrationsDir, lifecycleMigration, 'migration.sql'), 'utf8');
    for (const column of [
      '"provider"',
      '"provider_subscription_id"',
      '"current_period_start"',
      '"current_period_end"',
      '"grace_period_end"',
      '"dunning_attempts_count"',
      '"last_dunning_at"',
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain('"start_date" AT TIME ZONE \'UTC\'');
    expect(sql).toContain('"renewal_date" AT TIME ZONE \'UTC\'');
  });
});
