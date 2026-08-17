import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job } from 'bullmq';
import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { type PrismaService } from './prisma.service';
import { JobStatus, WorkerStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { trace, context, propagation, SpanStatusCode } from '@opentelemetry/api';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
@Processor('default', {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
})
export class ProcessorService extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessorService.name);
  private readonly workerId = randomUUID();
  private readonly workerName = `processor-${this.workerId}`;
  private heartbeatInterval!: NodeJS.Timeout;
  private readonly tracer = trace.getTracer('nexus-worker');

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectMetric('worker_jobs_processed_total') private readonly jobsProcessed: Counter<string>,
    @InjectMetric('worker_job_duration_seconds') private readonly jobDuration: Histogram<string>,
  ) {
    super();
  }

  async onModuleInit() {
    this.logger.log(`Initializing WorkerNode: ${this.workerName}`);
    
    // Register worker
    await this.prisma.workerNode.create({
      data: {
        id: this.workerId,
        name: this.workerName,
        status: WorkerStatus.IDLE,
      },
    });

    // Start heartbeat (every 30 seconds)
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 30000);
  }

  async onModuleDestroy() {
    this.logger.log(`Shutting down WorkerNode: ${this.workerName}`);
    clearInterval(this.heartbeatInterval);
    
    // Stop accepting new jobs and gracefully drain active jobs
    if (this.worker) {
      await this.worker.close();
    }
    
    await this.prisma.workerNode.update({
      where: { id: this.workerId },
      data: { status: WorkerStatus.OFFLINE },
    });
  }

  private async heartbeat() {
    try {
      await this.prisma.workerNode.update({
        where: { id: this.workerId },
        data: { lastHeartbeat: new Date() },
      });
    } catch (error) {
      this.logger.error('Failed to send heartbeat', error);
    }
  }

  async process(job: Job<any, any, string>): Promise<any> {
    // Extract trace context
    const parentContext = propagation.extract(context.active(), job.data._traceContext || {});
    
    return context.with(parentContext, async () => {
      return this.tracer.startActiveSpan('process_job', async (span) => {
        span.setAttribute('job.id', job.data.jobId);
        span.setAttribute('job.type', job.name);
        
        this.logger.log(`Processing job ${job.id} of type ${job.name}`);
        const dbJobId = job.data.jobId;
        const startTime = Date.now();
        let status = 'completed';

        // 1. Fetch Job and verify state
        const dbJob = await this.prisma.job.findUnique({
          where: { id: dbJobId },
        });

        if (!dbJob) {
          this.logger.error(`Job ${dbJobId} not found in database!`);
          throw new Error(`Job not found: ${dbJobId}`);
        }

        if (dbJob.status === JobStatus.COMPLETED || dbJob.status === JobStatus.CANCELLED) {
          this.logger.warn(`Job ${dbJobId} is already ${dbJob.status}. Skipping.`);
          return { skipped: true, reason: `Already ${dbJob.status}` };
        }

        // 2. Mark as PROCESSING and set BUSY
        await this.prisma.$transaction([
          this.prisma.job.update({
            where: { id: dbJobId },
            data: {
              status: JobStatus.PROCESSING,
              workerId: this.workerId,
              startedAt: new Date(),
              attempts: { increment: 1 },
            },
          }),
          this.prisma.workerNode.update({
            where: { id: this.workerId },
            data: {
              status: WorkerStatus.BUSY,
              currentJobId: dbJobId,
            },
          }),
        ]);

        try {
          // 3. Execute HTTP call to ML Service using Fetch for Streaming
          const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
          const mlServiceKey = process.env.INTERNAL_SERVICE_KEY || 'super-secret-internal-key-for-ml-service';

          this.logger.log(`Job ${dbJobId}: Calling ML Service at ${mlServiceUrl}/v1/process`);
          
          const response = await fetch(`${mlServiceUrl}/v1/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Service-Key': mlServiceKey,
            },
            body: JSON.stringify({
              job_id: dbJobId,
              type: dbJob.type,
              payload: job.data.payload || {},
            }),
            signal: AbortSignal.timeout(300000), 
          });

          if (!response.ok) {
            throw new Error(`ML Service returned ${response.status}: ${await response.text()}`);
          }

          if (!response.body) {
            throw new Error('ML Service did not return a response body stream');
          }

          // Read the NDJSON stream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let finalResult = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                const event = JSON.parse(line);
                
                if (event.type === 'progress') {
                  if (event.log) await job.log(event.log);
                  if (event.percent !== undefined) {
                    await job.updateProgress(event.percent);
                    await this.updateDbProgress(dbJobId, event.percent);
                  }
                } else if (event.type === 'result') {
                  finalResult = event.data;
                }
              } catch (e) {
                this.logger.warn(`Failed to parse stream line: ${line}`, e);
              }
            }
          }
          if (!finalResult) {
            throw new Error('Stream completed but no final result was received');
          }

          if (finalResult.status === 'FAILED') {
            throw new Error(`ML Processing failed: ${finalResult.error}`);
          }
          
          // 4. Mark as COMPLETED and set IDLE
          await this.prisma.$transaction([
            this.prisma.job.update({
              where: { id: dbJobId },
              data: {
                status: JobStatus.COMPLETED,
                progress: 100,
                completedAt: new Date(),
                result: finalResult.result,
              },
            }),
            this.prisma.workerNode.update({
              where: { id: this.workerId },
              data: {
                status: WorkerStatus.IDLE,
                currentJobId: null,
                jobsProcessed: { increment: 1 },
              },
            }),
          ]);

          this.logger.log(`Job ${dbJobId} completed successfully`);
          return finalResult;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`Job ${dbJobId} failed:`, error instanceof Error ? error.stack : String(error));
          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
          
          const attempt = dbJob.attempts + 1; // +1 because we incremented at the start
          const isExhausted = attempt >= dbJob.maxAttempts;

          await this.prisma.$transaction([
            this.prisma.job.update({
              where: { id: dbJobId },
              data: {
                status: isExhausted ? JobStatus.FAILED : JobStatus.QUEUED,
                error: error instanceof Error ? error.message : 'Unknown error',
                ...(isExhausted ? { completedAt: new Date() } : {}),
              },
            }),
            this.prisma.workerNode.update({
              where: { id: this.workerId },
              data: {
                status: WorkerStatus.IDLE,
                currentJobId: null,
                jobsFailed: { increment: 1 },
              },
            }),
          ]);

          throw error; // Let BullMQ handle retry mechanism
        } finally {
          const durationSecs = (Date.now() - startTime) / 1000;
          this.jobDuration.observe({ type: job.name }, durationSecs);
          this.jobsProcessed.inc({ type: job.name, status });
          span.end();
        }
      });
    });
  }

  private async updateDbProgress(id: string, progress: number) {
    await this.prisma.job.update({
      where: { id },
      data: { progress },
    });
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
