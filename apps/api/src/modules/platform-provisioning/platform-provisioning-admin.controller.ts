import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformOutboxStatus } from '@prisma/client';
import { JwtAuthGuard, Roles } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformProvisioningReconciliationService } from './platform-provisioning-reconciliation.service';
import { PlatformHostingCutoverService } from './platform-hosting-cutover.service';
import { PlatformProvisioningWorkerService } from './platform-provisioning-worker.service';

@ApiTags('admin-platform-provisioning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller({ path: 'admin/platform-provisioning', version: '1' })
export class PlatformProvisioningAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worker: PlatformProvisioningWorkerService,
    private readonly reconciliation: PlatformProvisioningReconciliationService,
    private readonly hostingCutover: PlatformHostingCutoverService,
  ) {}

  @Get('outbox')
  @ApiOperation({ summary: 'List commercial provisioning outbox items (admin)' })
  async listOutbox(
    @Query('status') status?: PlatformOutboxStatus,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    const safeLimit = Math.max(1, Math.min(100, limit));
    const items = await this.prisma.platformProvisioningOutbox.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        invoiceId: true,
        clientId: true,
        externalOrderId: true,
        idempotencyKey: true,
        status: true,
        attemptCount: true,
        maxAttempts: true,
        platformOperationId: true,
        lastHttpStatus: true,
        lastErrorCode: true,
        nextAttemptAt: true,
        acceptedAt: true,
        deadLetteredAt: true,
        createdAt: true,
        updatedAt: true,
        projection: {
          select: {
            operationId: true,
            status: true,
            currentStep: true,
            platformTenantId: true,
            installationId: true,
            failureCode: true,
            platformUpdatedAt: true,
          },
        },
      },
    });
    return { items };
  }

  @Post('outbox/:id/replay')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Replay a dead-lettered or stalled provisioning outbox command' })
  async replayOutbox(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const updated = await this.worker.replayOutboxEntry(id, req.user);
    return {
      outboxId: updated.id,
      status: updated.status,
      maxAttempts: updated.maxAttempts,
    };
  }

  @Get('reconciliation')
  @ApiOperation({ summary: 'Inspect provisioning delivery lag, missing outbox rows, and dead letters' })
  async reconcile(
    @Query('staleMinutes', new ParseIntPipe({ optional: true })) staleMinutes = 5,
  ) {
    return this.reconciliation.getReconciliationReport(staleMinutes);
  }

  @Post('reconciliation/poll-lagging')
  @ApiOperation({ summary: 'Poll platform operations for accepted items lagging callback updates' })
  async pollLagging(
    @Query('staleMinutes', new ParseIntPipe({ optional: true })) staleMinutes = 5,
  ) {
    return this.reconciliation.pollLaggingOperations({ staleMinutes });
  }

  @Post('reconciliation/push')
  @ApiOperation({ summary: 'Push cross-entity reconciliation snapshot to Platform and alert on unresolved drift' })
  async pushReconciliation(
    @Query('staleMinutes', new ParseIntPipe({ optional: true })) staleMinutes = 5,
  ) {
    return this.reconciliation.pushCrossEntityReconciliationSnapshot({ staleMinutes });
  }

  @Get('hosting-cutover')
  @ApiOperation({ summary: 'Compare legacy hosting rows with Platform domain claims before cutover' })
  async hostingCutoverReport(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return this.hostingCutover.getReport(page, limit);
  }

  @Get('hosting-cutover/:id/dual-read')
  @ApiOperation({ summary: 'Run dual-read consistency check between legacy HostingAccount and Platform projection' })
  async hostingCutoverDualRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.hostingCutover.compareHostingProjectionDualRead(id);
  }

  @Post('hosting-cutover/:id/rollback-drill')
  @ApiOperation({ summary: 'Execute and audit a non-destructive hosting cutover rollback drill' })
  async hostingCutoverRollbackDrill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { ticketId?: string; reason?: string },
    @Request() req: any,
  ) {
    return this.hostingCutover.executeAuditedRollbackDrill({
      accountId: id,
      actorId: String(req?.user?.id ?? ''),
      ticketId: String(body?.ticketId ?? ''),
      reason: String(body?.reason ?? ''),
    });
  }
}

