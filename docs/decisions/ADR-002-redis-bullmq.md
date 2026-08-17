# ADR-002 — Use Redis + BullMQ for Job Queuing

**Status:** Accepted  
**Date:** 2026-08-17  
**Deciders:** Architecture team

---

## Context

NEXUS requires an asynchronous job queue that supports:

- Multiple named queues with different characteristics
- Job priority (higher-priority jobs processed first)
- Retry with exponential backoff
- Job progress reporting
- Delayed/scheduled jobs
- Stalled job detection (worker crash recovery)
- Dead-letter semantics for exhausted retries
- At-least-once delivery with idempotency guards

The queue must be durable (survive restarts), observable (metrics, job inspection), and horizontally scalable (multiple workers).

---

## Decision

Use **Redis 7** as the queue store and **BullMQ 5** as the queue library.

---

## Alternatives Considered

### RabbitMQ

- **Pro:** Purpose-built message broker, supports multiple protocols (AMQP), strong routing features, good dead-letter exchange support.
- **Con:** Heavier operational footprint than Redis. More complex to set up and operate. BullMQ's feature set (priority, progress, stall detection) maps more naturally to the NEXUS job model. RabbitMQ's job scheduling (delayed messages) requires a plugin.
- **Decision:** Rejected. The operational simplicity of Redis+BullMQ and its richer job-lifecycle API are more appropriate for this use case.

### Apache Kafka

- **Pro:** High throughput, log retention, exactly-once semantics with proper configuration, replay capability.
- **Con:** Significant operational complexity (ZooKeeper or KRaft, topic partition management). Kafka is designed for event streams, not task queues. Implementing job lifecycle features (retry, priority, progress) on top of Kafka requires significant custom code. Massive overkill for the initial scale.
- **Decision:** Rejected. Kafka is the right choice for event streaming at scale, not for a job queue platform at this stage.

### AWS SQS + Lambda

- **Pro:** Fully managed, auto-scaling, no infrastructure to run.
- **Con:** Vendor lock-in. Cannot run locally without localstack. Priority queues require separate SQS queues (no native priority within a queue). Limited job metadata and inspection capabilities.
- **Decision:** Rejected. Local development and infrastructure independence are first-class requirements.

### PostgreSQL as Queue (PGMQ / SKIP LOCKED)

- **Pro:** No additional infrastructure. Uses the existing PostgreSQL instance. ACID job state management.
- **Con:** Polling-based, not event-driven. High write amplification. Not designed for high-throughput job queuing. No built-in retry, priority, or progress tracking.
- **Decision:** Rejected. PostgreSQL is used to store job state, but is not suited for the queue mechanics itself.

---

## Consequences

**Positive:**

- BullMQ provides all required features out of the box: priority, retry with backoff, delayed jobs, progress events, stall detection, job inspection API.
- Redis is extremely fast (in-memory) and well-understood.
- Single Redis instance is sufficient for development and moderate production load.
- BullMQ's Bull Board provides an admin UI for queue inspection with minimal setup.
- Redis is already used for caching and rate limiting in many NestJS projects — reusing infrastructure.

**Negative:**

- Redis is in-memory — data loss is possible if AOF persistence is not configured correctly. **Mitigation:** Enable `appendonly yes` and `appendfsync everysec` in Redis config.
- At-least-once delivery means idempotency must be implemented in workers.
- Redis single-node is a potential SPOF. **Mitigation:** Redis Sentinel or Cluster for production HA.
- BullMQ's `failed` job list is a Redis list, not a true DLQ — requires custom sweep to sync with PostgreSQL.

---

## Notes

- BullMQ uses Redis Streams internally for the active/completed/failed queues — this is more reliable than the older Bull library's list-based approach.
- Workers use BullMQ's built-in `lockDuration` + lock renewal to detect stalled jobs (worker crash recovery).
- Redis AOF persistence is mandatory for production.
