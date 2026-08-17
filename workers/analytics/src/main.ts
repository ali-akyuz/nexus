import { getEnv } from '@repo/config';

/**
 * NEXUS Analytics Worker — Entry Point
 *
 * Phase 1: Skeleton only. Confirms the worker can start and read config.
 * Phase 6: BullMQ consumer and analytics processors will be added here.
 */
async function main(): Promise<void> {
  const workerName = 'analytics';
  const version = getEnv('APP_VERSION', '0.1.0');
  const nodeEnv = getEnv('NODE_ENV', 'development');

  console.warn(`[NEXUS Worker:${workerName}] Starting v${version} (${nodeEnv})`);
  console.warn(`[NEXUS Worker:${workerName}] Queues: analytics`);
  console.warn(`[NEXUS Worker:${workerName}] BullMQ integration added in Phase 6`);
  console.warn(`[NEXUS Worker:${workerName}] Ready.`);

  // Keep process alive — in Phase 6 this will be replaced by BullMQ's event loop
  setInterval(() => {
    // Heartbeat placeholder
  }, 10_000);
}

main().catch((err: unknown) => {
  console.error('[NEXUS Worker:analytics] Fatal error during startup:', err);
  process.exit(1);
});
