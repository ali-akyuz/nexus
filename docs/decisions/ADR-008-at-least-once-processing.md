# ADR-008: At-least-once Job Processing

## Status
Accepted

## Context
NEXUS background jobs run across distributed Worker nodes. In any distributed queue system (like BullMQ/Redis), network partitions, process crashes, or timeout events can result in a message being delivered to a worker more than once. We must define the processing guarantees for the system.

## Decisions

1. **Processing Guarantee:**
   - NEXUS guarantees **At-least-once** delivery. Exactly-once is impossible without distributed two-phase commits, which are unscalable.

2. **Idempotent Processing:**
   - Workers must assume they might receive the same job ID multiple times.
   - Before executing a job, the worker queries PostgreSQL for the job state.
   - If the job is `COMPLETED` or `CANCELLED`, the worker skips execution and returns successfully.
   - If the job is `PROCESSING` but assigned to a dead worker, it can be re-claimed.

## Consequences
- Workers are protected against duplicate execution caused by message redelivery.
- A slight overhead is incurred by querying PostgreSQL before processing, but this is negligible and guarantees correctness.
