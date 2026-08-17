# @nexus/shared

> **Status:** Phase 0 — Placeholder  
> Implementation begins in Phase 2+.

## Description

Shared business logic and utilities used across NestJS API and worker services.

Contains:

- Constants (queue names, job status values, error codes)
- Validation helpers
- Date/time utilities
- Type guards

## Structure (planned)

```
packages/shared/
├── src/
│   ├── constants/
│   │   ├── queues.ts
│   │   ├── job-status.ts
│   │   └── error-codes.ts
│   ├── utils/
│   │   ├── date.ts
│   │   └── validation.ts
│   └── index.ts
├── tsconfig.json
└── package.json
```
