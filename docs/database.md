# NEXUS — Database Design

> **Document status:** Phase 0 — Design  
> **Last updated:** 2026-08-17  
> **Database:** PostgreSQL 16  
> **ORM:** Prisma

---

## 1. Design Principles

- Use UUID v7 as primary keys — globally unique, sortable, avoids ORM id-generation bottlenecks.
- All tables have `created_at` and `updated_at` timestamps.
- Soft-delete only where explicitly required (`deleted_at`); hard delete otherwise.
- Indexes on every foreign key and every column used in WHERE/ORDER BY clauses.
- Enum types enforced at the database level, not just the application level.
- No nullable columns unless null carries semantic meaning distinct from a default value.

---

## 2. Entity Relationship Overview

```
User ──────────────────────────────────────┐
  │                                         │
  ├──< RefreshToken                         │
  │                                         │
  └──< Job ──────────────────────────────┐  │
            │                             │  │
            ├──< JobLog                   │  │
            │                             │  │
            └──< JobResult                │  │
                                          │  │
Worker ─── (current_job_id) ─────────────┘  │
                                             │
Queue ───────────────────────────────────────┘
  (logical queue registry, not job storage)
```

---

## 3. Entities

### 3.1 `User`

Represents a registered platform user.

```prisma
model User {
  id             String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email          String         @unique
  passwordHash   String         @map("password_hash")
  firstName      String         @map("first_name")
  lastName       String         @map("last_name")
  role           UserRole       @default(USER)
  isActive       Boolean        @default(true)   @map("is_active")
  lastLoginAt    DateTime?      @map("last_login_at")
  createdAt      DateTime       @default(now())  @map("created_at")
  updatedAt      DateTime       @updatedAt       @map("updated_at")

  refreshTokens  RefreshToken[]
  jobs           Job[]

  @@map("users")
}

enum UserRole {
  USER
  ADMIN
  WORKER   // Service account role for worker services
}
```

**Indexes:** `email` (unique), `role`, `is_active`

---

### 3.2 `RefreshToken`

Stores issued refresh tokens. Enables token revocation (logout, suspicious activity).

```prisma
model RefreshToken {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  tokenHash   String    @unique @map("token_hash")   // bcrypt hash of the token
  family      String    // Rotation family — detects token reuse attacks
  expiresAt   DateTime  @map("expires_at")
  revokedAt   DateTime? @map("revoked_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  userAgent   String?   @map("user_agent")
  ipAddress   String?   @map("ip_address")

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([family])
  @@map("refresh_tokens")
}
```

**Notes:**

- Only the hash is stored, never the raw token.
- `family` enables refresh token rotation: if a token from an old rotation is reused, invalidate the entire family.
- Expired tokens are cleaned up by a scheduled job.

---

### 3.3 `Job`

The central entity. Tracks everything about a processing job.

```prisma
model Job {
  id              String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId          String      @map("user_id") @db.Uuid
  type            JobType
  status          JobStatus   @default(QUEUED)
  priority        Int         @default(0)       // Higher = processed first
  name            String
  description     String?
  inputPayload    Json        @map("input_payload")    // Job input parameters
  inputFileUrl    String?     @map("input_file_url")   // Optional uploaded file
  queueName       String      @map("queue_name")
  bullJobId       String?     @unique @map("bull_job_id") // BullMQ job ID
  workerId        String?     @map("worker_id") @db.Uuid  // Worker currently processing
  correlationId   String      @map("correlation_id")       // Request tracing
  progress        Int         @default(0)       // 0–100
  errorMessage    String?     @map("error_message")
  errorStack      String?     @map("error_stack")
  attempts        Int         @default(0)
  maxAttempts     Int         @default(3)       @map("max_attempts")
  queuedAt        DateTime?   @map("queued_at")
  startedAt       DateTime?   @map("started_at")
  completedAt     DateTime?   @map("completed_at")
  cancelledAt     DateTime?   @map("cancelled_at")
  failedAt        DateTime?   @map("failed_at")
  timeoutAt       DateTime?   @map("timeout_at")   // Absolute deadline
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt      @map("updated_at")

  user            User        @relation(fields: [userId], references: [id])
  worker          Worker?     @relation(fields: [workerId], references: [id])
  logs            JobLog[]
  result          JobResult?

  @@index([userId])
  @@index([status])
  @@index([type])
  @@index([queueName])
  @@index([workerId])
  @@index([createdAt])
  @@index([priority, createdAt])  // Composite for priority queue sorting
  @@map("jobs")
}

enum JobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

enum JobType {
  DATA_PROCESSING
  MODEL_TRAINING
  PREDICTION
  ANALYTICS
  CUSTOM
}
```

---

### 3.4 `JobLog`

Append-only log entries for each job. Supports streaming log output to the frontend.

```prisma
model JobLog {
  id         String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  jobId      String      @map("job_id") @db.Uuid
  level      LogLevel    @default(INFO)
  message    String
  metadata   Json?       // Additional structured data
  sequence   Int         // Monotonically increasing within a job
  createdAt  DateTime    @default(now()) @map("created_at")

  job        Job         @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId, sequence])
  @@index([jobId, createdAt])
  @@map("job_logs")
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
}
```

**Notes:**

- `sequence` enables consistent ordering even if timestamps collide.
- Logs for completed jobs are archived to cold storage after 30 days (planned).

---

### 3.5 `JobResult`

Stores the final output of a completed job. One-to-one with Job.

