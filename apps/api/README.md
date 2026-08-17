# NEXUS API Service

> **Status:** Phase 0 — Placeholder  
> Implementation begins in Phase 3+.

## Description

NestJS backend API for NEXUS. Handles authentication, job management, queue integration, WebSocket gateway, and admin operations.

**Technology:**

- NestJS 10
- TypeScript (strict)
- Prisma ORM
- BullMQ (producers)
- Socket.IO
- Pino (logging)
- @nestjs/terminus (health checks)

## Structure (planned)

```
apps/api/
├── src/
│   ├── auth/              # Auth module (JWT, guards, strategies)
│   ├── users/             # Users module
│   ├── jobs/              # Jobs module (CRUD, upload, enqueue)
│   ├── queue/             # BullMQ producer module
│   ├── workers/           # Worker registry module
│   ├── websocket/         # Socket.IO gateway
│   ├── health/            # Health check endpoint
│   ├── metrics/           # Prometheus metrics
│   ├── prisma/            # Prisma service
│   ├── common/            # Guards, decorators, filters, pipes
│   ├── config/            # Configuration module
│   └── main.ts            # Application bootstrap
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Prisma migrations
│   └── seed.ts            # Seed data
├── test/
│   ├── unit/
│   └── integration/
├── nest-cli.json
├── tsconfig.json
└── package.json
```
