# NEXUS — Deployment Strategy

> **Document status:** Phase 0 — Design  
> **Last updated:** 2026-08-17

---

## 1. Environments

| Environment    | Purpose                   | Infrastructure                       |
| -------------- | ------------------------- | ------------------------------------ |
| **Local**      | Developer workstation     | Docker Compose                       |
| **CI**         | Automated testing         | GitHub Actions + Docker              |
| **Staging**    | Pre-production validation | Docker Compose on cloud VM           |
| **Production** | Live platform             | Docker Compose / Kubernetes (future) |

Phase 0 focuses on local Docker Compose. Production Kubernetes is a future milestone.

---

## 2. Docker Compose — Local Development

### 2.1 Services

```yaml
# docker-compose.yml (target design)

services:
  postgres:
    image: postgres:16-alpine
    ports: ['5432:5432']
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U nexus_user']
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s

  api:
    build:
      context: .
      dockerfile: infrastructure/docker/api.Dockerfile
    ports: ['3001:3001', '9090:9090']
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    volumes:
      - ./uploads:/app/uploads

  web:
    build:
      context: .
      dockerfile: infrastructure/docker/web.Dockerfile
    ports: ['3000:3000']
    env_file: .env
    depends_on:
      - api

  worker-processor:
    build:
      context: .
      dockerfile: infrastructure/docker/worker-processor.Dockerfile
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
      api: { condition: service_started }
    deploy:
      replicas: 2 # Run 2 processor workers locally

  worker-analytics:
    build:
      context: .
      dockerfile: infrastructure/docker/worker-analytics.Dockerfile
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }

  ml-service:
    build:
      context: .
      dockerfile: infrastructure/docker/ml-service.Dockerfile
    ports: ['8000:8000']
    env_file: .env

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: nexus-network
```

### 2.2 Startup Order

```
postgres (healthy) ──┐
                      ├──► api (started) ──► web
redis (healthy) ─────┘        │
                               ├──► worker-processor (×2)
                               └──► worker-analytics

ml-service (independent, started alongside api)
```

### 2.3 Commands

```bash
# Start all services
docker compose up

# Start with rebuild
docker compose up --build

# Scale workers
docker compose up --scale worker-processor=4

# View logs
docker compose logs -f api
docker compose logs -f worker-processor

# Run database migrations
docker compose exec api pnpm prisma migrate dev

# Stop and clean up
docker compose down -v    # -v removes volumes (data loss!)
```

---

## 3. Dockerfiles

### 3.1 API Dockerfile

```dockerfile
# infrastructure/docker/api.Dockerfile

FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm turbo run build --filter=api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json .
COPY --from=builder /app/apps/api/prisma ./prisma

EXPOSE 3001 9090
CMD ["node", "dist/main.js"]
```

### 3.2 Python ML Service Dockerfile

```dockerfile
# infrastructure/docker/ml-service.Dockerfile

FROM python:3.12-slim

WORKDIR /app

COPY apps/ml-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ml-service/ .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 4. Build Pipeline

### 4.1 CI/CD with GitHub Actions

```
Push to PR branch
  └── lint.yml         # ESLint, Prettier, Ruff, mypy
      └── test.yml     # Unit + integration tests
          └── build.yml # Docker image builds

Push to main
  └── test.yml
      └── build.yml
          └── deploy-staging.yml   # Deploy to staging

Tag (v*.*.*)
  └── release.yml      # Build + push images, deploy production
```

### 4.2 Workflow Files

```
.github/
  workflows/
    lint.yml             # Lint all workspaces
    test.yml             # All test suites
    build.yml            # Build Docker images
    e2e.yml              # Playwright E2E tests
    deploy-staging.yml   # Deploy to staging
    release.yml          # Tag-triggered production release
    dependabot.yml       # Dependency updates
```

---

## 5. Environment Management

| Config     | Method                                             |
| ---------- | -------------------------------------------------- |
| Local dev  | `.env` file (copied from `.env.example`)           |
| CI         | GitHub Actions Secrets                             |
| Staging    | Docker Compose env file on server                  |
| Production | Secrets manager (e.g., AWS Secrets Manager, Vault) |

**Rule:** No secrets in code, Docker images, or git history. All secrets injected at runtime.

---

## 6. Database Migrations

Prisma migrations are run as a startup step in the API container:

```dockerfile
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]
```

- `migrate deploy` applies pending migrations without interactive prompts.
- Migrations are checked into git under `apps/api/prisma/migrations/`.
- Rollback: Prisma does not support automatic rollback — write an explicit down migration or restore from backup.

---

## 7. Health Check Integration

Docker Compose uses health checks to control startup order. Services that depend on the API wait for it to return `200 OK` from `/health`.

For production readiness probes (Kubernetes):

- **Liveness probe:** `GET /health` — if unhealthy, restart the container.
- **Readiness probe:** `GET /health/ready` — if not ready, remove from load balancer (not yet implemented, planned).

---

## 8. Secret Management (Production Roadmap)

| Secret               | Production approach                   |
| -------------------- | ------------------------------------- |
| Database credentials | AWS Secrets Manager / Vault           |
| JWT secrets          | Secrets Manager, rotated periodically |
| Redis password       | Secrets Manager                       |
| ML Service API key   | Secrets Manager                       |
| SSL certificates     | AWS ACM / Let's Encrypt               |

---

## 9. Production Considerations (Future)

These are not Phase 1 requirements but should be designed for:

| Concern                     | Solution                            |
| --------------------------- | ----------------------------------- |
| Database connection pooling | PgBouncer sidecar                   |
| Redis high availability     | Redis Sentinel or Cluster           |
| TLS termination             | Nginx or AWS ALB                    |
| Horizontal API scaling      | Behind load balancer, stateless     |
| Worker auto-scaling         | Kubernetes HPA based on queue depth |
| Image registry              | GitHub Container Registry (ghcr.io) |
| Log aggregation             | Loki / CloudWatch / Datadog         |
| Metrics                     | Prometheus + Grafana                |