```prisma
model JobResult {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  jobId          String    @unique @map("job_id") @db.Uuid
  outputPayload  Json      @map("output_payload")   // Structured result data
  outputFileUrl  String?   @map("output_file_url")  // Optional result file
  processingMs   Int       @map("processing_ms")    // Actual processing duration
  createdAt      DateTime  @default(now()) @map("created_at")

  job            Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@map("job_results")
}
```

---

### 3.6 `Worker`

Tracks worker instances that process jobs. Updated by worker heartbeats.

```prisma
model Worker {
  id               String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  instanceId       String        @unique @map("instance_id")  // Hostname + PID
  status           WorkerStatus  @default(IDLE)
  queueNames       String[]      @map("queue_names")
  currentJobId     String?       @map("current_job_id") @db.Uuid
  jobsProcessed    Int           @default(0) @map("jobs_processed")
  jobsFailed       Int           @default(0) @map("jobs_failed")
  lastHeartbeatAt  DateTime?     @map("last_heartbeat_at")
  startedAt        DateTime      @default(now()) @map("started_at")
  stoppedAt        DateTime?     @map("stopped_at")
  version          String?       // Worker software version
  metadata         Json?         // Extra runtime info (hostname, region, etc.)
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt      @map("updated_at")

  currentJobs      Job[]

  @@index([status])
  @@index([lastHeartbeatAt])
  @@map("workers")
}

enum WorkerStatus {
  IDLE
  BUSY
  DRAINING   // Finishing current job, will not accept new jobs
  OFFLINE
  STALE      // Heartbeat not received within threshold
}
```

---

### 3.7 `Queue`

Logical queue registry — metadata about queues. The actual queue data lives in Redis.

```prisma
model Queue {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String    @unique
  displayName String    @map("display_name")
  description String?
  isPaused    Boolean   @default(false) @map("is_paused")
  maxRetries  Int       @default(3) @map("max_retries")
  timeoutMs   Int       @default(300000) @map("timeout_ms")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt      @map("updated_at")

  @@map("queues")
}
```

---

## 4. Job State Machine

### Valid States

```
                    ┌─────────────────────┐
                    │        QUEUED       │ ← Initial state on creation
                    └──────────┬──────────┘
                               │ Worker picks up job
                               ▼
                    ┌─────────────────────┐
                    │     PROCESSING      │
                    └──┬────────────┬─────┘
                       │            │
              Success  │            │  Error / Timeout / Max retries
                       ▼            ▼
           ┌───────────────┐   ┌──────────────┐
           │   COMPLETED   │   │    FAILED     │
           └───────────────┘   └──────────────┘

From QUEUED or PROCESSING → CANCELLED (user-initiated)
```

### State Transition Rules

| From       | To         | Trigger                | Guard                                  |
| ---------- | ---------- | ---------------------- | -------------------------------------- |
| —          | QUEUED     | Job created            | —                                      |
| QUEUED     | PROCESSING | Worker dequeues        | Worker must be IDLE                    |
| QUEUED     | CANCELLED  | User cancels           | Job must not be PROCESSING             |
| PROCESSING | COMPLETED  | Worker reports success | —                                      |
| PROCESSING | FAILED     | Worker reports failure | attempts >= maxAttempts                |
| PROCESSING | QUEUED     | Worker reports failure | attempts < maxAttempts (retry)         |
| PROCESSING | CANCELLED  | User cancels           | Job must be cancellable                |
| PROCESSING | FAILED     | Timeout exceeded       | timeoutAt < now()                      |
| COMPLETED  | —          | —                      | Terminal state, no further transitions |
| FAILED     | —          | —                      | Terminal state, no further transitions |
| CANCELLED  | —          | —                      | Terminal state, no further transitions |

### Invalid Transitions (explicitly rejected)

- `COMPLETED → any`
- `FAILED → any` (manual re-queue is a new job creation)
- `CANCELLED → any`
- `QUEUED → COMPLETED` (must go through PROCESSING)

---

## 5. Indexes Summary

| Table          | Index     | Columns              | Reason                  |
| -------------- | --------- | -------------------- | ----------------------- |
| users          | unique    | email                | Auth lookup             |
| users          | btree     | role                 | RBAC queries            |
| refresh_tokens | unique    | token_hash           | Token validation        |
| refresh_tokens | btree     | user_id              | User's tokens           |
| refresh_tokens | btree     | family               | Rotation detection      |
| jobs           | btree     | user_id              | User's jobs             |
| jobs           | btree     | status               | Job queue polling       |
| jobs           | btree     | queue_name           | Queue routing           |
| jobs           | btree     | worker_id            | Worker's jobs           |
| jobs           | btree     | created_at           | Chronological listing   |
| jobs           | composite | priority, created_at | Priority queue ordering |
| job_logs       | composite | job_id, sequence     | Ordered log fetch       |
| workers        | btree     | status               | Worker health queries   |
| workers        | btree     | last_heartbeat_at    | Dead worker detection   |

---

## 6. Data Retention Policy (Planned)

| Data           | Retention             | Strategy                              |
| -------------- | --------------------- | ------------------------------------- |
| Job records    | Indefinite            | Archive to cold storage after 90 days |
| Job logs       | 30 days               | Compressed archival or deletion       |
| Job results    | 30 days               | Move to object storage                |
| Refresh tokens | Until expiry + 7 days | Scheduled cleanup job                 |
| Worker records | 7 days after OFFLINE  | Scheduled cleanup job                 |
