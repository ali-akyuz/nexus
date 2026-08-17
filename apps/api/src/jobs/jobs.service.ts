import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { type PrismaService } from '../prisma/prisma.service';
import { type CreateJobDto } from './dto/create-job.dto';
import { type JobQueryDto } from './dto/job-query.dto';
import { JobStatus, JobPriority, Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { trace, context, propagation } from '@opentelemetry/api';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('default') private readonly defaultQueue: Queue,
    private configService: ConfigService,
    @InjectMetric('jobs_created_total') private readonly jobsCreatedTotal: Counter<string>,
  ) {}

  async createJob(user: any, dto: CreateJobDto) {
    const userId = user.id;

    // Check Priority Abuse
    if (dto.priority === JobPriority.CRITICAL && user.role !== 'ADMIN') {
      throw new BadRequestException('Only ADMIN users can submit CRITICAL priority jobs.');
    }

    // Check System Back-pressure (Queue Depth)
    const maxQueueDepth = this.configService.get<number>('MAX_QUEUE_DEPTH', 500);
    const waitingJobsCount = await this.defaultQueue.getWaitingCount();
    if (waitingJobsCount >= maxQueueDepth) {
      throw new BadRequestException({
        code: 'QUEUE_OVERLOADED',
        message: 'The processing queue is temporarily overloaded. Please try again later.',
      });
    }

    // Check User Concurrency Limits
    const maxUserJobs = this.configService.get<number>('MAX_CONCURRENT_JOBS_PER_USER', 10);
    const userActiveJobs = await this.prisma.job.count({
      where: {
        userId,
        status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] },
      },
    });
    if (userActiveJobs >= maxUserJobs) {
      throw new BadRequestException({
        code: 'CONCURRENCY_LIMIT_REACHED',
        message: `You have reached the maximum allowed concurrent jobs (${maxUserJobs}). Wait for existing jobs to finish.`,
      });
    }

    // Check idempotency if key is provided
    if (dto.idempotencyKey) {
      const existingJob = await this.prisma.job.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });

      if (existingJob) {
        this.logger.log(`Idempotent hit for user ${userId}, key ${dto.idempotencyKey}`);
        return existingJob;
      }
    }

    // Insert into DB with QUEUED status
    let job = await this.prisma.job.create({
      data: {
        userId,
        type: dto.type,
        idempotencyKey: dto.idempotencyKey,
        priority: dto.priority || JobPriority.NORMAL,
        payload: dto.payload ? (dto.payload as any) : {},
        status: JobStatus.QUEUED,
        maxAttempts: 3, // Default retries
      },
    });

    try {
      // Map priority to BullMQ priority (BullMQ lower number = higher priority, default is usually 0 but we can map 1-4)
      const priorityMap: Record<JobPriority, number> = {
        CRITICAL: 1,
        HIGH: 2,
        NORMAL: 3,
        LOW: 4,
      };

      // Inject current trace context for the worker
      const carrier = {};
      propagation.inject(context.active(), carrier);

      // Add to BullMQ
      await this.defaultQueue.add(
        'process-job',
        {
          userId,
          type: dto.type,
          payload: dto.payload,
          _traceContext: carrier,
        },
        {
          jobId: job.id, // Enforce BullMQ deduplication by assigning the DB UUID
          priority: priorityMap[job.priority],
          attempts: job.maxAttempts,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true, // DB is the source of truth
          removeOnFail: {
            age: 24 * 3600, // 24 hours
            count: 1000,
          },
      );
      
      this.logger.log(`Job ${job.id} successfully enqueued in BullMQ.`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to enqueue job ${job.id} in BullMQ. Rolling back DB state.`, error);
      
      // If Queue fails, mark as FAILED to prevent ghost jobs
      job = await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          error: 'Failed to enqueue job in message broker.',
        },
      });
      
      throw new BadRequestException('Failed to enqueue job due to internal queue error.');
    }
  }

  async findUserJobs(userId: string, query: JobQueryDto) {
    const { page = 1, limit = 25, status, type, priority, sortBy = 'createdAt', sortOrder = 'desc', search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = { userId };

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    if (search) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
      
      where.OR = [
        { type: { contains: search, mode: 'insensitive' } },
        ...(isUuid ? [{ id: search }] : []),
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findUserJobById(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job || job.userId !== userId) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return job;
  }

  async cancelJob(userId: string, jobId: string) {
    const job = await this.findUserJobById(userId, jobId);

    if (job.status !== JobStatus.QUEUED) {
      throw new BadRequestException(`Cannot cancel a job in state: ${job.status}`);
    }

    // Try to remove from queue first
    const bullJob = await this.defaultQueue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
    }

    // Update DB
    return this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.CANCELLED },
    });
  }

  async findJobByIdInternal(jobId: string) {
    return this.prisma.job.findUnique({
      where: { id: jobId },
    });
  }
}
