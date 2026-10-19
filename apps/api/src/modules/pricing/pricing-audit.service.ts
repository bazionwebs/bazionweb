import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogParams {
  entityType: 'PRICE' | 'PRICE_BOOK' | 'TAX_RULE' | 'MARKET_ADJUSTMENT' | 'MARKET' | 'CURRENCY';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'ARCHIVE' | 'DELETE' | 'ACTIVATE';
  changedBy: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  changeReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class PricingAuditService {
  private readonly logger = new Logger(PricingAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append-only audit logger for all pricing mutations.
   * Maintains immutable history of price books, prices, and tax rules.
   */
  async logChange(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.pricingAuditLog.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          changedBy: params.changedBy,
          oldValues: params.oldValues ? (params.oldValues as any) : undefined,
          newValues: params.newValues ? (params.newValues as any) : undefined,
          changeReason: params.changeReason,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
      this.logger.log(
        `[PricingAudit] ${params.action} on ${params.entityType}:${params.entityId} by user ${params.changedBy}`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to record pricing audit log: ${err.message}`, err.stack);
      // We log error but don't crash to keep application resilient
    }
  }

  /**
   * Retrieve immutable audit history for compliance and verification.
   */
  async getAuditHistory(query: {
    entityType?: string;
    entityId?: string;
    changedBy?: string;
    limit?: number;
  }) {
    const { entityType, entityId, changedBy, limit = 50 } = query;
    return this.prisma.pricingAuditLog.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(changedBy ? { changedBy } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
