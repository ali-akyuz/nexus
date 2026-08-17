# NEXUS Processor Worker

> **Status:** Phase 0 — Placeholder  
> Implementation begins in Phase 6+.

## Description

NestJS standalone application that consumes jobs from the `default`, `ml-processing`, and `ai-processing` BullMQ queues and processes them.

**Technology:**

- NestJS (standalone app)
- TypeScript (strict)
- BullMQ (consumer)
- Prisma ORM
- Pino (logging)

## Structure (planned)

```
workers/processor/
├── src/
│   ├── processors/        # Job type-specific processor handlers
│   │   ├── data-processing.processor.ts
│   │   ├── ml-processing.processor.ts
│   │   └── ai-processing.processor.ts
│   ├── services/
│   │   ├── job-updater.service.ts   # Updates Job status in DB
│   │   ├── ml-client.service.ts     # HTTP client for ML service
│   │   └── heartbeat.service.ts     # Worker heartbeat
│   ├── common/            # Shared utilities
│   └── main.ts            # Worker bootstrap
├── tsconfig.json
└── package.json
```
