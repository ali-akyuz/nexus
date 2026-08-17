# ADR-004 — Use WebSockets (Socket.IO) for Real-Time Updates

**Status:** Accepted  
**Date:** 2026-08-17  
**Deciders:** Architecture team

---

## Context

NEXUS users need to see job progress in real time without manually refreshing the page. Job state changes (QUEUED → PROCESSING → COMPLETED), progress percentages, and log entries must appear in the UI as they happen. The update frequency can be high (multiple log lines per second during ML tasks).

The question is: what mechanism should the platform use to push updates from the server to the client?

---

## Decision

Use **Socket.IO 4** running inside the NestJS API for real-time bidirectional communication.

---

## Alternatives Considered

### HTTP Polling

- **Pro:** Simple to implement. Works through all proxies. No persistent connection.
- **Con:** High latency (1–30 seconds depending on poll interval). Wastes server resources and bandwidth (most polls return nothing). Terrible UX for a "live" progress indicator.
- **Decision:** Rejected for the primary update mechanism. May be used as a fallback or for non-critical updates.

### Server-Sent Events (SSE)

- **Pro:** Simple HTTP-based push. One-way (server → client), which matches the primary use case. Works through HTTP/2 multiplexing. No custom library needed.
- **Con:** HTTP/1.1 limits connections per domain (6 max), though HTTP/2 removes this. One-way only — cannot handle client subscriptions (which rooms to join) without a separate REST call. Less native support for reconnection state management. NestJS SSE support is more limited than Socket.IO.
- **Decision:** Rejected. Socket.IO's room-based broadcasting, reconnection handling, and bidirectional capability are worth the added complexity.

### Raw WebSockets (ws library)

- **Pro:** Lightweight, no library overhead.
- **Con:** No built-in rooms, reconnection, or fallback. Must implement these features manually. NestJS's `@WebSocketGateway` works natively with Socket.IO, providing decorators for events and rooms.
- **Decision:** Rejected in favor of Socket.IO which adds rooms, reconnection, and event semantics with minimal overhead.

### GraphQL Subscriptions

- **Pro:** Strongly typed event schema. Integrates naturally if GraphQL is already used.
- **Con:** NEXUS uses REST API, not GraphQL. Adding GraphQL subscriptions only for real-time would introduce a second API paradigm with significant complexity.
- **Decision:** Rejected. REST + Socket.IO is a cleaner architecture than REST + GraphQL subscriptions.

---

## Consequences

**Positive:**

- Sub-100ms latency for job updates and log streaming.
- Room-based broadcasting: job events go only to users who care about that job.
- Built-in reconnection with automatic room re-subscription support.
- NestJS `@WebSocketGateway` provides clean decorator-based event handling.
- Socket.IO supports HTTP long-polling fallback for restricted network environments.
- The admin dashboard can subscribe to system-level events via the `admin` room.

**Negative:**

- Persistent connections consume server memory (one connection per browser tab).
- Requires sticky sessions or Redis adapter when the API is horizontally scaled (multiple API instances).
  - **Mitigation:** Use `@socket.io/redis-adapter` with the existing Redis instance.
- WebSocket connections must be authenticated — requires JWT validation on handshake.
- Socket.IO adds ~50KB to the client bundle (can be mitigated with tree-shaking).

---

## Notes

- For horizontal scaling (Phase 10+), `@socket.io/redis-adapter` broadcasts events across all API instances via Redis pub/sub. No code changes required in event emission logic.
- Socket.IO is chosen over `ws` specifically for its room management, which is essential for scoping job events to their owners.
