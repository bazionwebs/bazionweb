# BazionWeb Dokploy staging deployment

This stack is isolated from production. It uses `staging.bazionweb.com` and `staging-api.bazionweb.com`, a dedicated PostgreSQL 16 volume, authenticated Redis, a one-shot Prisma migration service, and the GHCR images built by GitHub Actions. Production remains in `docker-compose.dokploy.yml` and continues to use its existing production settings.

## Before creating the Dokploy application

1. Merge the reviewed branch to `main` only after CI passes. Create or update the `staging` branch from the intended commit. A push to `staging` publishes `:staging` images and can trigger the staging Dokploy deploy job; feature branches only publish branch/SHA images and do not deploy.
2. In the GitHub repository, make sure GHCR packages `bazionweb-web` and `bazionweb-api` are readable by the Dokploy server. Use a read-only GitHub token or package access granted to the Dokploy host. Do not make images public unless that is an intentional product decision.
3. In GitHub Actions settings, create the `staging` environment. Add `DOKPLOY_URL`, `DOKPLOY_API_KEY`, and `DOKPLOY_STAGING_COMPOSE_ID` as environment secrets. Keep approval requirements enabled if you want a human gate before a staging redeploy. Add `STAGING_NEXT_PUBLIC_APP_URL` and `STAGING_NEXT_PUBLIC_PLATFORM_APP_URL` as repository variables only if the defaults below are not appropriate.
4. In Dokploy, create a Compose application from `bazionwebs/bazionweb`, select branch `staging`, and set the Compose file path to `docker-compose.dokploy.staging.yml`. Attach the application to the existing `dokploy-network`; do not publish container ports.
5. In Cloudflare, leave the existing proxied A records for `staging` and `staging-api` pointed at the VPS. Use SSL/TLS mode **Full (strict)**. The Traefik routers request certificates with the VPS's existing `letsencrypt` resolver.

## Dokploy environment variables

Set these values in the staging Compose application's environment/secrets UI. Never commit them or paste them into chat. Use fresh staging-only values. Generate URL-safe hex passwords with `openssl rand -hex 32` on the VPS (repeat for every password):

| Variable | Value |
| --- | --- |
| `IMAGE_TAG` | `staging` for automatic branch deploys; an immutable `sha-<commit>` tag for a manually pinned rollout |
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

## Database backups

The staging volume is persistent but is not a backup. Before loading customer or pilot data, install the VPS Restic PostgreSQL dump job for both `bazionweb_staging` and `bazion_platform`, store encrypted backups in the private Cloudflare R2 bucket, and complete a restore drill into disposable databases. A successful Restic run that only captures Docker volumes is not sufficient proof of a consistent PostgreSQL backup.