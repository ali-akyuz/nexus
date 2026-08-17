// ─── Environment Variable Parsing ────────────────────────────────────────────
//
// Centralised, type-safe access to environment variables.
// All services import from this package rather than reading process.env directly.
//
// Usage:
//   import { getEnv, getEnvInt, getEnvBool } from '@repo/config';
//   const port = getEnvInt('API_PORT', 3001);

/**
 * Read a required string environment variable.
 * Throws at startup if the variable is missing.
 */
export function getEnv(key: string): string;
export function getEnv(key: string, defaultValue: string): string;
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== '') {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(
    `Missing required environment variable: "${key}". Check your .env file against .env.example.`,
  );
}

/**
 * Read an environment variable and parse it as an integer.
 */
export function getEnvInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable "${key}" must be an integer, got: "${raw}"`);
  }
  return parsed;
}

/**
 * Read an environment variable and parse it as a boolean.
 * Accepts 'true' | '1' | 'yes' as truthy; everything else is false.
 */
export function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  return ['true', '1', 'yes'].includes(raw.toLowerCase());
}

// ─── Common Config Factories ──────────────────────────────────────────────────

/**
 * Database configuration derived from environment variables.
 */
export function databaseConfig() {
  return {
    url: getEnv('DATABASE_URL', 'postgresql://nexus_user:nexus_password@localhost:5432/nexus'),
  };
}

/**
 * Redis configuration derived from environment variables.
 */
export function redisConfig() {
  return {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvInt('REDIS_PORT', 6379),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
  };
}

/**
 * JWT configuration derived from environment variables.
 */
export function jwtConfig() {
  return {
    accessSecret: getEnv('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-production'),
    accessExpiry: getEnv('JWT_ACCESS_EXPIRY', '15m'),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
    refreshExpiry: getEnv('JWT_REFRESH_EXPIRY', '7d'),
  };
}

/**
 * Application-level configuration.
 */
export function appConfig() {
  return {
    nodeEnv: getEnv('NODE_ENV', 'development'),
    name: getEnv('APP_NAME', 'nexus'),
    version: getEnv('APP_VERSION', '0.1.0'),
    port: getEnvInt('API_PORT', 3001),
    logLevel: getEnv('LOG_LEVEL', 'info'),
    corsOrigins: getEnv('CORS_ORIGINS', 'http://localhost:3000'),
  };
}
