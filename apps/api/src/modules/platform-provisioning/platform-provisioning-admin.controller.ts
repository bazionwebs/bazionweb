import {
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
}

