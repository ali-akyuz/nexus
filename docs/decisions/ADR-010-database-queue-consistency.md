# ADR-010: Database/Queue Consistency Strategy

## Status
Accepted

## Context
NEXUS uses PostgreSQL as the persistent source of truth and Redis (BullMQ) for high-throughput message passing. Submitting a job requires writing to both systems. If one succeeds and the other fails, the system enters an inconsistent state (e.g., a "ghost job" in the DB that is never processed, or a queued job that the DB knows nothing about).

## Decisions

1. **PostgreSQL First (Outbox Pattern variant):**
   - The API will always write the `Job` to PostgreSQL first with status `QUEUED`.
   - Then, it pushes the message to BullMQ.

2. **Failure Handling:**
   - If the BullMQ enqueue operation fails (e.g., Redis is down), the API immediately issues an update to PostgreSQL marking the job as `FAILED` with an internal error message.
   - This ensures the database accurately reflects that the job will never be executed.

3. **Queue Deduplication:**
   - We pass the PostgreSQL `Job.id` as the BullMQ `jobId` parameter. This leverages BullMQ's native deduplication so a job cannot exist twice in the queue simultaneously.

## Consequences
- Prevents infinite stuck jobs ("ghost jobs") in the UI.
- Simplifies recovery. If the API crashes between step 1 and 2, a cleanup cron (future phase) can identify `QUEUED` jobs older than X minutes and re-queue them.
