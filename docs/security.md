# NEXUS Security & System Hardening

NEXUS is built with defense-in-depth principles.

## 1. Environment Validation
Upon startup, the API loads `@nestjs/config` validated through a strict `joi` schema.
- **Required Variables**: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ML_SERVICE_URL`, `INTERNAL_SERVICE_KEY`.
- **Production Safety**: If `NODE_ENV=production`, the application refuses to start if `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or `INTERNAL_SERVICE_KEY` are less than 32 characters long. This prevents accidental deployments using weak default placeholders.

## 2. Payload Validation
- **JSON Body Size**: Enforced via `express.json({ limit: '1mb' })` at the Express layer, preventing massive malicious payloads from consuming RAM.
- **DTO Validation**: Enforced via `class-validator` pipes, strictly validating all incoming properties.

## 3. Privilege Escalation Protection
- **Job Priorities**: The `CRITICAL` priority is protected. If a standard `USER` attempts to submit a `CRITICAL` job, they receive an `HTTP 403 Forbidden`. Only `ADMIN` users may bypass standard queue constraints.

## 4. Health Probes
- `GET /health/live`: Verifies the NestJS process is responsive.
- `GET /health/ready`: Actively pings PostgreSQL, checks the current Queue Depth, and pings the ML Service to declare true system readiness. Useful for Kubernetes or load-balancer routing.
