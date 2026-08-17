# NEXUS — System Architecture

> **Document status:** Phase 0 — Design  
> **Last updated:** 2026-08-17

---

## 1. Purpose & Scope

This document describes the high-level system architecture of NEXUS: a distributed AI job processing platform. It covers service decomposition, data flows, communication patterns, and the reasoning behind key structural choices.

For individual concerns see the companion documents:

- Database design → [`database.md`](database.md)
- Queue architecture → [`queues.md`](queues.md)
- Worker lifecycle → [`workers.md`](workers.md)
- Real-time communication → [`realtime.md`](realtime.md)
- Authentication → [`authentication.md`](authentication.md)
- Observability → [`observability.md`](observability.md)
- Testing → [`testing.md`](testing.md)
- Deployment → [`deployment.md`](deployment.md)

---

## 2. System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEXUS Platform                                 │
│                                                                             │
│  ┌──────────────┐    REST/WS    ┌───────────────────────────────────────┐  │
│  │              │◄─────────────►│           NestJS API (:3001)          │  │
│  │  Next.js Web │               │                                       │  │
│  │   (:3000)    │               │  ┌──────────┐  ┌────────────────────┐ │  │
│  │              │               │  │  Auth    │  │  Jobs Controller   │ │  │
│  └──────────────┘               │  │  Module  │  │  (REST endpoints)  │ │  │
│                                 │  └──────────┘  └────────────────────┘ │  │
│                                 │  ┌──────────┐  ┌────────────────────┐ │  │
│                                 │  │  Queue   │  │  WS Gateway        │ │  │
│                                 │  │  Module  │  │  (Socket.IO)       │ │  │
│                                 │  └─────┬────┘  └────────────────────┘ │  │
│                                 └────────┼──────────────────────────────┘  │
│                                          │                                  │
│               ┌──────────────────────────┼───────────────────────────┐     │
│               │                          │                           │     │
│    ┌──────────▼──────┐       ┌───────────▼────────┐    ┌──────────┐ │     │
│    │   PostgreSQL     │       │   Redis / BullMQ   │    │  File    │ │     │
│    │   (:5432)        │       │   (:6379)          │    │  Store   │ │     │
│    │                 │       │                    │    │  (local/ │ │     │
│    │  Primary store  │       │  Job queues        │    │   S3)    │ │     │
│    │  for all        │       │  Worker registry   │    └──────────┘ │     │
│    │  persistent     │       │  Rate limiting     │                  │     │
│    │  data           │       │                    │                  │     │
│    └─────────────────┘       └───────────┬────────┘                 │     │
│                                          │                           │     │
│                              ┌───────────▼────────────────────┐     │     │
│                              │           Workers               │     │     │
│                              │                                 │     │     │
│                              │  ┌─────────────────────────┐   │     │     │
│                              │  │  Processor Worker       │   │     │     │
│                              │  │  (default, ml, ai)      │   │     │     │
│                              │  └───────────┬─────────────┘   │     │     │
│                              │              │                  │     │     │
│                              │  ┌───────────▼─────────────┐   │     │     │
│                              │  │  Analytics Worker       │   │     │     │
│                              │  │  (analytics queue)      │   │     │     │
│                              │  └─────────────────────────┘   │     │     │
│                              └───────────┬─────────────────────┘     │     │
│                                          │                           │     │
│                              ┌───────────▼────────────────────┐     │     │
│                              │   Python ML Service (:8000)    │     │     │
│                              │   FastAPI · Pandas · sklearn   │     │     │
│                              └────────────────────────────────┘     │     │
│                                                                      │     │
└──────────────────────────────────────────────────────────────────────┘     │
                                                                              │
