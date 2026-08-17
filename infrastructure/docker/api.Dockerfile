# ─────────────────────────────────────────────────────────────────────────────
# NEXUS API — Multi-stage Dockerfile
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Base ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

# ── Stage 2: Dependencies ─────────────────────────────────────────────────────
FROM base AS deps

# Copy workspace manifests only — allows Docker layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile --filter=@repo/api... 2>/dev/null || \
    pnpm install --frozen-lockfile

# ── Stage 3: Builder ──────────────────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

# Build shared packages first (dependency order matters)
RUN pnpm --filter=@repo/types build && \
    pnpm --filter=@repo/shared build && \
    pnpm --filter=@repo/config build && \
    pnpm --filter=@repo/api dlx prisma generate && \
    pnpm --filter=@repo/api build

# ── Stage 4: Runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Run as non-root for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Copy only what's needed to run
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/main"]
