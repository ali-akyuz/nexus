# ─────────────────────────────────────────────────────────────────────────────
# NEXUS Processor Worker — Multi-stage Dockerfile
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS deps

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY workers/processor/package.json ./workers/processor/
COPY packages/types/package.json ./packages/types/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile --filter=@repo/worker-processor... 2>/dev/null || \
    pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm --filter=@repo/types build && \
    pnpm --filter=@repo/shared build && \
    pnpm --filter=@repo/config build && \
    pnpm --filter=@repo/worker-processor dlx prisma generate && \
    pnpm --filter=@repo/worker-processor build

FROM node:22-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker

WORKDIR /app

COPY --from=builder --chown=worker:nodejs /app/workers/processor/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/workers/processor/package.json ./package.json
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules

USER worker

CMD ["node", "dist/main"]
