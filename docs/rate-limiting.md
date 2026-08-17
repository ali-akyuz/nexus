# Rate Limiting & Throttling

NEXUS employs several rate-limiting strategies to maintain high availability and prevent abuse.

## 1. Global Request Limiting
We use `@nestjs/throttler` to enforce IP-based rate limiting across all API routes.
- **Global**: 100 requests per minute
- **Authentication (`/auth/*`)**: 10 requests per minute
- **Job Creation (`POST /jobs`)**: 20 requests per minute

When limits are exceeded, the API returns `HTTP 429 Too Many Requests`.

## 2. Job Concurrency Limits (Per User)
To prevent a single user from starving the queue, authenticated users are limited to a maximum number of concurrent active jobs (`QUEUED` + `PROCESSING`).
- **Limit**: Defined by `MAX_CONCURRENT_JOBS_PER_USER` (Default: 10).
- **Behavior**: Attempting to submit the 11th job returns `HTTP 429` with a custom `CONCURRENCY_LIMIT_REACHED` error code.

## 3. Queue Back-Pressure
To protect Redis memory from unbounded queue growth:
- **Limit**: Defined by `MAX_QUEUE_DEPTH` (Default: 500).
- **Behavior**: If the global queue depth exceeds this number, all new job submissions are rejected with `HTTP 503 Service Unavailable` (`QUEUE_OVERLOADED`) until workers drain the queue.

## 4. Frontend Handling
The Next.js frontend utilizes Axios Interceptors to catch `429` and `503` errors seamlessly. Instead of crashing, it displays a polite Toast notification instructing the user to wait.
