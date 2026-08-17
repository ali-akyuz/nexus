# ADR-011: WebSocket Realtime Architecture

## Status
Accepted

## Context
NEXUS requires real-time updates for job state, progress, and logs so that the frontend does not have to aggressively poll the API. The workers are isolated applications that update PostgreSQL and use BullMQ (Redis) for processing. We need a way to propagate these background changes to connected frontend WebSocket clients.

## Decisions

1. **Gateway Isolation:**
   - The WebSocket server (Socket.IO) resides entirely within `apps/api`.
   - The worker (`workers/processor`) remains headless and never communicates directly with WebSockets.

2. **BullMQ QueueEvents Bridge:**
   - The API uses `QueueEvents` from BullMQ to listen to global Redis events emitted by the worker (e.g., `active`, `progress`, `completed`, `log`).
   - When the API hears a raw queue event, it queries PostgreSQL to fetch the latest state of the job.
   - This ensures the API only broadcasts verified state (Postgres is the source of truth), preventing the UI from showing ghost states if a database transaction failed.

3. **Domain Event Translation:**
   - Raw queue events are translated into standard Domain Events (`job.started`, `job.progress`, `job.completed`) before reaching the client.

4. **Strict Authentication & Rooms:**
   - Clients must authenticate on connection via JWT.
   - Users are placed in a `user:{userId}` room.
   - Clients must explicitly request to join `job:{jobId}` via the `subscribeToJob` message.
   - The Gateway queries the database to authorize the subscription request (must be owner or Admin).

## Consequences
- Clean separation of concerns between WebSockets (API) and Processing (Workers).
- Highly consistent UI updates thanks to the DB re-verification step in `queue-events.listener.ts`.
- Zero polling on the frontend.
