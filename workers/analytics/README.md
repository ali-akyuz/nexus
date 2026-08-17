# NEXUS Analytics Worker

> **Status:** Phase 0 — Placeholder  
> Implementation begins in Phase 6+.

## Description

NestJS standalone application that consumes jobs from the `analytics` BullMQ queue. Handles aggregation tasks, report generation, and scheduled analytics.

**Technology:**

- NestJS (standalone app)
- TypeScript (strict)
- BullMQ (consumer)
- Prisma ORM
- Pino (logging)

## Structure (planned)

```
workers/analytics/
├── src/
│   ├── processors/
│   │   └── analytics.processor.ts
│   ├── services/
│   │   ├── aggregation.service.ts
│   │   ├── report.service.ts
│   │   └── heartbeat.service.ts
│   └── main.ts
├── tsconfig.json
└── package.json
```
