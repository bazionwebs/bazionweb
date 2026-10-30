import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, Roles } from '../../common/guards/jwt-auth.guard';
import { AdminDiagnosticsService } from './diagnostics.service';
import { DnsResolveDto, ImpersonateClientDto } from './dto/diagnostics.dto';

@ApiTags('admin-diagnostics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller({ path: 'admin/diagnostics', version: '1' })
export class AdminDiagnosticsController {
  constructor(private readonly svc: AdminDiagnosticsService) {}

  @Get('health')
  @ApiOperation({ summary: 'Get full cluster diagnostics and telemetry' })
  getClusterHealth() {
    return this.svc.getClusterHealth();
  }

  @Post('dns-resolve')
  @ApiOperation({ summary: 'Live DNS records and SSL chain inspection' })
  resolveDns(@Body() dto: DnsResolveDto) {
    return this.svc.resolveDnsAndSsl(dto.domain);
  }

  @Get('webhooks')
  @ApiOperation({ summary: 'Get recent webhook and payment log stream' })
  getWebhookStream(@Query('limit') limit?: number) {
    return this.svc.getWebhookStream(limit ? +limit : 50);
  }

  @Post('webhooks/:id/replay')
  @ApiOperation({ summary: 'Replay / re-verify a webhook payment event' })
  replayWebhook(@Param('id') id: string) {
    return this.svc.replayWebhook(id);
  }

  @Post('reconcile')
  @ApiOperation({ summary: 'Run on-demand payment & subscription reconciliation' })
  reconcile() {
    return this.svc.runReconciliation();
  }

  @Post('impersonate')
  @ApiOperation({ summary: 'Issue a scoped read-only view-as client token' })
  impersonate(@Body() dto: ImpersonateClientDto, @Request() req: any) {
    return this.svc.impersonateClient(dto.clientId, req.user);
  }
}
