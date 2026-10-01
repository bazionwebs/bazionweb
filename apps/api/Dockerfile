# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — builder
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
# npm ci requires lock in sync; fall back to npm install on drift (monorepo locks)
RUN npm ci --ignore-scripts || npm install --ignore-scripts

COPY . .

# Generate Prisma client (fail closed — broken schema must break the image)
RUN npx prisma generate --schema ./prisma.schema.prisma

# Build NestJS
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — production deps only
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runner
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache curl openssl

WORKDIR /app

ENV NODE_ENV=production

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

COPY --from=deps    --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist         ./dist

# Generated Prisma Client — `prisma generate` runs in the builder stage, but
# the production-only node_modules above comes from deps (no generate there
# and no Prisma CLI in production deps). Without this copy the app crashes
# at boot with "Cannot find module '.prisma/client/default'".
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Prisma schema needed for migrations at runtime
COPY --chown=nestjs:nodejs prisma.schema.prisma ./prisma/schema.prisma

USER nestjs

EXPOSE 4000
ENV PORT=4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/main"]
