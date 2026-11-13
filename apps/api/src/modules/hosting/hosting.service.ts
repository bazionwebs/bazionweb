import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, ConflictException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HostingStatus } from '@prisma/client';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentProvider, ProvisionResult } from './providers/deployment-provider.interface';
import { resolveHostingTier } from './constants/hosting-tiers.config';
import { resolveServerTopology } from './constants/server-topologies.config';
import { EmailRoutingHelper, EmailDnsConfig } from './email/email-routing.helper';
import { DatabaseTenancyHelper, TenantDatabaseConfig } from './database/database-tenancy.helper';
import { RedisTenancyHelper, TenantRedisConfig } from './cache/redis-tenancy.helper';
import {
  findProvisioningDomainClaims,
  lockProvisioningDomainClaim,
  normalizeProvisioningDomain,
} from '../platform-provisioning/domain-claim-lock';
import { assertLegacyProvisioningPermitted } from '../platform-provisioning/platform-ssot-guard';

const deploymentMappingEvidencePattern = /^(?:CHG|INC|MIG|ROLLBACK|DRILL|TICKET)[-:/#][A-Za-z0-9][A-Za-z0-9._:/#-]{2,292}$/i;

function normalizeHostingDomain(domain: string): string {
  return normalizeProvisioningDomain(domain);
}

function toHostingReadModel(account: Record<string, any>): Record<string, any> {
  const publicAccount = { ...account };
  const isPlatformLinked = Boolean(account.platformDeploymentId);
  const platformProjection = account.platformProjection;
  delete publicAccount.platformDeploymentId;
  delete publicAccount.platformDeploymentMappedAt;
  delete publicAccount.platformDeploymentMappedBy;
  delete publicAccount.platformDeploymentMappingEvidence;
  delete publicAccount.platformProjection;
  if (isPlatformLinked) {
    delete publicAccount.deploymentProvider;
    delete publicAccount.providerWorkloadId;
  }

  return {
    ...publicAccount,
    platformProvisioning: platformProjection
      ? {
          status: platformProjection.status,
          currentStep: platformProjection.currentStep,
          updatedAt: platformProjection.platformUpdatedAt,
        }
      : null,
  };
}

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
    @Optional()
    private readonly config?: ConfigService,
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
          platformProjection: { select: { status: true, currentStep: true, platformUpdatedAt: true } },
          _count: { select: { backups: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: items.map((account) => toHostingReadModel(account as any)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMe(userId: string) {
    const client = await this.prisma.client.findFirst({ where: { userId } });
    if (!client) throw new NotFoundException('Client account not found');

    const accounts = await this.prisma.hostingAccount.findMany({
      where: { clientId: client.id, deletedAt: null },
      include: {
        platformProjection: { select: { status: true, currentStep: true, platformUpdatedAt: true } },
        backups: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return { data: accounts.map((account) => toHostingReadModel(account as any)) };
  }

  async findOne(id: string, user: any) {
    const account = await this.prisma.hostingAccount.findUnique({
      where: { id },
      include: {
        client: { include: { plan: true } },
        platformProjection: { select: { status: true, currentStep: true, platformUpdatedAt: true } },
        backups: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!account || account.deletedAt) throw new NotFoundException('Hosting account not found');

    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    if (!isStaff && account.client.userId !== user.id) throw new ForbiddenException('Access denied');

    return { data: toHostingReadModel(account as any) };
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
    clientId: string;
    domain: string;
    server: string;
    plan: string;
    ipAddress?: string;
    serverOs?: string;
    databaseType?: 'postgresql' | 'mariadb' | 'none';
    emailProvider?: string;
    emailAliases?: string[];
  }) {
    assertLegacyProvisioningPermitted('HostingService.create', this.config);
    const normalizedDomain = normalizeHostingDomain(dto.domain);

    // 1. Validate and resolve plan to canonical tier profile
    const tierProfile = resolveHostingTier(dto.plan);
    if (!tierProfile) {
      throw new BadRequestException(
        `Invalid or unsupported hosting plan tier: "${dto.plan}". Supported tiers: host-essential, host-business, host-professional, host-cloud`,
      );
    }

    // 2. Validate server node topology & reject control plane provisioning
    const targetNode = resolveServerTopology(dto.server);
    if (targetNode.role === 'control-plane' || targetNode.usableMemoryMb === 0) {
      throw new BadRequestException(
        `Tenant workloads cannot be provisioned on control plane node "${targetNode.name}"`,
      );
    }

    // 3. Enforce server node capacity boundaries
    const activeAccounts =
      (await this.prisma.hostingAccount.findMany({
        where: {
          server: { in: [dto.server, targetNode.nodeId, targetNode.name] },
          status: { in: ['ACTIVE', 'PROVISIONING'] },
          deletedAt: null,
        },
        select: { id: true, plan: true, server: true },
      })) || [];

    // 3a. Maximum tenant density boundary check
    if (activeAccounts.length >= targetNode.maxTenantCount) {
      throw new BadRequestException(
        `Server capacity boundary reached: node "${targetNode.name}" has reached its maximum tenant density threshold (${targetNode.maxTenantCount} active containers)`,
      );
    }

    // 3b. Usable memory headroom reservation check
    const currentAllocatedMemoryMb = activeAccounts.reduce((sum, acct) => {
      const p = resolveHostingTier(acct.plan);
      return sum + (p?.memoryReservationMb ?? 256);
    }, 0);

    const availableMemoryMb = targetNode.usableMemoryMb - currentAllocatedMemoryMb;
    if (currentAllocatedMemoryMb + tierProfile.memoryReservationMb > targetNode.usableMemoryMb) {
      throw new BadRequestException(
        `Server memory capacity boundary exceeded: node "${targetNode.name}" has only ${availableMemoryMb}MB available memory headroom, but tier "${tierProfile.name}" requires ${tierProfile.memoryReservationMb}MB reservation`,
      );
    }

    // 4. Generate Corporate Email DNS records & enforce mailbox quotas
    let emailDnsConfig: EmailDnsConfig | undefined;
    const maxInboxes = EmailRoutingHelper.getMaxInboxesForTier(tierProfile.tierId);
    if (maxInboxes > 0 || (dto.emailAliases && dto.emailAliases.length > 0)) {
      emailDnsConfig = EmailRoutingHelper.generateEmailDnsRecords(
        dto.domain,
        dto.emailProvider || 'CLOUDFLARE_EMAIL_ROUTING',
        dto.emailAliases,
        tierProfile.tierId,
      );
    }

    // 5. Generate Tenant Database configuration (shared vs dedicated)
    let tenantDbConfig: TenantDatabaseConfig | undefined;
    if (dto.databaseType !== 'none') {
      tenantDbConfig = DatabaseTenancyHelper.provisionTenantDatabase({
        domain: dto.domain,
        clientId: dto.clientId,
        plan: tierProfile.tierId,
        type: (dto.databaseType as any) || 'postgresql',
        isDedicated: tierProfile.database === 'dedicated',
      });
    }

    // 6. Generate Tenant Redis Cache configuration (Host Pro & Managed Cloud)
    let tenantRedisConfig: TenantRedisConfig | undefined;
    if (
      tierProfile.tierId === 'host-professional' ||
      tierProfile.tierId === 'host-cloud' ||
      tierProfile.redis === 'dedicated'
    ) {
      tenantRedisConfig = RedisTenancyHelper.provisionTenantRedis({
        domain: dto.domain,
        clientId: dto.clientId,
        plan: tierProfile.tierId,
        isDedicated: tierProfile.redis === 'dedicated',
      });
    }

    // 7. Persist HostingAccount in database
    const account = await this.prisma.$transaction(async (tx: any) => {
      await lockProvisioningDomainClaim(tx, normalizedDomain);
      const domainClaims = await findProvisioningDomainClaims(tx, normalizedDomain);
      if (domainClaims.length > 0) {
        throw new ConflictException(
          'This normalized domain is already claimed by another hosting account or Platform provisioning order. Resolve ownership before direct Dokploy provisioning.',
        );
      }

      return tx.hostingAccount.create({
        data: {
          clientId: dto.clientId,
          domain: normalizedDomain,
          server: targetNode.nodeId,
          plan: tierProfile.tierId,
          status: 'PROVISIONING',
          ipAddress: dto.ipAddress,
          serverOs: dto.serverOs,
        },
        include: { client: { select: { businessName: true } } },
      });
    });

    // 8. Inject Environment Variables into container workload
    const workloadEnv: Record<string, string> = {
      DOMAIN: dto.domain,
      NODE_ENV: 'production',
    };
    if (tenantDbConfig) {
      workloadEnv.DATABASE_URL = tenantDbConfig.connectionString;
      workloadEnv.DB_NAME = tenantDbConfig.databaseName;
      workloadEnv.DB_USER = tenantDbConfig.databaseUser;
      workloadEnv.DB_PASSWORD = tenantDbConfig.password;
    }
    if (tenantRedisConfig) {
      workloadEnv.REDIS_URL = tenantRedisConfig.connectionString;
      workloadEnv.REDIS_PREFIX = tenantRedisConfig.keyPrefix;
    }
    if (emailDnsConfig) {
      workloadEnv.EMAIL_PROVIDER = emailDnsConfig.provider;
    }

    // 9. Provision container workload with strict cgroups resource limits
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
          env: workloadEnv,
          resourceLimits: {
            cpus: tierProfile.cpus,
            memoryLimitMb: tierProfile.memoryLimitMb,
            memoryReservationMb: tierProfile.memoryReservationMb,
            memorySwapMb: tierProfile.memorySwapMb,
            pidsLimit: tierProfile.pidsLimit,
            restartPolicy: tierProfile.restartPolicy,
          },
          metadata: {
            database: tenantDbConfig
              ? {
                  name: tenantDbConfig.databaseName,
                  type: tenantDbConfig.type,
                  isDedicated: tenantDbConfig.isDedicated,
                }
              : undefined,
            redis: tenantRedisConfig
              ? {
                  prefix: tenantRedisConfig.keyPrefix,
                  isDedicated: tenantRedisConfig.isDedicated,
                }
              : undefined,
            emailDns: emailDnsConfig
              ? {
                  provider: emailDnsConfig.provider,
                  maxInboxes: emailDnsConfig.maxInboxes,
                }
              : undefined,
          },
        });
        if (!provisionResult.workloadId) {
          throw new Error('Deployment provider did not return a workload reference');
        }
        await this.prisma.hostingAccount.update({
          where: { id: account.id },
          data: {
            deploymentProvider: provisionResult.providerId ?? this.deploymentProvider.providerName,
            providerWorkloadId: provisionResult.workloadId,
          },
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

    // 10. Emit enriched event
    this.events.emit('hosting.provisioned', {
      account,
      provisionResult,
      database: tenantDbConfig,
      redis: tenantRedisConfig,
      emailDns: emailDnsConfig,
    });

    this.logger.log(`Hosting account created: ${dto.domain} for client ${dto.clientId}`);

    return {
      data: account,
      provisionResult: provisionResult ?? undefined,
      database: tenantDbConfig
        ? {
            databaseName: tenantDbConfig.databaseName,
            databaseUser: tenantDbConfig.databaseUser,
            host: tenantDbConfig.host,
            port: tenantDbConfig.port,
            type: tenantDbConfig.type,
            isDedicated: tenantDbConfig.isDedicated,
            provisioningSql: tenantDbConfig.provisioningSql,
          }
        : undefined,
      redis: tenantRedisConfig
        ? {
            host: tenantRedisConfig.host,
            port: tenantRedisConfig.port,
            keyPrefix: tenantRedisConfig.keyPrefix,
            isDedicated: tenantRedisConfig.isDedicated,
            aclUserCommand: tenantRedisConfig.aclUserCommand,
          }
        : undefined,
      emailDns: emailDnsConfig ?? undefined,
    };
  }

  async updateAccount(id: string, dto: Record<string, unknown>) {
    const account = await this.prisma.hostingAccount.findUnique({ where: { id } });
    if (!account || account.deletedAt) throw new NotFoundException('Hosting account not found');
    if (account.platformDeploymentId && dto.status !== undefined && dto.status !== account.status) {
      throw new ConflictException('Platform-linked hosting status is read-only in Bazionweb; manage its deployment in Bazion Platform.');
    }

    const updated = await this.prisma.hostingAccount.update({
      where: { id },
      data: dto as any,
      include: { client: { select: { businessName: true } } },
    });

    return { data: updated };
  }

  async linkPlatformDeployment(
    id: string,
    platformDeploymentId: string,
    evidenceRef: string,
    actor: { id?: string },
  ) {
    const cleanEvidenceRef = typeof evidenceRef === 'string' ? evidenceRef.trim() : '';
    if (!deploymentMappingEvidencePattern.test(cleanEvidenceRef)) {
      throw new BadRequestException('A valid change ticket or migration evidence reference is required.');
    }
    if (!actor?.id) throw new ForbiddenException('An authenticated operator is required to record a deployment mapping.');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await tx.hostingAccount.findUnique({
          where: { id },
          select: {
            id: true,
            clientId: true,
            domain: true,
            deletedAt: true,
            platformDeploymentId: true,
          },
        });
        if (!account || account.deletedAt) throw new NotFoundException('Hosting account not found');

        const projection = await tx.platformProvisioningProjection.findUnique({
          where: { platformDeploymentId },
          select: {
            id: true,
            clientId: true,
            platformTenantId: true,
            requestedDomain: true,
            platformDeploymentId: true,
            status: true,
            externalOrderId: true,
          },
        });
        if (!projection) throw new NotFoundException('Platform deployment projection not found');
        if (projection.status !== 'ready' || !projection.platformTenantId) {
          throw new ConflictException('Only a ready Platform provisioning operation can be linked.');
        }
        if (!projection.clientId || projection.clientId !== account.clientId) {
          throw new ConflictException('Hosting account and Platform deployment belong to different or unresolved clients.');
        }
        const normalizedAccountDomain = normalizeProvisioningDomain(account.domain);
        const normalizedRequestedDomain = projection.requestedDomain
          ? normalizeProvisioningDomain(projection.requestedDomain)
          : null;
        if (!normalizedRequestedDomain || normalizedRequestedDomain !== normalizedAccountDomain) {
          throw new ConflictException('The Platform order domain does not exactly match the legacy hosting account domain.');
        }
        if (account.platformDeploymentId) {
          if (account.platformDeploymentId === platformDeploymentId) {
            return { data: { hostingAccountId: account.id, platformDeploymentId, alreadyLinked: true } };
          }
          throw new ConflictException('This hosting account is already linked to a different Platform deployment.');
        }

        await lockProvisioningDomainClaim(tx, normalizedAccountDomain);
        const competingDomainClaims = await findProvisioningDomainClaims(
          tx,
          normalizedAccountDomain,
          {
            excludeExternalOrderId: projection.externalOrderId,
            excludeHostingAccountId: account.id,
          },
        );
        if (competingDomainClaims.length > 0) {
          throw new ConflictException(
            'The domain has another legacy hosting account or Platform provisioning claim. Review the cutover inventory and resolve all competing claims before mapping.',
          );
        }

        const now = new Date();
        const linked = await tx.hostingAccount.updateMany({
          where: { id: account.id, deletedAt: null, platformDeploymentId: null },
          data: {
            platformDeploymentId,
            platformDeploymentMappedAt: now,
            platformDeploymentMappedBy: actor.id,
            platformDeploymentMappingEvidence: cleanEvidenceRef,
          },
        });
        if (linked.count !== 1) {
          throw new ConflictException('Hosting account mapping changed concurrently; reload and verify before retrying.');
        }

        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'hosting.platform_deployment.link',
            resourceType: 'HostingAccount',
            resourceId: account.id,
            oldValue: { platformDeploymentId: null },
            newValue: {
              platformDeploymentId,
              externalOrderId: projection.externalOrderId,
              domain: normalizedAccountDomain,
              evidenceRef: cleanEvidenceRef,
            },
          },
        });

        return {
          data: {
            hostingAccountId: account.id,
            platformDeploymentId,
            alreadyLinked: false,
            mappedAt: now.toISOString(),
            evidenceRef: cleanEvidenceRef,
          },
        };
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('This Platform deployment is already linked to another hosting account.');
      }
      throw error;
    }
  }

  async unlinkPlatformDeployment(id: string, evidenceRef: string, actor: { id?: string }) {
    const cleanEvidenceRef = typeof evidenceRef === 'string' ? evidenceRef.trim() : '';
    if (!deploymentMappingEvidencePattern.test(cleanEvidenceRef)) {
      throw new BadRequestException('A valid rollback change ticket or drill evidence reference is required.');
    }
    if (!actor?.id) throw new ForbiddenException('An authenticated operator is required to record a deployment rollback.');

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.hostingAccount.findUnique({
        where: { id },
        select: { id: true, domain: true, deletedAt: true, platformDeploymentId: true, platformDeploymentMappingEvidence: true },
      });
      if (!account || account.deletedAt) throw new NotFoundException('Hosting account not found');
      if (!account.platformDeploymentId) {
        return { data: { hostingAccountId: account.id, platformDeploymentId: null, alreadyUnlinked: true } };
      }

      const deploymentId = account.platformDeploymentId;
      const result = await tx.hostingAccount.updateMany({
        where: { id: account.id, deletedAt: null, platformDeploymentId: deploymentId },
        data: {
          platformDeploymentId: null,
          platformDeploymentMappedAt: null,
          platformDeploymentMappedBy: null,
          platformDeploymentMappingEvidence: null,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException('Hosting account mapping changed concurrently; reload before retrying the rollback.');
      }

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'hosting.platform_deployment.unlink',
          resourceType: 'HostingAccount',
          resourceId: account.id,
          oldValue: {
            platformDeploymentId: deploymentId,
            mappingEvidenceRef: account.platformDeploymentMappingEvidence,
          },
          newValue: {
            platformDeploymentId: null,
            rollbackEvidenceRef: cleanEvidenceRef,
            domain: account.domain.trim().toLowerCase().replace(/\.$/, ''),
          },
        },
      });

      return {
        data: {
          hostingAccountId: account.id,
          platformDeploymentId: null,
          alreadyUnlinked: false,
          rollbackEvidenceRef: cleanEvidenceRef,
        },
      };
    });
  }
}
