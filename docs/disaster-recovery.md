# Disaster Recovery & Backup Strategy

While NEXUS components run as stateless workloads in Kubernetes, the underlying databases (PostgreSQL and Redis) require dedicated disaster recovery strategies.

## 1. PostgreSQL (Source of Truth)
We heavily recommend using a **Managed PostgreSQL Service** (e.g., AWS RDS, GCP Cloud SQL) for production rather than hosting state inside Kubernetes.

### Backup Strategy
- **Automated Backups**: Enable continuous archiving (WAL) with a 7-day retention minimum.
- **Point-in-Time Recovery (PITR)**: Ensure PITR is enabled, allowing rollback to any precise second before accidental data loss.

### Recovery Procedure
If the main database is compromised:
1. Provision a new PostgreSQL instance using the latest automated snapshot.
2. Update the `secrets.databaseUrl` value in your GitHub Actions or Secret Manager.
3. Trigger the `Deploy to Kubernetes` GitHub Action to inject the new credentials and bounce the pods.

## 2. Redis (Ephemeral Queue & Caching)
Redis powers BullMQ. In our architecture, **Redis is not the permanent system of record**. Jobs are persisted in PostgreSQL.

### Failure Strategy
If Redis crashes or data is wiped:
1. Re-provision the Redis cluster.
2. Active processing jobs will fail (their BullMQ locks will disappear).
3. The NEXUS API / Worker recovery mechanisms will reconcile `PROCESSING` jobs in PostgreSQL that have stalled out and re-enqueue them automatically upon the next API trigger. 

**Note**: You do not strictly need persistence enabled on Redis if using it exclusively for BullMQ, though AOF (`appendonly yes`) is recommended for smoother restarts.
