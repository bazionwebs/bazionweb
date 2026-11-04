import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HostingStatus } from '@prisma/client';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentProvider, ProvisionResult } from './providers/deployment-provider.interface';

export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(normalized.slice(7));
  }
  const family = net.isIP(normalized);
  if (family === 4) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    return false;
  }
  return true;
}

@Injectable()
export class HostingService {
  private readonly logger = new Logger(HostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    @Optional()
    private readonly deploymentProvider?: DeploymentProvider,
  ) {}


  async findAll(user: any, filters: { status?: string; page: number; limit: number }) {
    const page = Math.max(1, Math.floor(Number(filters.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(filters.limit) || 25)));
    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    const where: any = { deletedAt: null };

    if (!isStaff) {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client) return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      where.clientId = client.id;
    }

    if (filters.status) {
      const normalizedStatus = filters.status.toUpperCase();
      if (!Object.values(HostingStatus).includes(normalizedStatus as HostingStatus)) {
        throw new BadRequestException(`Invalid hosting status filter: ${filters.status}`);
      }
      where.status = normalizedStatus;
    }

    const [total, items] = await Promise.all([
      this.prisma.hostingAccount.count({ where }),
      this.prisma.hostingAccount.findMany({
        where,
        include: {
          client: { select: { businessName: true, plan: true } },
          _count: { select: { backups: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
   * Runs every day at 04:00 UTC.
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
    if (accounts.length === 0) return;

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const rows = accounts.map((acct) => ({
      hostingAccountId: acct.id,
      type: 'DAILY_INCREMENTAL' as const,
      status: 'PENDING' as const,
      expiresAt,
    }));

    if (typeof (this.prisma.backup as any).createMany === 'function') {
      await this.prisma.backup.createMany({ data: rows });
    } else {
      await Promise.all(rows.map((data) => this.prisma.backup.create({ data })));
    }
    this.logger.log(`Backup records created for ${accounts.length} accounts`);
  }

  private async getSSLExpiry(domain: string): Promise<Date> {
    const cleanHost = domain.trim().toLowerCase();
    if (!cleanHost || net.isIP(cleanHost) !== 0) {
      throw new Error('SSL check requires a public domain hostname');
    }
    const records = await dns.promises.lookup(cleanHost, { all: true });
    if (!records.length || records.some((r) => isPrivateOrReservedIp(r.address))) {
      throw new Error(`Refusing TLS connection to private or reserved address for ${cleanHost}`);
    }
    const targetIp = records[0].address;

    return new Promise((resolve, reject) => {
      const socket = tls.connect(
        { host: targetIp, port: 443, servername: cleanHost, timeout: 10_000 },
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
      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timed out'));
      });
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

    let provisionResult: ProvisionResult | null = null;
    if (this.deploymentProvider && this.deploymentProvider.isConfigured()) {
      try {
        provisionResult = await this.deploymentProvider.createWorkload({
          name: `bazion-${account.id.slice(0, 8)}`,
          projectName: `client-${dto.clientId}`,
          domain: dto.domain,
          clientId: dto.clientId,
          hostingId: account.id,
          buildType: 'dockerfile',
        });
        this.logger.log(
          `Workload provisioned on ${this.deploymentProvider.providerName} for ${dto.domain} (ID: ${provisionResult.workloadId})`,
        );
      } catch (err: any) {
        this.logger.error(
          `Deployment provider provisioning failed for ${dto.domain}: ${err.message}`,
        );
      }
    }

    this.events.emit('hosting.provisioned', { account, provisionResult });
    this.logger.log(`Hosting account created: ${dto.domain} for client ${dto.clientId}`);
    return { data: account, provisionResult: provisionResult ?? undefined };
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