```

---

## 3. Services

### 3.1 Frontend — `apps/web`

**Technology:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Recharts

**Responsibilities:**

- User authentication UI (login, register, token refresh)
- Job submission form with file upload
- Real-time job status dashboard (WebSocket subscription)
- Job history with logs and results
- Admin dashboard: worker status, queue metrics, system health
- Charts for job throughput, error rates, processing times

**Communication:**

- REST API calls to NestJS backend (via TanStack Query)
- WebSocket connection to NestJS Socket.IO gateway for real-time events

**Key pages:**

```
/                          → Landing / redirect
/auth/login               → Login page
/auth/register            → Registration page
/dashboard                → User job dashboard
/jobs/new                 → Job submission
/jobs/[id]                → Job detail with live logs
/admin                    → Admin overview
/admin/workers            → Worker status
/admin/queues             → Queue metrics
```

---

### 3.2 Backend API — `apps/api`

**Technology:** NestJS 10, TypeScript, Prisma, Socket.IO, BullMQ

**Responsibilities:**

- REST API for all frontend interactions
- JWT-based authentication (access + refresh tokens)
- Role-based access control (USER, ADMIN, WORKER)
- Job lifecycle management (create, cancel, query)
- File upload handling and validation
- Enqueuing jobs onto BullMQ queues
- WebSocket gateway for real-time event broadcasting
- Worker registration and heartbeat reception
- Health check and metrics endpoints

**NestJS Module Breakdown:**

```
AppModule
├── AuthModule          # JWT, guards, strategies, refresh tokens
├── UsersModule         # User CRUD, password hashing
├── JobsModule          # Job lifecycle, file uploads
├── QueueModule         # BullMQ producers, queue inspection
├── WorkersModule       # Worker registry, heartbeat, health
├── WebSocketModule     # Socket.IO gateway, event broadcasting
├── PrismaModule        # Database connection
├── HealthModule        # Healthchecks (/health)
├── MetricsModule       # Prometheus metrics (/metrics)
└── LoggerModule        # Structured logging (Pino)
```

**API Route Groups:**

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /users/me
PATCH  /users/me

POST   /jobs
GET    /jobs
GET    /jobs/:id
DELETE /jobs/:id
GET    /jobs/:id/logs
GET    /jobs/:id/result

GET    /admin/workers
GET    /admin/queues
GET    /admin/jobs

GET    /health
GET    /metrics
```

---

### 3.3 ML Service — `apps/ml-service`

**Technology:** Python 3.12, FastAPI, Pydantic, Pandas, Scikit-learn, Uvicorn

**Responsibilities:**

- Execute CPU/memory-intensive ML and data tasks in isolation
- Provide a clean HTTP API for workers to call
- Return structured results and logs
- Sandboxed from the main API — workers call it directly

**Why isolated?** ML libraries have large footprints, different runtime requirements, and can crash or consume unbounded resources. Isolation limits blast radius and allows independent scaling.

**Endpoints:**

```
POST   /tasks/data-process
POST   /tasks/train-model
POST   /tasks/predict
POST   /tasks/analyze
GET    /health
```

**Authentication:** Internal API key (`X-Internal-API-Key` header) — not exposed to end users.

---

### 3.4 Processor Worker — `workers/processor`

**Technology:** NestJS standalone app, BullMQ processor

**Responsibilities:**

- Consumes jobs from `default`, `ml-processing`, `ai-processing` queues
- Manages the job processing lifecycle (state transitions, logging)
- Calls Python ML service for compute-heavy tasks
- Reports progress back via direct Redis events
- Emits completion/failure events consumed by the API WebSocket gateway

---

### 3.5 Analytics Worker — `workers/analytics`

**Technology:** NestJS standalone app, BullMQ processor

**Responsibilities:**

- Consumes jobs from `analytics` queue
- Runs aggregation tasks, report generation, scheduled summaries
- Writes results to PostgreSQL

---

## 4. Data Flow — Job Submission

```
Client                API                 PostgreSQL    Redis/BullMQ    Worker         ML Service
  │                    │                      │              │             │               │
  │─── POST /jobs ────►│                      │             │             │               │
  │                    │── INSERT Job ───────►│             │             │               │
  │                    │◄── job_id ───────────│             │             │               │
  │                    │── ENQUEUE job ───────────────────►│             │               │
  │                    │                      │             │             │               │
  │◄── 201 job_id ─────│                      │             │             │               │
  │                    │                      │             │             │               │
  │  [WS: job.queued]◄─│                      │             │             │               │
  │                    │                      │             │             │               │
  │                    │                      │             │─ DEQUEUE ──►│               │
  │                    │                      │             │             │── PATCH status►│
  │                    │                      │◄── PROCESSING ───────────│               │
  │                    │                      │             │             │               │
  │  [WS: job.started]◄─── event ────────────│             │             │               │
  │                    │                      │             │             │── POST /tasks►│
  │                    │                      │             │             │◄── result ────│
  │                    │                      │             │             │               │
  │                    │                      │◄── COMPLETED ────────────│               │
  │                    │                      │             │             │               │
  │  [WS: job.completed]◄─── event ──────────│             │             │               │
  │                    │                      │             │             │               │
```

