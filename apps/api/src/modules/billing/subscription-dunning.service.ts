import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientStatus,
  InvoiceStatus,
  NotificationType,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionLifecycleOutboxService } from '../platform-provisioning/subscription-lifecycle-outbox.service';

export interface DunningSweepSummary {
  invoicesMarkedOverdue: number;
  gracedCount: number;
  remindedCount: number;
  suspendedCount: number;
}

@Injectable()
export class SubscriptionDunningService {
  private readonly logger = new Logger(SubscriptionDunningService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly lifecycleOutbox?: SubscriptionLifecycleOutboxService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private getGraceDays(): number {
    const raw = Number(this.config?.get('BILLING_GRACE_PERIOD_DAYS') ?? 7);
    return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 7;
  }

  private getMaxAttempts(): number {
    const raw = Number(this.config?.get('BILLING_DUNNING_MAX_ATTEMPTS') ?? 3);
    return Number.isFinite(raw) && raw >= 2 ? Math.trunc(raw) : 3;
  }

  private getRetryIntervalHours(): number {
    const raw = Number(this.config?.get('BILLING_DUNNING_RETRY_HOURS') ?? 24);
    return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 24;
  }

  /**
   * Transitions newly overdue invoices into an active grace period first (`PAST_DUE` + `grace` lifecycle event),
   * sends progressive dunning notices, and suspends (`SUSPENDED` + `suspend` lifecycle event) ONLY after
   * grace expiration AND max dunning attempts have both been exhausted.
   */
  async processOverdueAndDunning(now: Date = new Date()): Promise<DunningSweepSummary> {
    const marked = await this.prisma.invoice.updateMany({
      where: {
        status: InvoiceStatus.SENT,
        dueDate: { lt: now },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    const graceDays = this.getGraceDays();
    const maxAttempts = this.getMaxAttempts();
    const retryIntervalMs = this.getRetryIntervalHours() * 3_600_000;

    const overdueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        invoices: {
          some: { status: InvoiceStatus.OVERDUE },
        },
      },
      include: {
        client: { select: { id: true, userId: true, status: true } },
        invoices: {
          where: { status: InvoiceStatus.OVERDUE },
          orderBy: { dueDate: 'asc' },
          take: 1,
          select: { id: true, invoiceNumber: true, dueDate: true },
        },
      },
    });

    let gracedCount = 0;
    let remindedCount = 0;
    let suspendedCount = 0;

    for (const sub of overdueSubscriptions) {
      const oldestOverdue = sub.invoices[0];
      if (!oldestOverdue) continue;

      const outcome = await this.prisma.$transaction(async (tx: any) => {
        const current = await tx.subscription.findUnique({
          where: { id: sub.id },
          include: { client: { select: { id: true, userId: true } } },
        });
        if (!current) return 'skipped' as const;

        const openOverdueCount = await tx.invoice.count({
          where: { subscriptionId: current.id, status: InvoiceStatus.OVERDUE },
        });
        if (openOverdueCount === 0) return 'skipped' as const;

        if (current.status === SubscriptionStatus.ACTIVE) {
          const graceEndsAt = new Date(now.getTime() + graceDays * 86_400_000);
          await tx.subscription.update({
            where: { id: current.id },
            data: {
              status: SubscriptionStatus.PAST_DUE,
              gracePeriodEnd: graceEndsAt,
              dunningAttemptsCount: 1,
              lastDunningAt: now,
            },
          });

          if (current.client?.userId && typeof tx.notification?.create === 'function') {
            await tx.notification.create({
              data: {
                userId: current.client.userId,
                type: NotificationType.INVOICE_DUE,
                title: 'Invoice past due — grace period active',
                message: `Invoice ${oldestOverdue.invoiceNumber} is overdue. Your service remains active until ${graceEndsAt.toISOString().slice(0, 10)}. Please settle to avoid interruption.`,
                actionUrl: '/portal/invoices',
                metadata: {
                  subscriptionId: current.id,
                  invoiceId: oldestOverdue.id,
                  attempt: 1,
                  graceEndsAt: graceEndsAt.toISOString(),
                },
              },
            });
          }

          await this.lifecycleOutbox?.enqueueForSubscription(tx, {
            subscriptionId: current.id,
            clientId: current.clientId,
            action: 'grace',
            reasonCode: 'INVOICE_OVERDUE_GRACE',
            effectiveAt: now,
            graceEndsAt,
            idempotencyKey: `sub-dunning:${current.id}:grace:${oldestOverdue.id}`,
          });

          return 'graced' as const;
        }

        if (current.status === SubscriptionStatus.PAST_DUE) {
          const graceEnd =
            current.gracePeriodEnd ?? new Date(now.getTime() + graceDays * 86_400_000);
          const cooldownElapsed =
            !current.lastDunningAt ||
            now.getTime() - current.lastDunningAt.getTime() >= retryIntervalMs;
          const graceExpired = graceEnd.getTime() <= now.getTime();

          if (!cooldownElapsed && !graceExpired) {
            return 'skipped' as const;
          }

          const nextAttempt = cooldownElapsed
            ? current.dunningAttemptsCount + 1
            : current.dunningAttemptsCount;

          if (graceExpired && nextAttempt >= maxAttempts) {
            await tx.subscription.update({
              where: { id: current.id },
              data: {
                status: SubscriptionStatus.SUSPENDED,
                dunningAttemptsCount: nextAttempt,
                lastDunningAt: now,
              },
            });

            const remainingActiveSubs = await tx.subscription.count({
              where: {
                clientId: current.clientId,
                id: { not: current.id },
                status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE] },
              },
            });
            if (remainingActiveSubs === 0) {
              await tx.client.update({
                where: { id: current.clientId },
                data: { status: ClientStatus.SUSPENDED },
              });
            }

            if (current.client?.userId && typeof tx.notification?.create === 'function') {
              await tx.notification.create({
                data: {
                  userId: current.client.userId,
                  type: NotificationType.INVOICE_DUE,
                  title: 'Service temporarily suspended for overdue balance',
                  message: `Your billing grace period has ended after ${nextAttempt} dunning reminders. Pay invoice ${oldestOverdue.invoiceNumber} to restore full access immediately.`,
                  actionUrl: '/portal/invoices',
                  metadata: {
                    subscriptionId: current.id,
                    invoiceId: oldestOverdue.id,
                    attempt: nextAttempt,
                    suspended: true,
                  },
                },
              });
            }

            await this.lifecycleOutbox?.enqueueForSubscription(tx, {
              subscriptionId: current.id,
              clientId: current.clientId,
              action: 'suspend',
              reasonCode: 'GRACE_EXPIRED_DUNNING_EXHAUSTED',
              effectiveAt: now,
              idempotencyKey: `sub-dunning:${current.id}:suspend:${oldestOverdue.id}`,
            });

            return 'suspended' as const;
          }

          if (cooldownElapsed) {
            await tx.subscription.update({
              where: { id: current.id },
              data: {
                gracePeriodEnd: graceEnd,
                dunningAttemptsCount: nextAttempt,
                lastDunningAt: now,
              },
            });

            if (current.client?.userId && typeof tx.notification?.create === 'function') {
              await tx.notification.create({
                data: {
                  userId: current.client.userId,
                  type: NotificationType.INVOICE_DUE,
                  title: `Payment reminder (${nextAttempt}/${maxAttempts})`,
                  message: `Invoice ${oldestOverdue.invoiceNumber} remains unpaid. Pay before ${graceEnd.toISOString().slice(0, 10)} to prevent suspension.`,
                  actionUrl: '/portal/invoices',
                  metadata: {
                    subscriptionId: current.id,
                    invoiceId: oldestOverdue.id,
                    attempt: nextAttempt,
                    graceEndsAt: graceEnd.toISOString(),
                  },
                },
              });
            }

            return 'reminded' as const;
          }
        }

        return 'skipped' as const;
      });

      if (outcome === 'graced') gracedCount += 1;
      else if (outcome === 'reminded') remindedCount += 1;
      else if (outcome === 'suspended') suspendedCount += 1;
    }

    if (marked.count > 0 || gracedCount > 0 || suspendedCount > 0) {
      this.logger.log(
        `Dunning sweep: markedOverdue=${marked.count}, graced=${gracedCount}, reminded=${remindedCount}, suspended=${suspendedCount}`,
      );
    }

    return {
      invoicesMarkedOverdue: marked.count,
      gracedCount,
      remindedCount,
      suspendedCount,
    };
  }

  /**
   * Cancels a subscription while preserving customer records and publishing a signed `cancel` lifecycle command.
   */
  async cancelSubscriptionWithSync(input: {
    subscriptionId: string;
    reasonCode?: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const reasonCode = input.reasonCode ?? 'CUSTOMER_CANCELLED';

    return this.prisma.$transaction(async (tx: any) => {
      const sub = await tx.subscription.update({
        where: { id: input.subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: now,
        },
      });

      await this.lifecycleOutbox?.enqueueForSubscription(tx, {
        subscriptionId: sub.id,
        clientId: sub.clientId,
        action: 'cancel',
        reasonCode,
        effectiveAt: now,
        idempotencyKey: `sub-cancel:${sub.id}:${now.toISOString()}`,
      });

      return sub;
    });
  }
}
