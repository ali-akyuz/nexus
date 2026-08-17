import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(
    @InjectQueue('default') private readonly defaultQueue: Queue,
  ) {}

  @Get('queues')
  @ApiOperation({ summary: 'Get queue metrics (Admin only)' })
  async getQueuesStatus() {
    const defaultCounts = await this.defaultQueue.getJobCounts();
    return {
      default: defaultCounts,
    };
  }
}
