# NEXUS — Queue Architecture

> **Document status:** Phase 0 — Design  
> **Last updated:** 2026-08-17  
> **Queue system:** Redis 7 + BullMQ 5

---

## 1. Overview

NEXUS uses **BullMQ** built on top of **Redis** for all asynchronous job processing. BullMQ provides:

- Priority queues
- Atomic job dequeuing (no double-processing under normal operation)
- Built-in retry with configurable backoff
- Job events (active, completed, failed, stalled)
- Delayed jobs
- Rate limiting
- Job deduplication (via custom job IDs)
- Dead-letter queue semantics via the `failed` state

Redis is used exclusively for queue data. Persistent application state lives in PostgreSQL.

---

## 2. Queue Definitions

### 2.1 `default`

**Purpose:** General-purpose job processing for jobs that do not require ML compute.

**Example payloads:** File validation, format conversion, CSV parsing, notification dispatch.

```typescript
interface DefaultQueuePayload {
  jobId: string; // NEXUS job UUID
  userId: string; // Submitting user UUID
  correlationId: string; // Request tracing ID
  type: JobType;
  inputPayload: Record<string, unknown>;
  inputFileUrl?: string;
  timeoutMs: number;
}
```

**Retry strategy:** 3 attempts, exponential backoff starting at 2 seconds.  
**Timeout:** 5 minutes per job.  
**Priority:** 0 (default).  
**Failure behavior:** After maxAttempts, job moves to BullMQ `failed` state. NEXUS marks Job.status = FAILED.

---

### 2.2 `ml-processing`

**Purpose:** Jobs requiring ML model inference or data science computation via the Python ML Service.

**Example payloads:** Model predictions, feature engineering, data transformations.

```typescript
interface MlProcessingQueuePayload {
  jobId: string;
  userId: string;
  correlationId: string;
  type: 'PREDICTION' | 'DATA_PROCESSING';
  modelName?: string;
  inputPayload: Record<string, unknown>;
  inputFileUrl?: string;
  timeoutMs: number;
}
```

**Retry strategy:** 3 attempts, exponential backoff starting at 5 seconds.  
**Timeout:** 15 minutes per job.  
**Priority:** 0–10 (higher = processed first, set per job).  
**Failure behavior:** After maxAttempts, job marked FAILED. Error + stack written to JobLog.

---

### 2.3 `ai-processing`

**Purpose:** Long-running AI tasks — model training, fine-tuning, large-scale batch inference.

**Example payloads:** Training runs, evaluation pipelines.

```typescript
interface AiProcessingQueuePayload {
  jobId: string;
  userId: string;
  correlationId: string;
  type: 'MODEL_TRAINING';
  modelConfig: Record<string, unknown>;
  datasetUrl: string;
  timeoutMs: number;
  checkpointEnabled: boolean;
}
```

**Retry strategy:** 2 attempts, exponential backoff starting at 10 seconds.  
**Timeout:** 60 minutes per job.  
**Priority:** 0–5.  
**Failure behavior:** After maxAttempts, job marked FAILED. Partial checkpoints preserved if enabled.

---

### 2.4 `analytics`

**Purpose:** Analytics and reporting tasks — aggregations, dashboard data generation, scheduled reports.

**Example payloads:** Daily report generation, usage summaries, system health aggregations.

```typescript
interface AnalyticsQueuePayload {
  jobId: string;
  userId: string;
  correlationId: string;
  type: 'ANALYTICS';
  reportType: string;
  dateRange: { from: string; to: string };
  filters?: Record<string, unknown>;
  timeoutMs: number;
}
```

**Retry strategy:** 2 attempts, fixed delay of 30 seconds.  
**Timeout:** 10 minutes per job.  
**Priority:** 0 (analytics are best-effort, never high priority).  
**Failure behavior:** After maxAttempts, job marked FAILED. No alert unless report is user-requested.

---

## 3. Retry Strategy

### Configuration per queue

```typescript
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // First retry after 2s, then 4s, then 8s
  },
  removeOnComplete: {
    count: 1000, // Keep last 1000 completed jobs in Redis
    age: 3600, // Or jobs older than 1 hour
  },
  removeOnFail: {
    count: 500,
  },
};
```

### Backoff schedule example (exponential, base 2000ms)

| Attempt                | Wait before retry |
| ---------------------- | ----------------- |
| 1st                    | Immediate         |
| 2nd                    | ~2 seconds        |
| 3rd                    | ~4 seconds        |
| 4th (if maxAttempts=4) | ~8 seconds        |

### Jitter

Add ±10% random jitter to all retry delays to prevent thundering herd when multiple jobs fail simultaneously.

