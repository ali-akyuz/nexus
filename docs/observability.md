# NEXUS — Observability Strategy

> **Document status:** Phase 0 — Design  
> **Last updated:** 2026-08-17

---

## 1. Philosophy

Observability is not an afterthought. NEXUS is designed so that on any failure the engineering team can answer:

1. **What happened?** (structured logs)
2. **When and how often?** (metrics)
3. **Where did it start?** (correlation IDs, distributed tracing)
4. **Is the system healthy now?** (health checks)

---

## 2. Structured Logging

### 2.1 Format

All services log in **JSON** format. Human-readable formatting is only used in local development (via pretty-printers).

**Mandatory log fields:**

```json
{
  "timestamp": "2026-08-17T20:00:00.000Z",
  "level": "info",
  "service": "api",
  "version": "0.1.0",
  "requestId": "req_01J5X...",
  "correlationId": "corr_01J5X...",
  "userId": "uuid-or-null",
  "message": "Job created successfully",
  "jobId": "uuid",
  "durationMs": 42
}
```

**Log levels:**

| Level   | When to use                                                                  |
| ------- | ---------------------------------------------------------------------------- |
| `debug` | Detailed diagnostic data — only in development                               |
| `info`  | Normal operational events (job created, user logged in)                      |
| `warn`  | Unexpected but recoverable conditions (retry attempt, stale worker detected) |
| `error` | Errors that require attention (job failed, service unreachable)              |

### 2.2 Node.js Logging (API + Workers)

