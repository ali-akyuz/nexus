# Infrastructure Scripts

> Helper scripts for development, operations, and CI.

## Planned Scripts

| Script                | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `init-db.sql`         | PostgreSQL initialization (runs on container first start) |
| `seed-test-data.ts`   | Populate database with E2E test fixtures                  |
| `wait-for-it.sh`      | Wait for a TCP service to be available                    |
| `generate-secrets.sh` | Generate cryptographically random secrets for `.env`      |
| `health-check.sh`     | Check health of all services                              |
| `reset-dev.sh`        | Reset local development environment (wipe DB + queues)    |

## Usage (planned)

```bash
# Generate new secrets for .env
bash infrastructure/scripts/generate-secrets.sh

# Reset local development environment
bash infrastructure/scripts/reset-dev.sh

# Seed test data
pnpm tsx infrastructure/scripts/seed-test-data.ts
```
