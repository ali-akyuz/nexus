import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus, JobPriority } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class JobsSweeper {
  private readonly logger = new Logger(JobsSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('default') private readonly defaultQueue: Queue,
  ) {}

  // Run every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepGhostJobs() {
    this.logger.debug('Running ghost job sweeper...');

    // Find jobs that have been QUEUED for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const ghostJobs = await this.prisma.job.findMany({
      where: {
        status: JobStatus.QUEUED,
        updatedAt: {
          lt: fiveMinutesAgo,
        },
      },
    });

    if (ghostJobs.length === 0) {
      return;
    }

    this.logger.warn(`Found ${ghostJobs.length} ghost jobs. Attempting recovery...`);

    const priorityMap: Record<JobPriority, number> = {
      CRITICAL: 1,
      HIGH: 2,
      NORMAL: 3,
      LOW: 4,
    };

    for (const job of ghostJobs) {
      try {
        // Double check if the job is actually in the queue to prevent actual duplicates
        const bullJob = await this.defaultQueue.getJob(job.id);
        if (bullJob) {
          // Job is actually in BullMQ, perhaps queue is just incredibly backed up.
          // Just touch the updatedAt to prevent sweeping it repeatedly
          await this.prisma.job.update({
            where: { id: job.id },
            data: { updatedAt: new Date() },
          });
          continue;
        }

        // Re-enqueue
        await this.defaultQueue.add(
          'process-job',
          {
            userId: job.userId,
            type: job.type,
            payload: job.payload,
            _traceContext: {}, // Sweeper creates a detached trace context for recovery
          },
          {
            jobId: job.id,
            priority: priorityMap[job.priority],
            attempts: job.maxAttempts,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
            removeOnComplete: true,
            removeOnFail: {
              age: 24 * 3600, // 24 hours
              count: 1000,
            },
          }
        );

        await this.prisma.job.update({
          where: { id: job.id },
          data: { updatedAt: new Date() },
        });

        this.logger.log(`Successfully recovered ghost job ${job.id}`);
      } catch (error) {
        this.logger.error(`Failed to recover ghost job ${job.id}`, error);
      }
    }
  }
}
