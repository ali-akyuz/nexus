# ADR-001 — Use PostgreSQL as the Primary Database

**Status:** Accepted  
**Date:** 2026-08-17  
**Deciders:** Architecture team

---

## Context

NEXUS requires a durable, relational data store for users, jobs, job logs, workers, and results. The data model has clear relationships and integrity requirements (e.g., a job must belong to a user, a job log must belong to a job). The system must support complex queries (filter jobs by status + user + date range), enforce referential integrity, and provide ACID guarantees for job state transitions.

---

## Decision

Use **PostgreSQL 16** as the primary relational database, accessed via **Prisma ORM**.

---

## Alternatives Considered

### MongoDB

- **Pro:** Flexible schema, native JSON document storage useful for variable job payloads.
- **Con:** No ACID transactions across documents without careful design. Joins are cumbersome. Schema flexibility is not needed here — the data model is well-defined. Prisma support for MongoDB is less mature.
- **Decision:** Rejected. The structured relationships and ACID requirements outweigh the schema flexibility benefit.

### MySQL / MariaDB

- **Pro:** Familiar, widely supported, good performance.
- **Con:** Less feature-rich than PostgreSQL (e.g., JSONB support, array types, `gen_random_uuid()`, `pg_trgm`). The PostgreSQL ecosystem is stronger in the cloud-native world.
- **Decision:** Rejected in favor of PostgreSQL's richer feature set.

### CockroachDB (distributed SQL)

- **Pro:** Horizontally scalable, globally distributed.
- **Con:** Overkill for the initial platform scale. Adds operational complexity. Higher latency for single-region deployments.
- **Decision:** Rejected for now. Could be considered if global distribution is required.

---

## Consequences

**Positive:**

- ACID transactions ensure job state transitions are atomic.
- Strong typing with Prisma schema and TypeScript types.
- JSONB columns for flexible job payloads without sacrificing query capability.
- UUID support natively via `gen_random_uuid()`.
- Rich index types (B-tree, GiST, GIN) for future full-text search on job names/logs.
- Extensive cloud hosting options (RDS, Cloud SQL, Supabase, Neon).

**Negative:**

- Vertical scaling limit before needing read replicas or sharding.
- Schema migrations require care in production (Prisma migration files committed to git).
- Not ideal for unstructured or schema-less data at very large scale.

---

## Notes

- Prisma is used as the ORM for type-safe queries and migration management.
- UUID v4 primary keys (via `gen_random_uuid()`) — sortable UUIDs (v7) are a future optimization if insert performance becomes a concern.
- Connection pooling (PgBouncer) is planned for production to handle high connection counts.
