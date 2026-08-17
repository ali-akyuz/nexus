# ADR-009: Job Idempotency Strategy

## Status
Accepted

## Context
Clients may experience network timeouts when submitting a job. If they retry the request, they could accidentally create duplicate jobs in the system, wasting computing resources and potentially charging users multiple times.

## Decisions

1. **Idempotency Key:**
   - Clients may optionally provide an `idempotencyKey` in the `POST /jobs` request payload.
   
2. **Uniqueness Constraint:**
   - We enforce a composite `@@unique([userId, idempotencyKey])` constraint at the PostgreSQL database level.

3. **Behavior:**
   - Before inserting, the API checks for an existing record with the same `userId` and `idempotencyKey`.
   - If found, the API returns the **existing job** instead of creating a new one or throwing an error.
   - If not found, a new job is created and queued.

## Consequences
- Clients can safely retry API requests without fearing duplicate execution.
- The constraint prevents race conditions if a client sends two parallel identical requests.
