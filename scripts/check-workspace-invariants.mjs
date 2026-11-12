#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function validateWorkspaceInvariants(repoRoot = rootDir) {
  const rootLock = join(repoRoot, 'package-lock.json');
  if (!existsSync(rootLock)) {
    throw new Error('Missing root package-lock.json for npm workspaces.');
  }

  for (const appName of ['api', 'web']) {
    const nestedLock = join(repoRoot, 'apps', appName, 'package-lock.json');
    if (existsSync(nestedLock)) {
      throw new Error(`Orphaned nested workspace lockfile detected: apps/${appName}/package-lock.json`);
    }
  }

  const filesToCheck = [
    join(repoRoot, '.github', 'workflows', 'ci-cd.yml'),
    join(repoRoot, 'apps', 'api', 'Dockerfile'),
    join(repoRoot, 'apps', 'web', 'Dockerfile'),
  ];

  for (const filePath of filesToCheck) {
    const content = readFileSync(filePath, 'utf8');
    if (/\|\|\s*npm\s+install|else\s+npm\s+install/.test(content)) {
      throw new Error(`Non-deterministic "npm install" fallback found in ${filePath}`);
    }
    if (!/\bnpm\s+ci\b/.test(content)) {
      throw new Error(`Missing strict "npm ci" install command in ${filePath}`);
    }
  }

  const rootSchemaPath = join(repoRoot, 'prisma', 'schema.prisma');
  const apiSchemaPath = join(repoRoot, 'apps', 'api', 'prisma', 'schema.prisma');
  const rootSchema = readFileSync(rootSchemaPath, 'utf8').replace(/\r\n/g, '\n');
  const apiSchema = readFileSync(apiSchemaPath, 'utf8').replace(/\r\n/g, '\n');
  if (rootSchema !== apiSchema) {
    throw new Error('Prisma schema drift detected between prisma/schema.prisma and apps/api/prisma/schema.prisma.');
  }

  const apiMigrationsDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
  const rootMigrationsDir = join(repoRoot, 'prisma', 'migrations');
  for (const entry of readdirSync(apiMigrationsDir)) {
    const fullApiEntry = join(apiMigrationsDir, entry);
    if (!statSync(fullApiEntry).isDirectory()) continue;
    const apiSqlPath = join(fullApiEntry, 'migration.sql');
    const rootSqlPath = join(rootMigrationsDir, entry, 'migration.sql');
    if (!existsSync(rootSqlPath)) {
      throw new Error(`Missing mirrored root Prisma migration: prisma/migrations/${entry}/migration.sql`);
    }
    const apiSql = readFileSync(apiSqlPath, 'utf8').replace(/\r\n/g, '\n');
    const rootSql = readFileSync(rootSqlPath, 'utf8').replace(/\r\n/g, '\n');
    if (apiSql !== rootSql) {
      throw new Error(`Prisma migration SQL drift detected for ${entry}.`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateWorkspaceInvariants();
  console.log('Workspace lockfile, CI/Docker deterministic install, and Prisma schema invariants verified.');
}
