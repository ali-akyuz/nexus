# ─────────────────────────────────────────────────────────────────────────────
# NEXUS Web — Multi-stage Dockerfile (Next.js standalone output)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Base ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

# ── Stage 2: Dependencies ─────────────────────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --filter=@repo/web... 2>/dev/null || \
    pnpm install --frozen-lockfile

# ── Stage 3: Builder ──────────────────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Build shared types first, then the web app
RUN pnpm --filter=@repo/types build && \
    pnpm --filter=@repo/web build

# ── Stage 4: Runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