---

## 4. Job Deduplication & Idempotency

### Problem

BullMQ can deliver a job more than once in rare circumstances (worker crash mid-acknowledgment).

### Strategy

1. **Idempotent job processing:** Workers check Job.status before beginning work. If status is already PROCESSING or COMPLETED, the job is skipped with a log warning.
2. **Custom BullMQ job IDs:** For jobs where idempotency is critical (e.g., "process file X"), set `jobId` as a hash of the content to prevent duplicate enqueue.
3. **Database-side guard:** The `bull_job_id` column is `@unique`. Any attempt to enqueue the same BullMQ job twice throws a database constraint error.

---

## 5. Dead-Letter Handling

BullMQ itself does not have a separate dead-letter queue concept — failed jobs (after max retries) remain in the `failed` list in Redis. NEXUS adds:

1. A periodic job (every 5 minutes) that reads failed BullMQ jobs and syncs their status to PostgreSQL.
2. Admin API endpoint `GET /admin/queues/:name/failed` to list and inspect dead-letter jobs.
3. Admin API endpoint `POST /admin/queues/:name/jobs/:bullJobId/retry` to manually re-enqueue a failed job (creates a new NEXUS Job record to preserve audit trail).

---

## 6. Priority Queue Behavior

BullMQ supports integer priority (higher number = lower priority, i.e., 1 is processed before 10).

NEXUS maps user-facing priority to BullMQ priority:

| User Priority | BullMQ Priority | Description                   |
| ------------- | --------------- | ----------------------------- |
| CRITICAL      | 1               | Reserved for system jobs      |
| HIGH          | 3               | Premium users, time-sensitive |
| NORMAL        | 5               | Default                       |
| LOW           | 8               | Background, best-effort       |

Priority is enforced per-queue. A LOW job in `ml-processing` will still be processed before a NORMAL job in `default` if a worker is dedicated to `ml-processing`.

---

## 7. Job Timeout Strategy

### Per-job timeout

Each job has a `timeoutAt` timestamp set at enqueue time:

```
timeoutAt = enqueuedAt + queue.timeoutMs
```

### Enforcement

1. **BullMQ stall detection:** BullMQ has a `lockDuration` concept. If a worker does not renew its lock within `lockDuration` (default: 30s), the job is considered stalled and re-queued.
2. **Application-level timeout:** Workers check `job.timeoutAt` before starting and periodically during execution. If exceeded, the job is gracefully aborted.
3. **Cleanup sweep:** A periodic API task checks for PROCESSING jobs where `timeoutAt < now()` and marks them FAILED with reason `JOB_TIMEOUT`.

---

## 8. Queue Metrics

The following metrics are tracked per queue (via BullMQ's built-in events + custom listeners):

| Metric                    | Description                                   |
| ------------------------- | --------------------------------------------- |
| `queue.waiting`           | Jobs waiting to be picked up                  |
| `queue.active`            | Jobs currently being processed                |
| `queue.completed`         | Jobs completed (in Redis, sliding window)     |
| `queue.failed`            | Jobs in failed state                          |
| `queue.delayed`           | Jobs waiting for retry delay                  |
| `queue.throughput`        | Jobs completed per minute                     |
| `queue.avg_wait_ms`       | Average time from enqueue to processing start |
| `queue.avg_processing_ms` | Average processing duration                   |

Metrics are exposed via `/metrics` endpoint in Prometheus format.

---

## 9. Redis Configuration Recommendations

```
# Persistence: Enable AOF for queue durability
appendonly yes
appendfsync everysec

# Memory policy: Never evict keys (queues must not be silently lost)
maxmemory-policy noeviction

# Notify worker health checks
notify-keyspace-events "Ex"   # Expired key events

# Recommended max memory: 2GB for development, 8GB+ for production
maxmemory 2gb
```

---

## 10. Queue Pause / Resume

Admin users can pause individual queues via:

```
POST /admin/queues/:name/pause
POST /admin/queues/:name/resume
```

When paused:

- New jobs are still accepted and stored as QUEUED in PostgreSQL.
- Workers do not dequeue from the paused queue.
- The `Queue.isPaused` flag is updated in PostgreSQL for persistence across restarts.

---

## 11. Horizontal Scaling

Workers are stateless consumers. Scaling is achieved by:

1. Increasing worker replica count in Docker Compose or Kubernetes.
2. Each worker registers itself in the `Worker` table with a unique `instanceId`.
3. BullMQ guarantees a job is processed by exactly one worker at a time (via Redis `SET NX` locking).
4. Workers on the same queue share load automatically.

No additional coordination is needed between worker instances.
