# NEXUS — Distributed AI Job Processing Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.12-blue)](https://python.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.x-orange)](https://pnpm.io)

> **Status:** Phase 0 — Architecture & Design (not yet implemented)

---

## Overview

NEXUS is a production-grade **distributed AI job processing platform**. Users submit data-processing, machine-learning, and AI tasks through a web interface. The platform authenticates users, validates and queues jobs, routes them to specialized workers, executes ML/data tasks in a dedicated Python service, and streams real-time progress updates over WebSockets.

This is not a simple CRUD application. Queue semantics, worker lifecycle management, reliability guarantees, observability, and security are first-class requirements.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js)                        │
│         REST + WebSocket (Socket.IO)                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    NestJS API  (:3001)                          │
│  Auth · Jobs · Workers · Queue Mgmt · WebSocket Gateway        │
└────────┬───────────────┬────────────────────────────────────────┘
         │               │
┌────────▼───────┐  ┌────▼────────────────────────────────────────┐
│  PostgreSQL    │  │          Redis / BullMQ                     │
│  (Primary DB)  │  │  Queues: default · ml · ai · analytics     │
└────────────────┘  └────────────────────┬───────────────────────┘
                                         │
                    ┌────────────────────▼───────────────────────┐
                    │              Workers (NestJS)               │
                    │  processor · analytics                      │
                    └────────────────────┬───────────────────────┘
                                         │
                    ┌────────────────────▼───────────────────────┐
                    │         Python ML Service (:8000)           │
                    │       FastAPI · Pandas · Scikit-learn       │
                    └────────────────────────────────────────────┘
```

Full architecture documentation is in [`docs/architecture.md`](docs/architecture.md).

---

## Repository Structure

```
nexus/
├── apps/
│   ├── web/                 # Next.js 14 frontend
│   ├── api/                 # NestJS backend API
│   └── ml-service/          # Python FastAPI ML service
├── workers/
│   ├── processor/           # General job processor worker
│   └── analytics/           # Analytics-specific worker
├── packages/
│   ├── shared/              # Shared business logic (TS)
│   ├── types/               # Shared TypeScript types & schemas
│   └── config/              # Shared configuration helpers
├── infrastructure/
│   ├── docker/              # Per-service Dockerfiles
│   └── scripts/             # Dev/ops helper scripts
├── docs/                    # Architecture documentation
├── tests/                   # E2E & integration test suites
├── .github/workflows/       # CI/CD pipelines
├── docker-compose.yml       # Local dev orchestration
├── turbo.json               # Turborepo task graph
├── pnpm-workspace.yaml      # pnpm workspace config
└── .env.example             # Environment variable template
```

---

## Technology Stack

| Layer       | Technology                                                            |
| ----------- | --------------------------------------------------------------------- |
| Frontend    | Next.js 14, TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts |
| Backend API | NestJS, TypeScript, Prisma, Socket.IO                                 |
| Queue       | Redis 7, BullMQ                                                       |
| Database    | PostgreSQL 16                                                         |
| ML Service  | Python 3.12, FastAPI, Pandas, Scikit-learn                            |
| Auth        | JWT (access + refresh), bcrypt, RBAC                                  |
| Monorepo    | pnpm, Turborepo                                                       |
| Containers  | Docker, Docker Compose                                                |
| Testing     | Vitest, Jest, Pytest, Playwright                                      |
| CI          | GitHub Actions                                                        |

---

## Documentation

| Document                                           | Description                         |
| -------------------------------------------------- | ----------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)     | Full system architecture            |
| [`docs/database.md`](docs/database.md)             | Database schema & entity design     |
| [`docs/queues.md`](docs/queues.md)                 | Queue architecture & semantics      |
| [`docs/workers.md`](docs/workers.md)               | Worker lifecycle & failure handling |
| [`docs/realtime.md`](docs/realtime.md)             | WebSocket events & payloads         |
| [`docs/authentication.md`](docs/authentication.md) | Auth flows & RBAC                   |
| [`docs/observability.md`](docs/observability.md)   | Logging, metrics, health checks     |
| [`docs/testing.md`](docs/testing.md)               | Testing strategy & E2E flows        |
| [`docs/deployment.md`](docs/deployment.md)         | Deployment & Docker Compose guide   |
| [`docs/decisions/`](docs/decisions/)               | Architecture Decision Records       |

---

## Quick Start (coming in Phase 2)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/nexus.git
cd nexus

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your values

# 3. Start all services
docker compose up

# 4. Open the app
open http://localhost:3000
```

---

## Development Phases

| Phase  | Description                                               | Status      |
| ------ | --------------------------------------------------------- | ----------- |
| **0**  | Architecture & Design                                     | ✅ Complete |
| **1**  | Monorepo skeleton, tooling, Docker Compose infrastructure | 🔜 Next     |
| **2**  | Database schema, Prisma migrations, seed data             | ⬜          |
| **3**  | NestJS API — Auth module (register, login, JWT, refresh)  | ⬜          |
| **4**  | NestJS API — Jobs module, file upload                     | ⬜          |
| **5**  | Redis/BullMQ queue integration                            | ⬜          |
| **6**  | Worker services (processor, analytics)                    | ⬜          |
| **7**  | Python FastAPI ML service                                 | ⬜          |
| **8**  | WebSocket real-time updates                               | ⬜          |
| **9**  | Frontend — Auth pages, dashboard, job submission          | ⬜          |
| **10** | Observability, metrics, structured logging                | ⬜          |
| **11** | Testing — unit, integration, E2E                          | ⬜          |
| **12** | CI/CD pipelines                                           | ⬜          |

---

## Engineering Principles

- **Strong typing** throughout (TypeScript strict mode, Python type hints)
- **Modular architecture** — no giant files, clear separation of concerns
- **No hardcoded secrets** — all config via environment variables
- **No business logic in controllers** — service layer owns logic
- **Every major feature has tests**
- **Repository is never knowingly broken**
- **Distributed systems first** — retries, backoff, idempotency, timeouts planned from day one

---

## License

MIT — see [LICENSE](LICENSE)
