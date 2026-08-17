import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TerminusModule,
    PrismaModule,
    BullModule.registerQueue({ name: 'default' }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
