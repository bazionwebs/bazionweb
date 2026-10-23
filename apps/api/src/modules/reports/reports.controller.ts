import {
  Controller, Get, Param, Query,
  UseGuards, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, Roles } from '../../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  /** Client: get own monthly reports */
  @Get('me')
  @ApiOperation({ summary: 'Get my monthly reports (client)' })
  findMe(@Request() req: any) {
    return this.svc.findMe(req.user.id);
  }

  /** Admin: get reports for any client */
  @Get('client/:clientId')
  @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get reports for a specific client (admin/support)' })
  findForClient(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Request() req: any,
  ) {
    return this.svc.findForClient(clientId, req.user);
  }

  /** Admin: MRR breakdown by plan tier */
  @Get('mrr')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Monthly Recurring Revenue breakdown (admin)' })
  getMrr(@Query('month') month?: string) {
    return this.svc.getMrr(month);
  }

  /** Admin: Uptime summary across all managed sites */
  @Get('uptime')
  @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Uptime summary — all active hosting accounts (admin)' })
  getUptimeSummary(@Query('days') days = 30) {
    return this.svc.getUptimeSummary(+days);
  }

  /** Admin: aggregate SLA compliance report */
  @Get('sla')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'SLA compliance report across all clients (admin)' })
  getSlaCompliance(@Query('month') month?: string) {
    return this.svc.getSlaCompliance(month);
  }
}
