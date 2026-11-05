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
import {
  DnsResolveDto,
  ImpersonateClientDto,
  RemediateOrphanPaymentDto,
  RemediateDnsSslDto,
  RetryWebhooksBatchDto,
  RemediateInvoiceSyncDto,
  RemediateClientAccessDto,
  RemediateDomainStateDto,
  RemediateProactiveAnomalyDto,
} from './dto/diagnostics.dto';

@ApiTags('admin-diagnostics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller({ path: 'admin/diagnostics', version: '1' })
export class AdminDiagnosticsController {
  constructor(private readonly svc: AdminDiagnosticsService) {}

  // ── Telemetry & Overview ──
  @Get('health')
  @ApiOperation({ summary: 'Get full cluster diagnostics and telemetry' })
  getClusterHealth() {
    return this.svc.getClusterHealth();
  }

  @Get('suite/overview')
  @ApiOperation({ summary: 'Aggregated diagnostic issue counters across all 6 operational categories' })
  getSuiteOverview() {
    return this.svc.getSuiteOverview();
  }

  // ── 1. Orphan & Unapplied Payments ──
  @Get('orphan-payments')
  @ApiOperation({ summary: 'Find orphan or unapplied payment transactions' })
  getOrphanPayments() {
    return this.svc.getOrphanPayments();
  }

  @Post('remediate/orphan-payment')
  @ApiOperation({ summary: 'One-click link and settle orphan payment or credit client' })
  remediateOrphanPayment(@Body() dto: RemediateOrphanPaymentDto, @Request() req: any) {
    return this.svc.remediateOrphanPayment(dto, req.user);
  }

  // ── 2. DNS & SSL Resolver and Fleet Scanner ──
  @Post('dns-resolve')
  @ApiOperation({ summary: 'Live DNS records and SSL chain inspection' })
  resolveDns(@Body() dto: DnsResolveDto) {
    return this.svc.resolveDnsAndSsl(dto.domain);
  }

  @Get('dns-ssl/fleet')
  @ApiOperation({ summary: 'Scan all client hosting domains for DNS & SSL misconfigurations' })
  scanDnsSslFleet() {
    return this.svc.scanDnsSslFleet();
  }

  @Post('remediate/dns-ssl')
  @ApiOperation({ summary: 'One-click refresh SSL certificate or re-issue via Let\'s Encrypt' })
  remediateDnsSsl(@Body() dto: RemediateDnsSslDto, @Request() req: any) {
    return this.svc.remediateDnsSsl(dto, req.user);
  }

  // ── 3. Webhook Stream, Failures & Burst Retries ──
  @Get('webhooks')
  @ApiOperation({ summary: 'Get recent webhook and payment log stream' })
  getWebhookStream(@Query('limit') limit?: number) {
    return this.svc.getWebhookStream(limit ? +limit : 50);
  }

  @Get('webhooks/failures')
  @ApiOperation({ summary: 'Get failed webhook stream and burst anomaly telemetry' })
  getWebhookFailures(@Query('limit') limit?: number) {
    return this.svc.getWebhookFailures(limit ? +limit : 50);
  }

  @Post('webhooks/:id/replay')
  @ApiOperation({ summary: 'Replay / re-verify a webhook payment event' })
  replayWebhook(@Param('id') id: string) {
    return this.svc.replayWebhook(id);
  }

  @Post('remediate/webhooks/retry-all')
  @ApiOperation({ summary: 'One-click batch retry of all failed webhooks within time window' })
  retryWebhooksBatch(@Body() dto: RetryWebhooksBatchDto, @Request() req: any) {
    return this.svc.retryWebhooksBatch(dto?.windowHours || 24, req.user);
  }

  // ── 4. Invoices & Reconciliation ──
  @Get('invoices/unsynced')
  @ApiOperation({ summary: 'Identify invoices with desynchronized totals or statuses' })
  getUnsyncedInvoices() {
    return this.svc.getUnsyncedInvoices();
  }

  @Post('reconcile')
  @ApiOperation({ summary: 'Run on-demand payment & subscription reconciliation' })
  reconcile() {
    return this.svc.runReconciliation();
  }

  @Post('remediate/invoice-sync')
  @ApiOperation({ summary: 'One-click recalculate invoice total or reconcile status' })
  remediateInvoiceSync(@Body() dto: RemediateInvoiceSyncDto, @Request() req: any) {
    return this.svc.remediateInvoiceSync(dto, req.user);
  }

  // ── 5. Client Credential & Access Lockouts ──
  @Get('clients/access-issues')
  @ApiOperation({ summary: 'Find locked, suspended, or uninitialized client accounts' })
  getClientAccessIssues() {
    return this.svc.getClientAccessIssues();
  }

  @Post('remediate/client-access')
  @ApiOperation({ summary: 'One-click unlock client access or generate magic reset token' })
  remediateClientAccess(@Body() dto: RemediateClientAccessDto, @Request() req: any) {
    return this.svc.remediateClientAccess(dto, req.user);
  }

  // ── 6. Suspended Domain States ──
  @Get('domains/suspended')
  @ApiOperation({ summary: 'Find suspended or stuck provisioning hosting domains' })
  getSuspendedDomains() {
    return this.svc.getSuspendedDomains();
  }

  @Post('remediate/domain-state')
  @ApiOperation({ summary: 'One-click unsuspend domain or normalize state to ACTIVE' })
  remediateDomainState(@Body() dto: RemediateDomainStateDto, @Request() req: any) {
    return this.svc.remediateDomainState(dto, req.user);
  }

  // ── 7. Client Impersonation Sandbox ──
  @Post('impersonate')
  @ApiOperation({ summary: 'Issue a scoped read-only view-as client token' })
  impersonate(@Body() dto: ImpersonateClientDto, @Request() req: any) {
    return this.svc.impersonateClient(dto.clientId, req.user);
  }

  // ── 8. Proactive Intelligence & Anomaly Remediation (M3 / R3) ──
  @Get('proactive-scan')
  @ApiOperation({ summary: 'Run proactive health scan detecting expiring SSL, webhook bursts, unapplied payments, and expired quote deposits' })
  getProactiveScan() {
    return this.svc.getProactiveScan();
  }

  @Post('proactive-scan/remediate')
  @ApiOperation({ summary: 'One-click targeted remediation for a proactive anomaly' })
  remediateProactiveAnomaly(
    @Body() dto: RemediateProactiveAnomalyDto,
    @Request() req: any,
  ) {
    return this.svc.remediateProactiveAnomaly(dto, req.user);
  }

  @Post('remediate')
  @ApiOperation({ summary: 'Alias for proactive anomaly remediation' })
  remediateAnomaly(
    @Body() dto: RemediateProactiveAnomalyDto,
    @Request() req: any,
  ) {
    return this.svc.remediateProactiveAnomaly(dto, req.user);
  }
}

