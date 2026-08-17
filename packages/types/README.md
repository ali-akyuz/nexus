# @nexus/types

> **Status:** Phase 0 — Placeholder  
> Implementation begins in Phase 2+.

## Description

Shared TypeScript types, interfaces, and Zod schemas used across the API, workers, and frontend.

**This package is the single source of truth for all shared data contracts.**

Contains:

- Job types and enums (JobStatus, JobType)
- API request/response DTOs
- WebSocket event payloads
- Queue payload types
- User types

## Structure (planned)

```
packages/types/
├── src/
│   ├── jobs.ts            # Job types, enums, DTOs
│   ├── users.ts           # User types
│   ├── workers.ts         # Worker types
│   ├── queues.ts          # Queue payload types
│   ├── websocket.ts       # WebSocket event types
│   └── index.ts
├── tsconfig.json
└── package.json
```

## Design Principles

- All types are plain TypeScript interfaces + `const` enums where needed.
- Zod schemas are co-located with their types for runtime validation.
- No runtime dependencies — pure types only (except Zod).
