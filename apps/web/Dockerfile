# ─────────────────────────────────────────────────────────────────────────────
# BazionWeb — Standalone Next.js Multi-Stage Dockerfile
# Base: Node 20 Alpine (Minimal Attack Surface & Resource Efficiency)
# Architecture: 3-Stage Multi-Build (deps -> builder -> runner)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Dependency Resolution ───────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts

# ── Stage 2: Application Build ───────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts || npm install --ignore-scripts

COPY . .

# Ensure public/ exists — Next.js standalone build expects it
RUN mkdir -p ./public

# Build-time public env vars (non-secret)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ── Stage 3: Minimal Production Runner ───────────────────────────────────────
FROM node:20-alpine AS runner
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

# Copy static assets and traced standalone server output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Container healthcheck testing Next.js internal health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Execute standalone Node server (supports both monorepo-root and sub-workspace traces)
CMD ["sh", "-c", "if [ -f apps/web/server.js ]; then node apps/web/server.js; else node server.js; fi"]