---

## 5. Communication Patterns

| From → To           | Protocol              | Auth             |
| ------------------- | --------------------- | ---------------- |
| Browser → API       | HTTPS REST            | JWT Bearer       |
| Browser → API       | WebSocket (Socket.IO) | JWT handshake    |
| API → PostgreSQL    | TCP (Prisma)          | DB credentials   |
| API → Redis         | TCP                   | Redis password   |
| Worker → Redis      | TCP (BullMQ)          | Redis password   |
| Worker → API        | HTTP (status updates) | Internal API key |
| Worker → ML Service | HTTP                  | Internal API key |
| Worker → PostgreSQL | TCP (Prisma)          | DB credentials   |

---

## 6. Cross-Cutting Concerns

### 6.1 Request IDs

Every inbound HTTP request receives a `X-Request-ID` header (generated if not provided). This ID propagates through logs, database records, and queue job metadata. Workers inherit the correlation ID from the job payload.

### 6.2 Structured Logging

All services log in JSON format (Pino for Node.js, structlog for Python). Log fields always include: `timestamp`, `level`, `service`, `requestId`, `correlationId`, `userId` (when authenticated).

### 6.3 Error Handling

- **API layer:** NestJS exception filters catch all errors, return standardized JSON error responses.
- **Queue layer:** BullMQ built-in retry with exponential backoff. Failed jobs move to dead-letter queue.
- **Worker layer:** Uncaught exceptions are caught, job marked FAILED, error written to `JobLog`.
- **ML Service:** HTTP errors propagate back to worker, which handles retry logic.

### 6.4 Graceful Shutdown

All services handle `SIGTERM` / `SIGINT`:

- API: drains active WebSocket connections, closes HTTP server
- Workers: finishes current job, does not accept new jobs, closes queue connections
- ML Service: completes in-flight requests, shuts down Uvicorn

---

## 7. Security Boundaries

```
Public Internet
      │
  [ TLS termination — Nginx/Load Balancer ]
      │
  [ Next.js Frontend ] ── same-origin only
      │
  [ NestJS API ] ← JWT required for all non-auth routes
      │
  ┌───┴────────────────────────────────┐
  │  Internal Network (Docker network) │
  │                                    │
  │  PostgreSQL  Redis  Workers  ML    │
  │  (no public exposure)              │
  └────────────────────────────────────┘
```

- PostgreSQL, Redis, Workers, and ML Service are **never publicly exposed**.
- ML Service requires an internal API key.
- RBAC guards on all admin routes.

---

## 8. Scalability Considerations

| Concern             | Strategy                                                |
| ------------------- | ------------------------------------------------------- |
| High job volume     | Scale worker replicas horizontally                      |
| API throughput      | Stateless API — scale horizontally behind load balancer |
| Database bottleneck | Read replicas, connection pooling (PgBouncer)           |
| Queue pressure      | Prioritized queues, multiple worker instances           |
| ML compute          | Scale ML service independently, consider GPU nodes      |

---

## 9. Technology Decisions

See Architecture Decision Records:

- [ADR-001 — PostgreSQL](decisions/ADR-001-postgresql.md)
- [ADR-002 — Redis + BullMQ](decisions/ADR-002-redis-bullmq.md)
- [ADR-003 — Python ML Service](decisions/ADR-003-python-ml-service.md)
- [ADR-004 — WebSockets](decisions/ADR-004-websockets.md)
- [ADR-005 — Monorepo](decisions/ADR-005-monorepo.md)
- [ADR-006 — Worker-based async processing](decisions/ADR-006-async-workers.md)
