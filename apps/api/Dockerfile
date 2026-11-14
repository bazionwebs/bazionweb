# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — builder (monorepo root context `.`)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --ignore-scripts

COPY prisma ./prisma
COPY apps/api ./apps/api

# Generate Prisma client (fail closed — broken schema must break the image)
# Uses ./prisma/schema.prisma (or ./apps/api/prisma/schema.prisma)
RUN npx prisma generate --schema=./prisma/schema.prisma

# Build NestJS
RUN npm --workspace=@bazionweb/api run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — production deps only (strict root workspace lockfile)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --omit=dev --workspace=@bazionweb/api --include-workspace-root --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runner
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
# Patch-level OS upgrade: ship a base with current advisory fixes
RUN apk update && apk upgrade --no-cache && apk add --no-cache curl openssl \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_PATH=/app/apps/api/node_modules:/app/node_modules

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

COPY --from=deps    --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=deps    --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json

# Generated Prisma Client — `prisma generate` runs in the builder stage, but
# the production-only node_modules above comes from deps (no generate there
# and no Prisma CLI in production deps). Without this copy the app crashes
# at boot with "Cannot find module '.prisma/client/default'".
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Prisma schema needed for runtime metadata
COPY --chown=nestjs:nodejs prisma/schema.prisma ./prisma/schema.prisma
COPY --chown=nestjs:nodejs prisma/migrations ./prisma/migrations

USER nestjs

EXPOSE 4000
ENV PORT=4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/main"]
