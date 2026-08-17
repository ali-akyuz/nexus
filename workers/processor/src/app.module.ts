import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { PrismaService } from './prisma.service';
import { ProcessorService } from './processor.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
        },
      }),
      inject: [ConfigService],
    }),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
    // Register the queue to allow injecting it if we need to emit events or check counts
    BullModule.registerQueue({
      name: 'default',
    }),
  ],
  providers: [
    PrismaService, 
    ProcessorService,
    makeCounterProvider({
      name: 'worker_jobs_processed_total',
      help: 'Total jobs processed by worker',
      labelNames: ['type', 'status'],
    }),
    makeHistogramProvider({
      name: 'worker_job_duration_seconds',
      help: 'Duration of job processing in seconds',
      labelNames: ['type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    }),
  ],
})
export class AppModule {}
