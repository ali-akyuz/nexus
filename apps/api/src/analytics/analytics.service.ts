import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus, Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async getOverview(userId?: string) {
    const where = userId ? { userId } : {};

    const [total, running, completed, failed, cancelled] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.count({ where: { ...where, status: JobStatus.PROCESSING } }),
      this.prisma.job.count({ where: { ...where, status: JobStatus.COMPLETED } }),
      this.prisma.job.count({ where: { ...where, status: JobStatus.FAILED } }),
      this.prisma.job.count({ where: { ...where, status: JobStatus.CANCELLED } }),
    ]);

    // Active workers and queue depth are global metrics. 
    // Usually, we'd query Redis for exact queue depth, but we can approximate QUEUED status.
    const activeWorkers = await this.prisma.workerNode.count({ where: { status: 'BUSY' } });
    const queueDepth = await this.prisma.job.count({ where: { status: JobStatus.QUEUED } });

    const finished = completed + failed;
    const successRate = finished > 0 ? (completed / finished) * 100 : 0;

    return {
      totalJobs: total,
      runningJobs: running,
      completedJobs: completed,
      failedJobs: failed,
      cancelledJobs: cancelled,
      successRate: parseFloat(successRate.toFixed(2)),
      queueDepth,
      activeWorkers,
    };
  }

  async getJobsTimeSeries(days: number, userId?: string) {
    // Determine interval bucket size
    let interval = '1 day';
    if (days <= 1) interval = '1 hour';

    const timeFilter = new Date();
    timeFilter.setDate(timeFilter.getDate() - days);

    // Using raw SQL to date_trunc and group by status
    const query = userId
      ? Prisma.sql`
          SELECT 
            date_trunc(${interval}, "createdAt") as timestamp,
            "status",
            COUNT(id)::int as count
          FROM jobs
          WHERE "createdAt" >= ${timeFilter} AND "userId" = ${userId}::uuid
          GROUP BY 1, 2
          ORDER BY 1 ASC;
        `
      : Prisma.sql`
          SELECT 
            date_trunc(${interval}, "createdAt") as timestamp,
            "status",
            COUNT(id)::int as count
          FROM jobs
          WHERE "createdAt" >= ${timeFilter}
          GROUP BY 1, 2
          ORDER BY 1 ASC;
        `;

    const rawResults: any[] = await this.prisma.$queryRaw(query);

    // Pivot the data into a structure Recharts likes: { timestamp, completed: X, failed: Y }
    const buckets: Record<string, any> = {};

    rawResults.forEach((row) => {
      const ts = new Date(row.timestamp).toISOString();
      if (!buckets[ts]) {
        buckets[ts] = { timestamp: ts, total: 0, COMPLETED: 0, FAILED: 0, QUEUED: 0, PROCESSING: 0, CANCELLED: 0 };
      }
      buckets[ts][row.status] += row.count;
      buckets[ts].total += row.count;
    });

    return Object.values(buckets);
  }

  async getPerformance(userId?: string) {
    const where = userId ? { userId } : {};

    // For processing time, we average (completedAt - startedAt) for completed jobs
    // Using raw SQL for precise interval averaging
    const query = userId
      ? Prisma.sql`
          SELECT 
            AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt"))) as avg_processing_time,
            AVG(EXTRACT(EPOCH FROM ("startedAt" - "createdAt"))) as avg_queue_wait_time
          FROM jobs
          WHERE "status" = 'COMPLETED' AND "startedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "userId" = ${userId}::uuid;
        `
      : Prisma.sql`
          SELECT 
            AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt"))) as avg_processing_time,
            AVG(EXTRACT(EPOCH FROM ("startedAt" - "createdAt"))) as avg_queue_wait_time
          FROM jobs
          WHERE "status" = 'COMPLETED' AND "startedAt" IS NOT NULL AND "completedAt" IS NOT NULL;
        `;

    const result: any[] = await this.prisma.$queryRaw(query);
    const avgProcessingSeconds = result[0]?.avg_processing_time ? parseFloat(result[0].avg_processing_time) : 0;
    const avgWaitSeconds = result[0]?.avg_queue_wait_time ? parseFloat(result[0].avg_queue_wait_time) : 0;

    return {
      averageProcessingTimeMs: Math.round(avgProcessingSeconds * 1000),
      averageQueueWaitTimeMs: Math.round(avgWaitSeconds * 1000),
    };
  }

  async getJobTypes(userId?: string) {
    const where = userId ? { userId } : {};

    const groupings = await this.prisma.job.groupBy({
      by: ['type', 'status'],
      where,
      _count: { id: true },
    });

    // Pivot
    const types: Record<string, any> = {};
    groupings.forEach((g) => {
      if (!types[g.type]) types[g.type] = { type: g.type, total: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0, PROCESSING: 0, QUEUED: 0 };
      types[g.type][g.status] += g._count.id;
      types[g.type].total += g._count.id;
    });

    return Object.values(types).sort((a, b) => b.total - a.total);
  }
}
