// ─── String Utilities ─────────────────────────────────────────────────────────

/**
 * Generate a random hex string of the given byte length.
 * Suitable for correlation IDs in environments without crypto.randomUUID.
 */
export function randomHex(bytes: number = 16): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate a correlation ID with a readable prefix.
 */
export function generateCorrelationId(): string {
  return `corr_${randomHex(12)}`;
}

/**
 * Generate a request ID with a readable prefix.
 */
export function generateRequestId(): string {
  return `req_${randomHex(12)}`;
}

// ─── Time Utilities ───────────────────────────────────────────────────────────

/**
 * Return the current UTC timestamp as an ISO 8601 string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Calculate the difference in milliseconds between two ISO timestamps.
 */
export function diffMs(start: string, end: string): number {
  return new Date(end).getTime() - new Date(start).getTime();
}

// ─── Validation Utilities ─────────────────────────────────────────────────────

/**
 * Ensure a value is not null or undefined, throwing a descriptive error if it is.
 */
export function assertDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected "${label}" to be defined, got ${String(value)}`);
  }
  return value;
}

/**
 * Check if a string is a valid UUID v4.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}
