import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { type JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobQueryDto } from './dto/job-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new job' })
  async createJob(
    @CurrentUser() user: any,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.createJob(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List jobs for the current user' })
  async getJobs(
    @Request() req: any,
    @Query() query: JobQueryDto,
  ) {
    return this.jobsService.findUserJobs(req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific job' })
  async getJob(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.jobsService.findUserJobById(user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a queued job' })
  async cancelJob(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.jobsService.cancelJob(user.id, id);
  }
}
