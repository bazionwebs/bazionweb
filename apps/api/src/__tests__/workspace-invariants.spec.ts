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
});
