# ADR-006 — Worker-Based Asynchronous Job Processing

**Status:** Accepted  
**Date:** 2026-08-17  
**Deciders:** Architecture team

---

## Context

NEXUS must process ML and data jobs that can take anywhere from 1 second to 60+ minutes. These jobs involve:

- CPU-intensive computation (model training, data transformations)
- I/O-intensive operations (reading/writing large files)
- External service calls (Python ML service)
- Operations that must not block the HTTP API

The question is: should jobs be processed synchronously in the API request handler, or asynchronously by separate worker processes?

---

## Decision

All non-trivial jobs are processed **asynchronously by dedicated worker processes**, decoupled from the HTTP API via a Redis/BullMQ queue.

---

## Alternatives Considered

### Synchronous processing in the HTTP handler

- **Pro:** Simple implementation. No queue infrastructure. Immediate response with results.
- **Con:** HTTP connections time out after 30–120 seconds (client and proxy limits). Blocks the Node.js event loop for CPU-bound tasks, degrading API responsiveness. No retry on failure. No progress reporting. Cannot scale processing independently of the API. Fundamentally breaks for any job > 30 seconds.
- **Decision:** Rejected outright. Synchronous processing is incompatible with jobs that run for minutes.

### Asynchronous processing using async threads/fork in the API process

- **Pro:** No separate worker service. Simpler deployment.
- **Con:** Worker threads in Node.js share the same process memory — a crash or memory leak in a job can affect the API. Cannot scale workers independently of the API. Job state management becomes complex without a proper queue. No isolation between jobs.
- **Decision:** Rejected. Process isolation is a hard requirement for reliability.

### Serverless functions (AWS Lambda, Google Cloud Functions)

- **Pro:** Auto-scaling, pay-per-use, no server management.
- **Con:** Cold start latency is unacceptable for ML jobs. Execution time limits (15 minutes for Lambda) may be too short for training jobs. Requires significant cloud infrastructure change. Cannot run locally without additional tooling. Vendor lock-in.
- **Decision:** Rejected. Not compatible with the local-first, Docker Compose development model.

### Celery (Python task queue)

- **Pro:** Mature Python task queue, deep integration with Python ML libraries.
- **Con:** Requires Python workers, which cannot consume BullMQ queues. Would require a second queue system (Celery + Redis or RabbitMQ) alongside BullMQ. Splits the job orchestration logic between two systems. The job lifecycle, retry logic, and WebSocket events are better managed in the unified NestJS worker.
- **Decision:** Rejected. The worker calls the Python ML service via HTTP — Python doesn't need to own the queue.

---

## Consequences

**Positive:**

- Jobs run in isolated worker processes — a crashed job cannot affect the API.
- Workers can be scaled independently: `docker compose up --scale worker-processor=10`.
- The queue provides a buffer against traffic spikes: jobs wait in the queue when workers are busy.
- BullMQ handles retry, backoff, stall detection, and dead-letter semantics.
- Workers send real-time progress updates via the API's WebSocket gateway.
- Worker failures are recoverable: BullMQ re-queues stalled jobs automatically.
- The API responds immediately to job submission (202 Accepted + jobId) — users get instant feedback.

**Negative:**

- Eventual consistency: the user submits a job and must wait for a worker to pick it up.
- Added infrastructure: Redis + worker processes must be deployed and monitored.
- Debugging distributed failures (API → queue → worker → ML service) requires good observability.
- Job ordering is not guaranteed within the same priority level (FIFO within a priority level, but not across priority levels).

---

## Notes

- The "worker" in NEXUS is a NestJS standalone application (not a NestJS module in the API). This provides full process isolation.
- Workers have their own Prisma connections to PostgreSQL for job status updates.
- The Worker → API communication pattern (HTTP heartbeat + status update) avoids the need for workers to have a WebSocket connection, keeping the architecture simple.
- The `WORKER` role in RBAC allows workers to call protected internal API endpoints without user credentials.
