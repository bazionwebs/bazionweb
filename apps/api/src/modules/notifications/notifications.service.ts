import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { $Enums } from '@prisma/client';

interface NotificationPayload {
  userId: string;
  type: $Enums.NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly stream$ = new Subject<{ userId: string; notification: Record<string, unknown> }>();

  constructor(private readonly prisma: PrismaService) {}

  // ── SSE stream ─────────────────────────────────────────────────────────────

  /**
   * Returns an Observable that emits SSE events for a specific user.
   * Used by the GET /notifications/stream endpoint.
   */
  streamForUser(userId: string): Observable<{ userId: string; notification: Record<string, unknown> }> {
    return this.stream$.pipe(
      filter(event => event.userId === userId),
    );
  }

  private push(userId: string, notification: Record<string, unknown>) {
    this.stream$.next({ userId, notification });
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(payload: NotificationPayload) {
    const notification = await this.prisma.notification.create({
      data: {
        userId:    payload.userId,
        type:      payload.type,
        title:     payload.title,
        message:   payload.message,
        actionUrl: payload.actionUrl,
        metadata:  payload.metadata as any,
      },
    });

    // Push to SSE stream for real-time delivery
    this.push(payload.userId, {
      id:        notification.id,
      type:      notification.type,
      title:     notification.title,
      message:   notification.message,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  async findAll(userId: string, filters: { read?: boolean; page: number; limit: number }) {
    const where: any = { userId };
    if (filters.read !== undefined) where.read = filters.read;

    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take:  filters.limit,
      }),
    ]);

    return {
      data: items,
      meta: { page: filters.page, limit: filters.limit, total, unread: await this.getUnreadCount(userId) },
    };
  }

  async markRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.userId !== userId) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.notification.update({
      where: { id },
      data:  { read: true },
    });
    return { data: updated };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data:  { read: true },
    });
    return { data: { updated: result.count } };
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  // ── Domain event listeners ─────────────────────────────────────────────────

  @OnEvent('ticket.created')
  async onTicketCreated({ ticket, client }: { ticket: any; client: any }) {
    // Notify all staff of new ticket
    const staff = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'] }, deletedAt: null },
      select: { id: true },
    });

    await Promise.all(
      staff.map(s =>
        this.create({
          userId:    s.id,
          type:      'TICKET_UPDATE',
          title:     `New ${ticket.priority} ticket`,
          message:   `${client.businessName}: ${ticket.subject}`,
          actionUrl: `/admin?tab=tickets&id=${ticket.id}`,
          metadata:  { ticketId: ticket.id, priority: ticket.priority },
        }),
      ),
    );
  }

  @OnEvent('ticket.updated')
  async onTicketUpdated({ ticket }: { ticket: any; client?: any }) {
    if (!ticket.clientId) return;

    const clientRecord = await this.prisma.client.findUnique({
      where: { id: ticket.clientId },
      select: { userId: true },
    });
    if (!clientRecord) return;

    await this.create({
      userId:    clientRecord.userId,
      type:      'TICKET_UPDATE',
      title:     `Ticket updated — ${ticket.priority}`,
      message:   `${ticket.subject}: status changed to ${ticket.status?.replace('_', ' ')}`,
      actionUrl: `/portal/support?ticket=${ticket.id}`,
      metadata:  { ticketId: ticket.id },
    });
  }

  @OnEvent('ticket.commented')
  async onTicketCommented({ ticket, comment }: { ticket: any; comment: any }) {
    if (!ticket?.client?.userId) return;
    await this.create({
      userId:    ticket.client.userId,
      type:      'TICKET_UPDATE',
      title:     `Engineering reply on ${ticket.subject}`,
      message:   String(comment?.body ?? '').slice(0, 140),
      actionUrl: `/portal/support?ticket=${ticket.id}`,
      metadata:  { ticketId: ticket.id, commentId: comment?.id },
    });
  }

  @OnEvent('invoice.created')
  async onInvoiceCreated({ invoice }: { invoice: any }) {
    if (!invoice?.clientId) return;
    const client = await this.prisma.client.findUnique({
      where: { id: invoice.clientId },
      select: { userId: true },
    });
    if (!client) return;

    const currency = invoice.currency || 'USD';
    const formattedAmt = `${currency} ${Number(invoice.amount || 0).toLocaleString()}`;

    await this.create({
      userId:    client.userId,
      type:      'INVOICE_DUE',
      title:     `New invoice — ${formattedAmt}`,
      message:   `Invoice ${invoice.invoiceNumber} is due on ${new Date(invoice.dueDate).toLocaleDateString()}`,
      actionUrl: '/portal/invoices',
      metadata:  { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    });
  }

  @OnEvent('invoice.overdue_batch')
  async onInvoicesOverdue({ count }: { count: number }) {
    // Notify admins of overdue invoices batch
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletedAt: null },
      select: { id: true },
    });

    await Promise.all(
      admins.map(a =>
        this.create({
          userId:    a.id,
          type:      'INVOICE_DUE',
          title:     `${count} invoice${count !== 1 ? 's' : ''} marked overdue`,
          message:   `${count} invoice${count !== 1 ? 's' : ''} past their due date. Review in billing.`,
          actionUrl: '/admin?tab=invoices',
        }),
      ),
    );
  }

  @OnEvent('ssl.expiry_warning')
  async onSslExpiryWarning({ domain, daysLeft, client }: { domain: string; daysLeft: number; client: any }) {
    if (!client?.userId) return;

    await this.create({
      userId:    client.userId,
      type:      'SSL_EXPIRY',
      title:     `SSL expiring in ${daysLeft} days`,
      message:   `The SSL certificate for ${domain} expires in ${daysLeft} days. We will renew it automatically.`,
      actionUrl: '/portal/assets',
      metadata:  { domain, daysLeft },
    });
  }
}
