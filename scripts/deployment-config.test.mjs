import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const compose = readFileSync(new URL('../docker-compose.dokploy.staging.yml', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/ci-cd.yml', import.meta.url), 'utf8');
const apiDockerfile = readFileSync(new URL('../apps/api/Dockerfile', import.meta.url), 'utf8');
const webDockerfile = readFileSync(new URL('../apps/web/Dockerfile', import.meta.url), 'utf8');
const dbInit = readFileSync(new URL('../deploy/dokploy/bazionweb-staging-db-init.sql', import.meta.url), 'utf8');
const stagingGuide = readFileSync(new URL('../docs/operations/vps-staging-deployment.md', import.meta.url), 'utf8');

test('staging uses separate staging hostnames and never routes production domains', () => {
  assert.match(compose, /Host\(`staging\.bazionweb\.com`\)/);
  assert.match(compose, /Host\(`staging-api\.bazionweb\.com`\)/);
  assert.doesNotMatch(compose, /Host\(`(?:www\.)?bazionweb\.com`/);
  assert.doesNotMatch(compose, /DATABASE_URL.*neon/i);
});

test('staging PostgreSQL has an explicit label for encrypted off-host backups', () => {
  assert.match(compose, /com\.bazion\.backup-target: bazionweb-staging/);
  assert.match(stagingGuide, /bazion-docker-postgres-dump\.sh bazionweb-staging bazionweb_staging bazion_admin/);
  assert.match(stagingGuide, /bazion-docker-postgres-dump\.sh platform-staging bazion_platform bazion_admin/);
});

test('staging database and cache have no host-published ports and use isolated networks', () => {
  assert.doesNotMatch(compose, /^\s+ports:/m);
  assert.match(compose, /staging-data:\s+internal: true/);
  assert.match(compose, /staging-cache:\s+internal: true/);
  assert.match(compose, /bazionweb_staging_pgdata/);
  assert.match(compose, /--requirepass/);
});

test('API only starts after database, cache and one-shot migrations are healthy', () => {
  const api = compose.match(/\n  api:\n([\s\S]*?)\n  web:/)?.[1] ?? '';
  assert.match(api, /migrate:\s+condition: service_completed_successfully/);
  assert.match(api, /db:\s+condition: service_healthy/);
  assert.match(api, /redis:\s+condition: service_healthy/);
  assert.match(compose, /BAZIONWEB_MIGRATOR_DATABASE_URL/);
  assert.match(dbInit, /CREATE ROLE bazionweb_app LOGIN/);
  assert.match(dbInit, /CREATE ROLE bazionweb_migrator LOGIN/);
  assert.match(dbInit, /ALTER DEFAULT PRIVILEGES/);
});

test('Node runtime and CI have moved off EOL Node 20 to Node 24', () => {
  assert.match(webDockerfile, /FROM node:24-alpine/);
  assert.match(apiDockerfile, /FROM node:24-alpine/);
  assert.doesNotMatch(`${webDockerfile}\n${apiDockerfile}`, /FROM node:(?:20|22)-/);
  assert.match(workflow, /NODE_VERSION: "24"/);
});

test('production Neon migrations are main-only while staging migrates its own VPS database', () => {
  const migrationJob = workflow.match(/\n  migrate:\n([\s\S]*?)\n  # ─── Stage 5:/)?.[1] ?? '';
  const stagingJob = workflow.match(/\n  deploy-staging:\n([\s\S]*?)\n  # ─── Stage 6:/)?.[1] ?? '';
  assert.match(migrationJob, /github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(stagingJob, /needs:.*migrate/);
  assert.match(stagingJob, /environment: staging/);
});
test('manual validation builds both images without publishing or deploying them', () => {
  assert.match(stagingGuide, /feature branches do not publish images on push/i);
  assert.match(stagingGuide, /manual workflow dispatch is build-only/i);
  assert.match(stagingGuide, /wait for a validated staging image in GHCR/i);
  const buildJob = workflow.match(/\n  build:\n([\s\S]*?)\n  # ─── Stage 4:/)?.[1] ?? '';
  const stagingJob = workflow.match(/\n  deploy-staging:\n([\s\S]*?)\n  # ─── Stage 6:/)?.[1] ?? '';
  const productionJob = workflow.match(/\n  deploy-production:\n([\s\S]*?)\n  # ─── Stage 9:/)?.[1] ?? '';
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(buildJob, /github\.event_name == 'workflow_dispatch'/);
  assert.equal((buildJob.match(/push: \$\{\{ github\.event_name == 'push' \}\}/g) ?? []).length, 2);
  assert.match(stagingJob, /github\.event_name == 'push'/);
  assert.match(productionJob, /github\.event_name == 'push'/);
});
test('nested local environment files are excluded from Docker build contexts', () => {
  const dockerignore = readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8');
  assert.match(dockerignore, /^\*\*\/\.env$/m);
  assert.match(dockerignore, /^\*\*\/\.env\.\*$/m);
});

test('root Docker context excludes nested workspace dependencies and generated artifacts', () => {
  const dockerignore = readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8');
  for (const pattern of [
    /^\*\*\/node_modules\/$/m,
    /^\*\*\/coverage\/$/m,
    /^\*\*\/dist\/$/m,
    /^\*\*\/build\/$/m,
    /^\*\*\/\.next\/$/m,
  ]) {
    assert.match(dockerignore, pattern);
  }
});
