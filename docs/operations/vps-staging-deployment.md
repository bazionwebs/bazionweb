# BazionWeb Dokploy staging deployment

This staging stack is isolated from production. It uses `staging.bazionweb.com` and `staging-api.bazionweb.com`, a dedicated PostgreSQL 16 volume, authenticated Redis, a one-shot Prisma migration service, and separate GHCR web/API images. Production remains in `docker-compose.dokploy.yml` with its existing settings. The current deployment branch is feature-only; images have not been published for Dokploy yet.

## Before creating the Dokploy application

1. For the normal Bazionweb release path, merge the reviewed branch to `staging` only after validations pass and Bazionweb Actions can complete; a staging push builds/publishes images and may trigger the configured Dokploy redeploy. Feature branch pushes do not publish, and Bazionweb manual dispatch is build-only. If Bazionweb Actions quota is exhausted, use the Platform-owned fallback workflow described below after it is merged to Platform `main`; it validates the selected Bazionweb commit and publishes commit-addressed images without deploying them.
2. Make the selected GHCR packages readable by the Dokploy server. For Platform-built fallback images the package names are `ghcr.io/bazionweb/bazionweb-web` and `ghcr.io/bazionweb/bazionweb-api`; keep them private and configure a read-only `read:packages` credential in Dokploy.
3. In GitHub Actions settings, create the `staging` environment. Add `DOKPLOY_URL`, `DOKPLOY_API_KEY`, and `DOKPLOY_STAGING_COMPOSE_ID` as environment secrets. Keep approval requirements enabled if you want a human gate before a staging redeploy. Add `STAGING_NEXT_PUBLIC_APP_URL` and `STAGING_NEXT_PUBLIC_PLATFORM_APP_URL` as repository variables only if the defaults below are not appropriate.
4. In Dokploy, create a Compose application from `bazionwebs/bazionweb`, select branch `staging`, and set the Compose file path to `docker-compose.dokploy.staging.yml`. Attach the application to the existing `dokploy-network`; do not publish container ports.
5. In Cloudflare, leave the existing proxied A records for `staging` and `staging-api` pointed at the VPS. Use SSL/TLS mode **Full (strict)**. The Traefik routers request certificates with the VPS's existing `letsencrypt` resolver.

## Dokploy environment variables

Set these values in the staging Compose application's environment/secrets UI. Never commit them or paste them into chat. Use fresh staging-only values. Generate URL-safe hex passwords with `openssl rand -hex 32` on the VPS (repeat for every password):

| Variable | Value |
| --- | --- |
| `IMAGE_TAG` | `staging` for automatic branch deploys; a commit-addressed `sha-<commit>` tag for a manually pinned rollout |
| `IMAGE_OWNER` | `bazionwebs` for Bazionweb's own CI images; `bazionweb` for images built by the Platform fallback workflow |
| `BAZION_DB_ADMIN_PASSWORD` | Unique 32-byte hex secret; used only by the Postgres bootstrap/superuser |
| `BAZIONWEB_MIGRATOR_PASSWORD` | Unique 32-byte hex secret for schema migrations |
| `BAZIONWEB_APP_PASSWORD` | Unique 32-byte hex secret for the API's restricted runtime role |
| `BAZIONWEB_MIGRATOR_DATABASE_URL` | `postgresql://bazionweb_migrator:<hex-password>@db:5432/bazionweb_staging?schema=public` |
| `BAZIONWEB_APP_DATABASE_URL` | `postgresql://bazionweb_app:<hex-password>@db:5432/bazionweb_staging?schema=public` |
| `REDIS_PASSWORD` | Unique 32-byte hex secret |
| `JWT_SECRET` | Separate random value, at least 32 characters |
| `INTERNAL_DISPATCH_SECRET` | Separate random value, at least 32 characters; also used by the web BFF |
| `VAULT_MASTER_KEY` | Separate random 32-byte key if staging needs to exercise encrypted credential storage |

Optional provider secrets should be staging/sandbox credentials only: `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_PASSKEY`, and mail settings (`RESEND_API_KEY` or `SMTP_*`). Daraja is forced to sandbox. Do not copy production payment secrets into staging. Keep `PLATFORM_PROVISIONING_WORKER_ENABLED=false` until the Platform integration and callback secrets have been configured and tested together.

The database init script creates a non-superuser runtime account and a separate migration owner. The API receives only the runtime URL. The migration job uses its own role and completes before the API starts. Do not change the Postgres volume name to rotate a password; rotate credentials with an explicit SQL operation and coordinated Dokploy environment change.

## First deployment and checks

After saving environment values, deploy the application from Dokploy. The order is database health → Prisma migrations → API health → web. If the migration service fails, the API remains stopped. Check Dokploy logs for `db`, `migrate`, `api`, and `web` before enabling external integrations. Then verify:

```text
https://staging.bazionweb.com
https://staging.bazionweb.com/api/v1/health
https://staging-api.bazionweb.com/api/v1/health
```

Staging resource ceilings are 0.4 CPU/512 MiB for PostgreSQL, 0.35 CPU/384 MiB for the one-shot migrator, 0.55 CPU/768 MiB for API, 0.35 CPU/512 MiB for web, and 0.1 CPU/192 MiB for Redis. The database/cache networks are internal-only, logs rotate at 10 MiB × 3, application containers run non-root with all Linux capabilities dropped, and no service publishes a host port.

## Build Bazionweb images with Platform Actions when Bazionweb quota is exhausted

After `build-bazionweb-staging.yml` is merged to the Platform repository's `main` branch, open **Actions → Build Bazionweb staging images**, select `main`, and enter the exact 40-character Bazionweb commit SHA to validate. The workflow uses the existing Platform repository variables/secrets `BAZIONWEB_APP_CLIENT_ID` and `BAZIONWEB_APP_PRIVATE_KEY` for read-only source checkout, then runs Bazionweb configuration checks, lint, typechecks, database migrations, and web/API tests before publishing. It uses Platform's `GITHUB_TOKEN` to push the resulting images under `ghcr.io/bazionweb/` with immutable `sha-<commit>` tags. It does not deploy or update Dokploy.

For that Dokploy rollout set `IMAGE_OWNER=bazionweb` and `IMAGE_TAG=sha-<the-validated-commit>`. Configure Dokploy with a private-package read credential for `ghcr.io/bazionweb`; GitHub Container Registry pulls from Dokploy use a read-only classic personal access token with `read:packages`, belonging to an account that can read those packages. Keep it in Dokploy's registry credential store only. After a successful image build, redeploy the Bazionweb Compose app and check the migration, API, and web health gates. For the normal Bazionweb-owned CI path, keep `IMAGE_OWNER=bazionwebs`.


## Database backups

The staging volume is persistent but is not a backup. The PostgreSQL service has the Docker label `com.bazion.backup-target=bazionweb-staging`. Install the shared `/usr/local/sbin/bazion-docker-postgres-dump.sh` helper from the Platform repository on the VPS, then add both staging database dump invocations to the Restic script after `$STAGE` is created and before `restic backup`: `/usr/local/sbin/bazion-docker-postgres-dump.sh bazionweb-staging bazionweb_staging bazion_admin "$STAGE/postgres"` and `/usr/local/sbin/bazion-docker-postgres-dump.sh platform-staging bazion_platform bazion_admin "$STAGE/postgres"`. Run Restic once and verify both validated `.dump` files are captured in the private R2 snapshot. Restore each dump to a disposable database and check migrations/preflight before loading customer or pilot data.
