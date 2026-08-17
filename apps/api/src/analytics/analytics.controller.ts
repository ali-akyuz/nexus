import { Controller, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '@prisma/client';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(@Request() req: any) {
    const userId = req.user.role === Role.ADMIN ? undefined : req.user.id;
    return this.analyticsService.getOverview(userId);
  }

  @Get('jobs')
  async getJobsTimeSeries(@Request() req: any, @Query('range') range: string = '7d') {
    const userId = req.user.role === Role.ADMIN ? undefined : req.user.id;
    
    let days = 7;
    if (range === '24h') days = 1;
    if (range === '30d') days = 30;
    if (range === '90d') days = 90;

    return this.analyticsService.getJobsTimeSeries(days, userId);
  }

  @Get('performance')
  async getPerformance(@Request() req: any) {
    const userId = req.user.role === Role.ADMIN ? undefined : req.user.id;
    return this.analyticsService.getPerformance(userId);
  }

  @Get('types')
  async getJobTypes(@Request() req: any) {
    const userId = req.user.role === Role.ADMIN ? undefined : req.user.id;
    return this.analyticsService.getJobTypes(userId);
  }
}
