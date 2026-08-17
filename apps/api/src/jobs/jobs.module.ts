import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsSweeper } from './jobs.sweeper';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'default',
    }),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobsSweeper,
    makeCounterProvider({
      name: 'jobs_created_total',
      help: 'Total jobs created',
      labelNames: ['type'],
    }),
  ],
  exports: [JobsService],
})
export class JobsModule {}
