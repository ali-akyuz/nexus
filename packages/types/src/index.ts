// ─── Job Types ────────────────────────────────────────────────────────────────

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type JobType = 'DATA_PROCESSING' | 'MODEL_TRAINING' | 'PREDICTION' | 'ANALYTICS' | 'CUSTOM';

export type JobPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface Job {
  id: string;
  userId: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  name: string;
  description?: string;
  inputPayload: Record<string, unknown>;
  inputFileUrl?: string;
  queueName: string;
  bullJobId?: string;
  workerId?: string;
  correlationId: string;
  progress: number;
  errorMessage?: string;
  attempts: number;
  maxAttempts: number;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── User Types ───────────────────────────────────────────────────────────────

export type UserRole = 'USER' | 'ADMIN' | 'WORKER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Worker Types ─────────────────────────────────────────────────────────────

export type WorkerStatus = 'IDLE' | 'BUSY' | 'DRAINING' | 'OFFLINE' | 'STALE';

export interface Worker {
  id: string;
  instanceId: string;
  status: WorkerStatus;
  queueNames: string[];
  currentJobId?: string;
  jobsProcessed: number;
  jobsFailed: number;
  lastHeartbeatAt?: string;
  startedAt: string;
  stoppedAt?: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ─── Health Types ─────────────────────────────────────────────────────────────

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  checks: Record<string, { status: HealthStatus; responseMs?: number; error?: string }>;
}

// ─── Queue Types ──────────────────────────────────────────────────────────────

export type QueueName = 'default' | 'ml-processing' | 'ai-processing' | 'analytics';

export interface QueuePayloadBase {
  jobId: string;
  userId: string;
  correlationId: string;
  timeoutMs: number;
}

// ─── WebSocket Event Types ────────────────────────────────────────────────────

export type WsEventName =
  | 'job.created'
  | 'job.queued'
  | 'job.started'
  | 'job.progress'
  | 'job.log'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'worker.status_changed'
  | 'queue.metrics'
  | 'system.notification';

export interface WsEvent<T = unknown> {
  event: WsEventName;
  data: T;
}
