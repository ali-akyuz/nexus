# NEXUS — E2E Tests

> **Status:** Phase 0 — Placeholder  
> E2E tests implemented in Phase 11+.

## Overview

End-to-end tests use Playwright against the full Docker Compose stack.

## Core E2E Scenarios

1. **Happy Path:** Register → Login → Submit Job → Worker Processes → WebSocket updates → Completed
2. **Auth:** Login failure, token refresh, logout
3. **Job Cancellation:** User cancels a queued or processing job
4. **Job Failure:** Simulate ML service failure, observe retry behavior
5. **Admin:** Admin views all jobs and worker status

## Running Locally

```bash
# Start the full stack
docker compose up

# Run E2E tests
pnpm turbo run test:e2e

# Run a specific test
pnpm exec playwright test tests/e2e/job-lifecycle.spec.ts
```

## Structure (planned)

```
tests/e2e/
├── fixtures/           # Playwright fixtures (auth, test data)
├── helpers/            # Page object models
├── specs/
│   ├── auth.spec.ts
│   ├── job-lifecycle.spec.ts
│   ├── job-cancel.spec.ts
│   └── admin.spec.ts
├── playwright.config.ts
└── README.md
```
