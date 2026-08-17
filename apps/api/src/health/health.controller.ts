import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HttpHealthIndicator, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private prisma: PrismaService,
    private configService: ConfigService,
    @InjectQueue('default') private readonly defaultQueue: Queue,
  ) {}

  @Get('live')
  checkLiveness() {
    return { status: 'ok', message: 'Nexus API is alive' };
  }

  @Get('ready')
  @HealthCheck()
  async checkReadiness() {
    const queueDepth = await this.defaultQueue.getWaitingCount();
    
    // Check custom readiness including postgres and queue depth
    return this.health.check([
      // A simple raw query to test Postgres liveness since PrismaHealthIndicator is sometimes finicky
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { postgres: { status: 'up' } };
        } catch (e) {
          return { postgres: { status: 'down', message: e.message } };
        }
      },
      // Expose Queue Depth in readiness
      async () => ({
        queue: {
          status: 'up',
          queueDepth,
          maxDepth: this.configService.get('MAX_QUEUE_DEPTH', 500)
        }
      }),
      // Ping ML service if configured
      () => this.http.pingCheck('ml-service', `${this.configService.get('ML_SERVICE_URL', 'http://ml-service:8000')}/health`),
    ]);
  }
}
