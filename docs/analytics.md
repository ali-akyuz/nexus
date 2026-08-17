# NEXUS Analytics Architecture

## Overview
NEXUS Analytics uses a combination of NestJS, Prisma, and PostgreSQL native aggregations to power the Operations Dashboard.

## Endpoints (`/analytics/*`)
All endpoints are secured via JWT. If the user is an `ADMIN`, they view global metrics. If `USER`, metrics are strictly scoped to their `userId`.

### `GET /analytics/overview`
- **Purpose**: High-level KPIs.
- **Metrics**: Total Jobs, Running, Completed, Failed, Success Rate, Queue Depth, Active Workers.
- **Implementation**: Uses `Promise.all` over multiple `prisma.job.count()` calls.

### `GET /analytics/jobs?range=7d`
- **Purpose**: Time-series volume buckets for plotting line/area charts.
- **Implementation**: Uses Raw SQL `date_trunc` grouped by `status` to pivot data accurately. Ranges adjust the bucket size dynamically (1 hour buckets for `24h`, 1 day buckets for others).

### `GET /analytics/performance`
- **Purpose**: System latency monitoring.
- **Metrics**: Average Processing Time, Average Queue Wait Time.
- **Implementation**: Uses Raw SQL `EXTRACT(EPOCH FROM ("completedAt" - "startedAt"))`.

### `GET /analytics/types`
- **Purpose**: Categorical distribution.
- **Implementation**: Uses native `prisma.job.groupBy()`.

## Real-time Strategy
Instead of calculating analytics on the browser, or polling the database:
- The Next.js frontend uses TanStack Query.
- `Socket.io` listens for `job.*` events.
- On event receipt, `queryClient.invalidateQueries(['analytics', 'overview'])` is called, ensuring the KPIs seamlessly increment in real-time.
