# ─────────────────────────────────────────────────────────────────────────────
# BazionWeb — Standalone Next.js Multi-Stage Dockerfile (monorepo root context `.`)
# Base: Node 24 Alpine (Minimal Attack Surface & Resource Efficiency)
# Architecture: 2-Stage Multi-Build (builder -> runner; standalone traces runtime deps)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Deterministic Workspace Install & Build ──────────────────────────
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --ignore-scripts

COPY apps/web ./apps/web

# Ensure public/ exists — Next.js standalone build expects it
RUN mkdir -p ./apps/web/public

# Build-time public env vars (non-secret)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_PLATFORM_APP_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_PLATFORM_APP_URL=$NEXT_PUBLIC_PLATFORM_APP_URL
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm --workspace=@bazionweb/web run build

# ── Stage 2: Minimal Production Runner ───────────────────────────────────────
FROM node:24-alpine AS runner
# Patch-level OS upgrade: ship a base with current advisory fixes
RUN apk update && apk upgrade --no-cache && apk add --no-cache curl \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    && rm -rf /var/cache/apk/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Enforce least-privilege security: Create non-root system user & group
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy traced standalone server output and static/public assets for monorepo tracing root
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

# Container healthcheck testing Next.js internal health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
