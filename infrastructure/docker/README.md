# Infrastructure — Docker

> **Status:** Phase 0 — Placeholder

This directory contains per-service Dockerfiles, to be implemented in Phase 1.

## Planned Dockerfiles

| File                          | Service                   |
| ----------------------------- | ------------------------- |
| `api.Dockerfile`              | NestJS API                |
| `web.Dockerfile`              | Next.js Frontend          |
| `worker-processor.Dockerfile` | Processor Worker          |
| `worker-analytics.Dockerfile` | Analytics Worker          |
| `ml-service.Dockerfile`       | Python FastAPI ML Service |

## Design Requirements

All Dockerfiles must:

- Use multi-stage builds (base → deps → builder → runner)
- Run as non-root user in the final stage
- Minimize final image size
- Use `.dockerignore` to exclude `node_modules`, `.next/cache`, etc.
- Be `ARG`-parameterized for version pinning
