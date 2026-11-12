import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Platform hosting mapping migration', () => {
  const apiMigration = readFileSync(resolve(__dirname, '../../../prisma/migrations/20261112133000_phase4_hosting_deployment_projection/migration.sql'), 'utf8');
  const rootMigration = readFileSync(resolve(__dirname, '../../../../../prisma/migrations/20261112133000_phase4_hosting_deployment_projection/migration.sql'), 'utf8');

  it('keeps root and API Prisma migration copies byte-identical', () => {
    expect(rootMigration).toBe(apiMigration);
  });

  it('enforces one-to-one deployment references and complete audited map metadata', () => {
    expect(apiMigration).toContain('REFERENCES "platform_provisioning_projections"("platform_deployment_id")');
    expect(apiMigration).toContain('CREATE UNIQUE INDEX "hosting_accounts_platform_deployment_id_key"');
    expect(apiMigration).toContain('"platform_deployment_mapped_by" IS NOT NULL');
    expect(apiMigration).toContain('"platform_deployment_mapping_evidence" IS NOT NULL');
    expect(apiMigration).toContain('length(trim("platform_deployment_mapping_evidence")) BETWEEN 5 AND 300');
  });
});
