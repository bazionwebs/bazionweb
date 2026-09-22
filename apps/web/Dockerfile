# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps: install production dependencies only
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — builder: full build with dev deps
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .

# Ensure public/ exists — Next.js standalone build expects it, but the repo
# has no public/ dir yet. Without this, `COPY --from=builder /app/public`
# in the runner stage fails with "not found".
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

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runner: minimal runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only what's needed at runtime
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