**Library:** [Pino](https://getpino.io) — fastest JSON logger for Node.js

```typescript
// Logger setup
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'api',
    version: process.env.APP_VERSION,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

**NestJS integration:** Custom `LoggerService` wrapping Pino, injected into all modules.

### 2.3 Python Logging (ML Service)

**Library:** [structlog](https://www.structlog.org) with JSON renderer

```python
import structlog

logger = structlog.get_logger().bind(
    service="ml-service",
    version=settings.app_version,
)
```

### 2.4 Log Context Propagation

Request ID and correlation ID are injected into the log context at the beginning of each request and propagated through async operations using `AsyncLocalStorage` (Node.js) or context variables (Python).

---

## 3. Request IDs & Correlation IDs

### Definitions

| ID              | Set by                     | Scope                | Purpose                                      |
| --------------- | -------------------------- | -------------------- | -------------------------------------------- |
| `requestId`     | API on inbound request     | Single HTTP request  | Trace a single REST call                     |
| `correlationId` | Client (or API if missing) | Entire job lifecycle | Trace a job from creation through processing |

### Flow

```
Client → POST /jobs
  └── X-Correlation-ID: client-generated-id (optional)
  └── API generates X-Request-ID: req_abc123

API logs: { requestId: "req_abc123", correlationId: "client-generated-id" }

Job stored: Job.correlationId = "client-generated-id"

BullMQ payload: { correlationId: "client-generated-id", requestId: "req_abc123" }

Worker logs: { correlationId: "client-generated-id" }

ML Service call: X-Correlation-ID: client-generated-id
ML Service logs: { correlationId: "client-generated-id" }
```

All logs for a single job lifecycle share the same `correlationId`, enabling end-to-end tracing via a log query.

---

## 4. Health Checks

### 4.1 API Health Endpoint

```
GET /health
```

**Response (healthy):**

```json
{
  "status": "ok",
  "timestamp": "2026-08-17T20:00:00.000Z",
  "uptime": 3600,
  "version": "0.1.0",
  "checks": {
    "database": { "status": "ok", "responseMs": 3 },
    "redis": { "status": "ok", "responseMs": 1 },
    "mlService": { "status": "ok", "responseMs": 45 }
  }
}
```

**Response (degraded):**

```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "error", "error": "Connection refused" },
    "mlService": { "status": "ok" }
  }
}
```

HTTP status: `200` for ok, `503` for degraded/down.

**Implementation:** `@nestjs/terminus` with custom health indicators.

### 4.2 ML Service Health

```
GET /health
```

```json
{
  "status": "ok",
  "models_loaded": ["default-classifier", "regression-v1"],
  "gpu_available": false
}
```

### 4.3 Worker Health

Workers report health via heartbeat (see `workers.md`). The admin dashboard shows worker health derived from `Worker.lastHeartbeatAt`.

---

## 5. Metrics

### 5.1 Exposition Format

**Prometheus text format** exposed at `GET /metrics` (API) and `GET /metrics` (ML Service).

### 5.2 API Metrics

| Metric                        | Type      | Labels                     | Description                  |
| ----------------------------- | --------- | -------------------------- | ---------------------------- |
| `http_requests_total`         | Counter   | method, route, status_code | Total HTTP requests          |
| `http_request_duration_ms`    | Histogram | method, route              | Request latency distribution |
| `jobs_created_total`          | Counter   | type, queue                | Jobs created                 |
| `jobs_completed_total`        | Counter   | type, queue                | Jobs completed               |
| `jobs_failed_total`           | Counter   | type, queue, reason        | Jobs failed                  |
| `jobs_cancelled_total`        | Counter   | type                       | Jobs cancelled               |
| `job_duration_ms`             | Histogram | type, queue                | Job processing duration      |
| `websocket_connections_total` | Gauge     | —                          | Active WS connections        |
| `auth_login_total`            | Counter   | success                    | Login attempts               |
| `auth_refresh_total`          | Counter   | success                    | Token refresh attempts       |

### 5.3 Worker Metrics

| Metric                        | Type      | Labels                 | Description                           |
| ----------------------------- | --------- | ---------------------- | ------------------------------------- |
| `worker_jobs_processed_total` | Counter   | worker_id, queue       | Jobs processed by this worker         |
| `worker_jobs_failed_total`    | Counter   | worker_id, queue       | Jobs failed by this worker            |
| `worker_job_duration_ms`      | Histogram | worker_id, queue, type | Per-worker job duration               |
| `worker_concurrency_used`     | Gauge     | worker_id              | Active concurrent job slots           |
| `worker_queue_wait_ms`        | Histogram | queue                  | Time from enqueue to processing start |

### 5.4 Queue Metrics (from BullMQ)

| Metric                   | Type    | Labels | Description                  |
| ------------------------ | ------- | ------ | ---------------------------- |
| `bullmq_queue_waiting`   | Gauge   | queue  | Jobs waiting to be picked up |
| `bullmq_queue_active`    | Gauge   | queue  | Jobs currently processing    |
| `bullmq_queue_completed` | Counter | queue  | Jobs completed (cumulative)  |
| `bullmq_queue_failed`    | Counter | queue  | Jobs failed (cumulative)     |
| `bullmq_queue_delayed`   | Gauge   | queue  | Jobs in delayed/retry state  |

### 5.5 ML Service Metrics

| Metric                      | Type      | Labels            | Description             |
| --------------------------- | --------- | ----------------- | ----------------------- |
| `ml_task_duration_ms`       | Histogram | task_type         | ML task processing time |
| `ml_tasks_total`            | Counter   | task_type, status | Total ML tasks          |
| `ml_model_load_duration_ms` | Histogram | model_name        | Model load time         |

---

## 6. Distributed Tracing (Planned)

For Phase 1, correlation IDs in logs provide basic tracing. In a later phase, **OpenTelemetry** instrumentation will provide full distributed traces:

- Trace spans: HTTP request → queue publish → worker consume → ML service call
- Exporters: Jaeger or Tempo
- Auto-instrumentation for NestJS, Prisma, BullMQ, FastAPI

---

## 7. Alerting Guidelines (Planned)

Alert conditions to configure in Prometheus + Alertmanager:

| Alert                      | Condition                                            | Severity |
| -------------------------- | ---------------------------------------------------- | -------- |
| High job failure rate      | `jobs_failed_total / jobs_created_total > 0.05` (5%) | Warning  |
| Queue backlog growing      | `bullmq_queue_waiting > 100` for 5 minutes           | Warning  |
| No workers alive           | All workers in STALE/OFFLINE                         | Critical |
| API error rate high        | `http_requests{status="5xx"} > 1%`                   | Warning  |
| Database connection failed | Health check fails                                   | Critical |
| Redis unavailable          | Health check fails                                   | Critical |

---

## 8. Local Development Observability

For local development (`docker compose up`):

| Tool        | URL                             | Purpose                |
| ----------- | ------------------------------- | ---------------------- |
| API health  | `http://localhost:3001/health`  | Health check           |
| API metrics | `http://localhost:3001/metrics` | Raw Prometheus metrics |
| ML health   | `http://localhost:8000/health`  | ML service health      |
| Pino-pretty | Console output                  | Human-readable logs    |

Production-grade Prometheus + Grafana dashboards are planned for Phase 10.
