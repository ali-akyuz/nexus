import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { RealtimeGateway } from './realtime.gateway';
import { QueueEventsListener } from './queue-events.listener';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    JwtModule.register({}),
    JobsModule,
    BullModule.registerQueue({
      name: 'default',
    }),
  ],
  providers: [RealtimeGateway, QueueEventsListener],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
