import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class QueueEventsListener implements OnModuleInit, OnModuleDestroy {
  private queueEvents: QueueEvents;
  private readonly logger = new Logger(QueueEventsListener.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly gateway: RealtimeGateway,
    private readonly jobsService: JobsService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    
    // We listen to the same queue name used by the JobsService/Worker ('default')
    this.queueEvents = new QueueEvents('default', {
      connection: new URL(redisUrl),
    });

    this.logger.log('Listening to BullMQ QueueEvents...');

    // Wait until job becomes active
    this.queueEvents.on('active', async ({ jobId, prev }) => {
      await this.safeBroadcast(jobId, 'job.started', (job) => ({
        jobId: job.id,
        status: job.status,
        startedAt: job.startedAt,
        updatedAt: job.updatedAt,
      }));
    });

    // Listen to progress updates
    this.queueEvents.on('progress', async ({ jobId, data }) => {
      await this.safeBroadcast(jobId, 'job.progress', (job) => ({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        updatedAt: job.updatedAt,
      }));
    });

    // Listen to completed
    this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      await this.safeBroadcast(jobId, 'job.completed', (job) => ({
        jobId: job.id,
        status: job.status,
        resultAvailable: true,
        completedAt: job.completedAt,
        updatedAt: job.updatedAt,
      }));
    });

    // Listen to failed
    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      await this.safeBroadcast(jobId, 'job.failed', (job) => ({
        jobId: job.id,
        status: job.status,
        errorCode: failedReason,
        updatedAt: job.updatedAt,
      }));
    });

    // Listen to generic logs (custom emitted by worker)
    this.queueEvents.on('log', async ({ jobId, data }) => {
      // Data is typically the string passed to job.log()
      // We don't necessarily need a DB query for a log line unless we want versioning
      this.gateway.broadcastToJob(jobId, 'job.log', {
        jobId,
        message: data,
        timestamp: new Date().toISOString(),
      });
    });
  }

  async onModuleDestroy() {
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
  }

  /**
   * Safely fetches the latest job state from Postgres before broadcasting
   * to guarantee consistency. Also suppresses errors to prevent the listener from crashing.
   */
  private async safeBroadcast(bullJobId: string, eventName: string, payloadMapper: (job: any) => any) {
    try {
      // The bullJobId maps exactly to our Postgres job.id
      const job = await this.jobsService.findJobByIdInternal(bullJobId);
      if (job) {
        const payload = payloadMapper(job);
        this.gateway.broadcastToJob(job.id, eventName, payload);
      }
    } catch (error) {
      this.logger.error(`Error processing QueueEvent for job ${bullJobId}`, error);
    }
  }
}
