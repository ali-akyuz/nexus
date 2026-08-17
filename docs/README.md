# NEXUS — Documentation Index

> Architecture documentation for the NEXUS Distributed AI Job Processing Platform.

---

## Core Architecture

| Document                               | Description                                                 |
| -------------------------------------- | ----------------------------------------------------------- |
| [architecture.md](architecture.md)     | Full system architecture, service decomposition, data flows |
| [database.md](database.md)             | Database schema, entity design, state machines              |
| [queues.md](queues.md)                 | Queue architecture, retry strategy, dead-letter handling    |
| [workers.md](workers.md)               | Worker lifecycle, heartbeat, failure recovery               |
| [realtime.md](realtime.md)             | WebSocket events, payloads, rooms                           |
| [authentication.md](authentication.md) | JWT auth flows, RBAC, token rotation                        |
| [observability.md](observability.md)   | Logging, metrics, health checks, tracing                    |
| [testing.md](testing.md)               | Testing strategy, unit/integration/E2E                      |
| [deployment.md](deployment.md)         | Docker Compose, Dockerfiles, CI/CD                          |

---

## Architecture Decision Records

| ADR                                               | Decision                                         |
| ------------------------------------------------- | ------------------------------------------------ |
| [ADR-001](decisions/ADR-001-postgresql.md)        | Use PostgreSQL as the primary database           |
| [ADR-002](decisions/ADR-002-redis-bullmq.md)      | Use Redis + BullMQ for job queuing               |
| [ADR-003](decisions/ADR-003-python-ml-service.md) | Separate Python FastAPI ML service               |
| [ADR-004](decisions/ADR-004-websockets.md)        | Use WebSockets (Socket.IO) for real-time updates |
| [ADR-005](decisions/ADR-005-monorepo.md)          | Use monorepo with pnpm + Turborepo               |
| [ADR-006](decisions/ADR-006-async-workers.md)     | Worker-based asynchronous job processing         |

---

## Status

| Phase | Description                                               | Status      |
| ----- | --------------------------------------------------------- | ----------- |
| **0** | Architecture & Design                                     | ✅ Complete |
| **1** | Monorepo skeleton, tooling, Docker Compose infrastructure | 🔜          |
