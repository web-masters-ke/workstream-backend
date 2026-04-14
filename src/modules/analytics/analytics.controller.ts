import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

type Period = '7d' | '30d' | '90d' | 'all';

function parsePeriod(p?: string): Period {
  if (p === '7d' || p === '30d' || p === '90d' || p === 'all') return p;
  return 'all';
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('platform')
  @Roles('ADMIN')
  platform(@Query('period') period?: string) {
    return this.service.platformOverview(parsePeriod(period));
  }

  // GET /analytics/overview — client-web dashboard alias (no admin role required)
  @Get('overview')
  overview(@Query('period') period?: string) {
    return this.service.platformOverview(parsePeriod(period));
  }

  @Get('business/:id')
  @Roles('ADMIN', 'SUPERVISOR', 'BUSINESS')
  businessDashboard(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('period') period?: string,
  ) {
    return this.service.getBusinessDashboard(id, parsePeriod(period));
  }

  @Get('agent/:id')
  @Roles('ADMIN', 'SUPERVISOR', 'AGENT')
  agentDashboard(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('period') period?: string,
  ) {
    return this.service.getAgentDashboard(id, parsePeriod(period));
  }

  // Legacy routes kept for backward compat
  @Get('businesses/:id')
  business(@Param('id', ParseUUIDPipe) id: string, @Query('period') period?: string) {
    return this.service.getBusinessDashboard(id, parsePeriod(period));
  }

  @Get('agents/:id')
  agent(@Param('id', ParseUUIDPipe) id: string, @Query('period') period?: string) {
    return this.service.getAgentDashboard(id, parsePeriod(period));
  }

  @Get('tasks/series')
  series(@Query('days') days?: string) {
    return this.service.tasksByStatusSeries(days ? Number(days) : 30);
  }

  @Get('agents/top/leaderboard')
  topAgents(@Query('limit') limit?: string) {
    return this.service.topAgents(limit ? Number(limit) : 10);
  }
}
