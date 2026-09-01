import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as tls from 'tls';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HostingService {
  private readonly logger = new Logger(HostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async findAll(user: any, filters: { status?: string; page: number; limit: number }) {
    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    const where: any = { deletedAt: null };

    if (!isStaff) {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client) return { data: [] };
      where.clientId = client.id;
    }

    if (filters.status) where.status = filters.status.toUpperCase();

    const [total, items] = await Promise.all([
      this.prisma.hostingAccount.count({ where }),
      this.prisma.hostingAccount.findMany({
        where,
        include: {
          client: { select: { businessName: true, plan: true } },
          _count: { select: { backups: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: items,
      meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  async findMe(userId: string) {
    const client = await this.prisma.client.findFirst({ where: { userId } });
    if (!client) throw new NotFoundException('Client account not found');

    const accounts = await this.prisma.hostingAccount.findMany({
      where: { clientId: client.id, deletedAt: null },
      include: {
        backups: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return { data: accounts };
  }

  async findOne(id: string, user: any) {
    const account = await this.prisma.hostingAccount.findUnique({
      where: { id },
      include: {
        client: { include: { plan: true } },
        backups: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!account || account.deletedAt) throw new NotFoundException('Hosting account not found');

    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    if (!isStaff && account.client.userId !== user.id) throw new ForbiddenException('Access denied');

    return { data: account };
  }

  /**
   * Check SSL expiry for all active hosting accounts.
   * Runs every day at 07:00 EAT (04:00 UTC).
   * Emits alerts for certificates expiring within 30 days.
   */
  @Cron('0 4 * * *', { name: 'ssl-expiry-check' })
  async checkSslExpiry() {
    this.logger.log('Running SSL expiry check...');
    const WARN_DAYS = 30;
    const warnDate = new Date(Date.now() + WARN_DAYS * 24 * 60 * 60 * 1000);

    const accounts = await this.prisma.hostingAccount.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      include: { client: { select: { id: true, businessName: true, email: true, userId: true } } },
    });

    for (const acct of accounts) {
      try {
        const expiry = await this.getSSLExpiry(acct.domain);
        await this.prisma.hostingAccount.update({
          where: { id: acct.id },
          data: { sslExpiry: expiry },
        });

        if (expiry < warnDate) {
          const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86400000);
          this.logger.warn(`SSL expiring in ${daysLeft}d: ${acct.domain}`);
          this.events.emit('ssl.expiry_warning', {
            domain: acct.domain,
            daysLeft,
            client: acct.client,
            expiry,
          });
        }
      } catch (err) {
        this.logger.error(`SSL check failed for ${acct.domain}: ${err}`);
      }
    }
  }

  /** Trigger daily backup record creation for all active hosting accounts. */
  @Cron('30 1 * * *', { name: 'daily-backup-trigger' })
  async triggerDailyBackups() {
    this.logger.log('Triggering daily backups...');
    const accounts = await this.prisma.hostingAccount.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
    });

    for (const acct of accounts) {
      await this.prisma.backup.create({
        data: {
          hostingAccountId: acct.id,
          type: 'DAILY_INCREMENTAL',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    this.logger.log(`Backup records created for ${accounts.length} accounts`);
  }

  private getSSLExpiry(domain: string): Promise<Date> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect(
        { host: domain, port: 443, servername: domain, timeout: 10_000 },
        () => {
          const cert = socket.getPeerCertificate();
          socket.destroy();
          if (cert?.valid_to) {
            resolve(new Date(cert.valid_to));
          } else {
            reject(new Error('No certificate found'));
          }
        },
      );
      socket.on('error', reject);
      socket.on('timeout', () => reject(new Error('Connection timed out')));
    });
  }

  async create(dto: {
    clientId: string; domain: string; server: string;
    plan: string; ipAddress?: string; serverOs?: string;
  }) {
    const account = await this.prisma.hostingAccount.create({
      data: {
        clientId:  dto.clientId,
        domain:    dto.domain,
        server:    dto.server,
        plan:      dto.plan,
        status:    'PROVISIONING',
        ipAddress: dto.ipAddress,
        serverOs:  dto.serverOs,
      },
      include: { client: { select: { businessName: true } } },
    });

    this.events.emit('hosting.provisioned', { account });
    this.logger.log(`Hosting account created: ${dto.domain} for client ${dto.clientId}`);
    return { data: account };
  }

  async updateAccount(id: string, dto: Record<string, unknown>) {
    const account = await this.prisma.hostingAccount.findUnique({ where: { id } });
    if (!account || account.deletedAt) throw new NotFoundException('Hosting account not found');

    const updated = await this.prisma.hostingAccount.update({
      where: { id },
      data: dto as any,
      include: { client: { select: { businessName: true } } },
    });

    return { data: updated };
  }
}
