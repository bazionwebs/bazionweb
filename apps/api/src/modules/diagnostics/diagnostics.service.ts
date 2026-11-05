import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';
import * as jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentSettlementService } from '../billing/payment-settlement.service';
import { PaystackService } from '../billing/paystack.service';
import { DarajaService } from '../billing/daraja.service';
import { DokployProvider } from '../hosting/providers/dokploy.provider';
import { AuthService } from '../auth/auth.service';
import { isPrivateOrReservedIp } from '../hosting/hosting.service';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import {
  RemediateOrphanPaymentDto,
  RemediateDnsSslDto,
  RemediateInvoiceSyncDto,
  RemediateClientAccessDto,
  RemediateDomainStateDto,
  RemediateProactiveAnomalyDto,
} from './dto/diagnostics.dto';
import { provisionProjectFromProposalInvoice } from '../projects/project-provisioning.util';


export interface WebhookLogItem {
  id: string;
  gateway: string;
  event: string;
  status: string;
  createdAt: string;
  reference: string;
  amount: number;
  currency: string;
  client: string;
  method: string;
  errorMessage?: string | null;
}

@Injectable()
export class AdminDiagnosticsService {
  private readonly logger = new Logger(AdminDiagnosticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settlement: PaymentSettlementService,
    private readonly paystack: PaystackService,
    private readonly daraja: DarajaService,
    @Optional() private readonly dokploy?: DokployProvider,
    @Optional() private readonly auth?: AuthService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Cluster Health & Base Telemetry
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Comprehensive telemetry for superadmin health dashboard.
   */
  async getClusterHealth() {
    const startDb = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startDb;

    const mem = process.memoryUsage();
    const uptimeSec = process.uptime();

    const [clientCount, invoiceCount, ticketCount, pendingPaymentCount] =
      await Promise.all([
        this.prisma.client.count({ where: { deletedAt: null } }),
        this.prisma.invoice.count(),
        this.prisma.ticket.count({
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        }),
        this.prisma.paymentLog.count({
          where: { status: PaymentStatus.PENDING },
        }),
      ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(uptimeSec),
      database: {
        status: 'up',
        latencyMs: dbLatencyMs,
        activeClients: clientCount,
        totalInvoices: invoiceCount,
        openTickets: ticketCount,
        pendingPayments: pendingPaymentCount,
      },
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
      environment: {
        nodeEnv: this.config.get<string>('NODE_ENV') || 'development',
        paystackConfigured: Boolean(this.config.get<string>('PAYSTACK_SECRET_KEY')),
        darajaConfigured: this.daraja.isConfigured(),
        jwtConfigured: Boolean(this.config.get<string>('JWT_SECRET')),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. DNS & SSL Single Inspector & Fleet Scanner
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Live DNS record resolution and SSL certificate inspection with SSRF guards.
   */
  async resolveDnsAndSsl(domain: string) {
    const cleanHost = domain.trim().toLowerCase();
    if (!cleanHost || net.isIP(cleanHost) !== 0) {
      throw new BadRequestException('A valid domain name is required');
    }

    const records: Array<{ type: string; target: string; priority?: number }> = [];

    try {
      const a = await dns.promises.resolve4(cleanHost);
      a.forEach(ip => records.push({ type: 'A', target: ip }));
    } catch {}

    try {
      const cname = await dns.promises.resolveCname(cleanHost);
      cname.forEach(c => records.push({ type: 'CNAME', target: c }));
    } catch {}

    try {
      const mx = await dns.promises.resolveMx(cleanHost);
      mx.forEach(m => records.push({ type: 'MX', target: m.exchange, priority: m.priority }));
    } catch {}

    try {
      const txt = await dns.promises.resolveTxt(cleanHost);
      txt.forEach(t => records.push({ type: 'TXT', target: t.join(' ') }));
    } catch {}

    const ip = records.find(r => r.type === 'A')?.target;
    let sslValid = false;
    let sslIssuer = 'None detected';
    let sslExpires = 'Unknown';
    let daysLeft: number | null = null;

    if (ip && !isPrivateOrReservedIp(ip)) {
      try {
        const cert = await this.inspectTlsCert(cleanHost, ip);
        if (cert.valid_to) {
          const expDate = new Date(cert.valid_to);
          sslValid = expDate.getTime() > Date.now();
          sslExpires = expDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          daysLeft = Math.floor((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const rawIssuer = cert.issuer as any;
          sslIssuer = Array.isArray(rawIssuer?.O)
            ? rawIssuer.O[0]
            : rawIssuer?.O || rawIssuer?.CN || 'Standard CA';
        }
      } catch (err: any) {
        this.logger.debug(`SSL check failed for ${cleanHost}: ${err.message}`);
      }
    }

    const cloudflareProxied = records.some(
      r =>
        r.type === 'A' &&
        (r.target.startsWith('104.') ||
          r.target.startsWith('172.67.') ||
          r.target.startsWith('162.159.')),
    );

    return {
      domain: cleanHost,
      ip: ip || 'Unresolved',
      cloudflareProxied,
      sslValid,
      sslIssuer,
      sslExpires,
      sslDaysLeft: daysLeft,
      records,
    };
  }

  /**
   * Scan all client hosting domains across the platform fleet for DNS & SSL misconfigurations.
   */
  async scanDnsSslFleet() {
    const accounts = await this.prisma.hostingAccount.findMany({
      where: { deletedAt: null },
      include: {
        client: { select: { id: true, businessName: true, status: true, contactName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const now = Date.now();
    const domains = await Promise.all(
      accounts.map(async (acc) => {
        let resolvedIp: string | null = null;
        let dnsOk = false;
        let isCloudflare = false;

        try {
          const ips = await dns.promises.resolve4(acc.domain);
          if (ips.length > 0) {
            resolvedIp = ips[0];
            isCloudflare = ips.some(
              (ip) =>
                ip.startsWith('104.') ||
                ip.startsWith('172.67.') ||
                ip.startsWith('162.159.'),
            );
            dnsOk =
              isCloudflare ||
              (acc.ipAddress ? ips.includes(acc.ipAddress) : !isPrivateOrReservedIp(resolvedIp));
          }
        } catch {
          dnsOk = false;
        }

        let sslValid = false;
        let sslDaysLeft: number | null = null;
        let sslIssuer = acc.sslIssuer || 'Unknown';
        let handshakeError = false;

        if (acc.sslExpiry) {
          const expTime = new Date(acc.sslExpiry).getTime();
          sslValid = expTime > now;
          sslDaysLeft = Math.floor((expTime - now) / 86_400_000);
        }

        // Live check only if no cached expiry in database and not a private/reserved IP (SSRF protection)
        if (resolvedIp && !isPrivateOrReservedIp(resolvedIp) && !acc.sslExpiry) {
          try {
            const cert = await this.inspectTlsCert(acc.domain, resolvedIp);
            if (cert.valid_to) {
              const expDate = new Date(cert.valid_to);
              sslValid = expDate.getTime() > now;
              sslDaysLeft = Math.floor((expDate.getTime() - now) / 86_400_000);
              const rawIssuer = cert.issuer as any;
              sslIssuer = Array.isArray(rawIssuer?.O)
                ? rawIssuer.O[0]
                : rawIssuer?.O || rawIssuer?.CN || 'Standard CA';

              // Persist fresh SSL expiry
              await this.prisma.hostingAccount
                .update({
                  where: { id: acc.id },
                  data: { sslExpiry: expDate, sslIssuer },
                })
                .catch(() => undefined);
            }
          } catch {
            if (!acc.sslExpiry) {
              handshakeError = true;
            }
          }
        }

        let anomaly: 'HEALTHY' | 'DNS_MISCONFIGURED' | 'SSL_EXPIRED' | 'SSL_EXPIRING_7D' | 'SSL_HANDSHAKE_ERROR' = 'HEALTHY';
        if (!dnsOk && resolvedIp === null) {
          anomaly = 'DNS_MISCONFIGURED';
        } else if (handshakeError) {
          anomaly = 'SSL_HANDSHAKE_ERROR';
        } else if (sslDaysLeft !== null && sslDaysLeft < 0) {
          anomaly = 'SSL_EXPIRED';
        } else if (sslDaysLeft !== null && sslDaysLeft <= 7) {
          anomaly = 'SSL_EXPIRING_7D';
        } else if (!dnsOk) {
          anomaly = 'DNS_MISCONFIGURED';
        }

        const hasIssue = anomaly !== 'HEALTHY';

        return {
          id: acc.id,
          domain: acc.domain,
          client: acc.client?.businessName || 'Unlinked',
          clientId: acc.clientId,
          expectedIp: acc.ipAddress || 'Not set',
          resolvedIp: resolvedIp || 'Unresolved',
          isCloudflare,
          sslIssuer,
          sslExpiry: acc.sslExpiry ? new Date(acc.sslExpiry).toISOString() : null,
          sslDaysLeft,
          status: acc.status,
          anomaly,
          hasIssue,
        };
      }),
    );

    const issuesCount = domains.filter((d) => d.hasIssue).length;

    return {
      totalScanned: domains.length,
      issuesCount,
      domains,
    };
  }

  /**
   * One-click DNS & SSL remediation: live refresh or Let's Encrypt re-issue.
   */
  async remediateDnsSsl(dto: RemediateDnsSslDto, staffUser?: any) {
    const cleanDomain = dto.domain.trim().toLowerCase();
    const account = await this.prisma.hostingAccount.findFirst({
      where: dto.hostingAccountId ? { id: dto.hostingAccountId } : { domain: cleanDomain },
    });
    if (!account) {
      throw new NotFoundException(`Hosting account for domain ${cleanDomain} not found`);
    }

    if (dto.action === 'REFRESH_SSL') {
      let resolvedIp = account.ipAddress;
      try {
        const ips = await dns.promises.resolve4(account.domain);
        if (ips.length > 0) resolvedIp = ips[0];
      } catch {}

      if (!resolvedIp) {
        throw new BadRequestException('Cannot inspect SSL: domain DNS does not resolve to an IP address');
      }

      if (isPrivateOrReservedIp(resolvedIp)) {
        throw new BadRequestException('Cannot inspect SSL: domain resolves to a private or reserved IP address');
      }

      const cert = await this.inspectTlsCert(account.domain, resolvedIp);
      if (!cert.valid_to) {
        throw new BadRequestException('Could not extract valid TLS certificate peer info');
      }

      const expDate = new Date(cert.valid_to);
      const rawIssuer = cert.issuer as any;
      const issuer = Array.isArray(rawIssuer?.O)
        ? rawIssuer.O[0]
        : rawIssuer?.O || rawIssuer?.CN || 'Standard CA';

      await this.prisma.hostingAccount.update({
        where: { id: account.id },
        data: { sslExpiry: expDate, sslIssuer: issuer },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: 'troubleshooting.remediate_dns_ssl',
          resourceType: 'HostingAccount',
          resourceId: account.id,
          newValue: { action: 'REFRESH_SSL', domain: account.domain, newExpiry: expDate, issuer },
        },
      }).catch(() => undefined);

      return {
        success: true,
        action: 'REFRESH_SSL',
        domain: account.domain,
        sslExpiry: expDate.toISOString(),
        sslIssuer: issuer,
        status: 'HEALTHY',
        message: `Successfully verified and synchronized SSL certificate for ${account.domain}`,
      };
    }

    if (dto.action === 'REISSUE_SSL') {
      if (this.dokploy) {
        await this.dokploy
          .bindDomain({
            domain: account.domain,
            https: true,
            certificateType: 'letsencrypt',
          })
          .catch((err) => {
            this.logger.warn(`Dokploy bindDomain fallback: ${err.message}`);
          });
      }

      // Refresh status in database
      await this.prisma.hostingAccount.update({
        where: { id: account.id },
        data: { status: 'ACTIVE' },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: 'troubleshooting.remediate_dns_ssl',
          resourceType: 'HostingAccount',
          resourceId: account.id,
          newValue: { action: 'REISSUE_SSL', domain: account.domain },
        },
      }).catch(() => undefined);

      return {
        success: true,
        action: 'REISSUE_SSL',
        domain: account.domain,
        status: 'REISSUED',
        message: `Let's Encrypt certificate re-issuance triggered and domain synchronized for ${account.domain}`,
      };
    }

    throw new BadRequestException('Unsupported DNS/SSL remediation action');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Orphan & Unapplied Payments
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Find orphan payment records or successful payments not applied to invoices.
   */
  async getOrphanPayments() {
    const orphanLogs = await this.prisma.paymentLog.findMany({
      where: {
        OR: [
          { clientId: null },
          { invoiceId: null },
          { errorMessage: { contains: 'Orphan', mode: 'insensitive' } },
          {
            AND: [
              { status: PaymentStatus.SUCCESS },
              { invoice: { status: { not: 'PAID' } } },
            ],
          },
        ],
      },
      include: {
        client: { select: { id: true, businessName: true, email: true, status: true } },
        invoice: { select: { id: true, invoiceNumber: true, amount: true, status: true, clientId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const items = await Promise.all(
      orphanLogs.map(async (log) => {
        let extractedEmail: string | null = null;
        let extractedPhone: string | null = null;

        if (log.rawPayload) {
          try {
            const p = typeof log.rawPayload === 'string' ? JSON.parse(log.rawPayload) : log.rawPayload;
            extractedEmail =
              p.customer?.email ||
              p.customer_email ||
              p.email ||
              p.metadata?.clientEmail ||
              p.metadata?.customer_email ||
              null;
            extractedPhone =
              p.customer?.phone ||
              p.phone ||
              p.msisdn ||
              p.mpesaPhoneNumber ||
              p.BillRefNumber ||
              null;
          } catch {}
        }

        let candidateClient = log.client;
        if (!candidateClient && extractedEmail) {
          candidateClient = await this.prisma.client.findFirst({
            where: { email: { equals: extractedEmail, mode: 'insensitive' }, deletedAt: null },
            select: { id: true, businessName: true, email: true, status: true },
          });
        }

        let candidateInvoice = log.invoice;
        if (!candidateInvoice && candidateClient) {
          candidateInvoice = await this.prisma.invoice.findFirst({
            where: {
              clientId: candidateClient.id,
              status: { in: ['SENT', 'OVERDUE', 'DRAFT'] },
            },
            select: { id: true, invoiceNumber: true, amount: true, status: true, clientId: true },
            orderBy: { createdAt: 'desc' },
          });
        }

        let matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE';
        const logAmount = Number(log.amount);
        const invAmount = candidateInvoice ? Number(candidateInvoice.amount) : null;

        if (candidateClient && candidateInvoice && invAmount !== null && Math.abs(invAmount - logAmount) < 0.05) {
          matchConfidence = 'HIGH';
        } else if (candidateClient) {
          matchConfidence = 'MEDIUM';
        } else if (candidateInvoice) {
          matchConfidence = 'LOW';
        }

        return {
          id: log.id,
          provider: log.provider,
          providerRef: log.providerRef || log.idempotencyKey,
          method: log.method,
          amount: logAmount,
          currency: log.currency,
          status: log.status,
          createdAt: log.createdAt.toISOString(),
          errorMessage: log.errorMessage,
          extractedEmail,
          extractedPhone,
          candidateClient,
          candidateInvoice,
          matchConfidence,
        };
      }),
    );

    return {
      count: items.length,
      items,
    };
  }

  /**
   * One-click remediation for orphan payments: link and settle or credit to client.
   */
  async remediateOrphanPayment(dto: RemediateOrphanPaymentDto, staffUser?: any) {
    const log = await this.prisma.paymentLog.findUnique({
      where: { id: dto.paymentLogId },
    });
    if (!log) throw new NotFoundException('Payment record not found');

    if (dto.action === 'LINK_AND_SETTLE') {
      const targetInvoiceId = dto.targetInvoiceId || log.invoiceId;
      if (!targetInvoiceId) {
        throw new BadRequestException('A target invoice ID is required to link and settle an orphan payment');
      }

      const invoice = await this.prisma.invoice.findUnique({
        where: { id: targetInvoiceId },
        include: { client: true },
      });
      if (!invoice) throw new NotFoundException('Target invoice not found');

      await this.prisma.$transaction(async (tx) => {
        // 1. Mark Invoice as PAID
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAID',
            paidAt: log.createdAt || new Date(),
          },
        });

        // 2. Link and flip PaymentLog to SUCCESS
        await tx.paymentLog.update({
          where: { id: log.id },
          data: {
            status: PaymentStatus.SUCCESS,
            invoiceId: invoice.id,
            clientId: invoice.clientId,
            errorMessage: null,
          },
        });

        // 3. Activate subscription or update client status
        await this.settlement.activatePaidSubscription(tx, invoice, {
          provider: log.provider,
          providerRef: log.providerRef || `orphan-settle-${log.id}`,
        });

        // 4. Audit log
        await tx.auditLog.create({
          data: {
            userId: staffUser?.id || null,
            action: 'troubleshooting.remediate_orphan_payment',
            resourceType: 'PaymentLog',
            resourceId: log.id,
            newValue: {
              action: 'LINK_AND_SETTLE',
              invoiceId: invoice.id,
              clientId: invoice.clientId,
              settledBy: staffUser?.email || staffUser?.id || 'admin',
            },
          },
        });
      });

      return {
        success: true,
        action: 'LINK_AND_SETTLE',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: 'PAID',
        message: `Payment successfully linked to invoice ${invoice.invoiceNumber} and settled. Subscription activated.`,
      };
    }

    if (dto.action === 'CREDIT_CLIENT') {
      const targetClientId = dto.targetClientId || log.clientId;
      if (!targetClientId) {
        throw new BadRequestException('A target client ID is required to credit payment');
      }

      const client = await this.prisma.client.findUnique({
        where: { id: targetClientId },
      });
      if (!client) throw new NotFoundException('Target client account not found');

      await this.prisma.$transaction(async (tx) => {
        await tx.paymentLog.update({
          where: { id: log.id },
          data: {
            status: PaymentStatus.SUCCESS,
            clientId: client.id,
            errorMessage: 'Credited directly to client account balance',
          },
        });

        await tx.client.update({
          where: { id: client.id },
          data: { status: 'ACTIVE' },
        });

        await tx.auditLog.create({
          data: {
            userId: staffUser?.id || null,
            action: 'troubleshooting.remediate_orphan_payment',
            resourceType: 'PaymentLog',
            resourceId: log.id,
            newValue: {
              action: 'CREDIT_CLIENT',
              clientId: client.id,
              creditedBy: staffUser?.email || staffUser?.id || 'admin',
            },
          },
        });
      });

      return {
        success: true,
        action: 'CREDIT_CLIENT',
        clientId: client.id,
        message: `Payment successfully linked as account credit to client ${client.businessName}`,
      };
    }

    throw new BadRequestException('Unsupported orphan payment remediation action');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Webhook Failures & Burst Retry Desk
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get failed webhook stream and burst anomaly telemetry.
   */
  async getWebhookFailures(limit = 50) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000);

    const [failedLogs, burstCount] = await Promise.all([
      this.prisma.paymentLog.findMany({
        where: {
          OR: [
            { status: PaymentStatus.FAILED },
            { AND: [{ status: PaymentStatus.PENDING }, { createdAt: { lt: fiveMinutesAgo } }] },
          ],
        },
        include: {
          client: { select: { businessName: true, contactName: true, email: true } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.paymentLog.count({
        where: {
          status: PaymentStatus.FAILED,
          createdAt: { gte: fifteenMinutesAgo },
        },
      }),
    ]);

    const groupedReasons = {
      ORPHAN: 0,
      GATEWAY_REJECTED: 0,
      TIMEOUT: 0,
      OTHER: 0,
    };

    const items = failedLogs.map((l) => {
      const err = (l.errorMessage || '').toLowerCase();
      let category: 'ORPHAN' | 'GATEWAY_REJECTED' | 'TIMEOUT' | 'OTHER' = 'OTHER';

      if (err.includes('orphan')) {
        category = 'ORPHAN';
        groupedReasons.ORPHAN++;
      } else if (
        err.includes('failed') ||
        err.includes('rejected') ||
        err.includes('declined') ||
        err.includes('insufficient')
      ) {
        category = 'GATEWAY_REJECTED';
        groupedReasons.GATEWAY_REJECTED++;
      } else if (err.includes('timeout') || err.includes('stale') || l.status === PaymentStatus.PENDING) {
        category = 'TIMEOUT';
        groupedReasons.TIMEOUT++;
      } else if (!l.clientId && !l.invoiceId) {
        category = 'ORPHAN';
        groupedReasons.ORPHAN++;
      } else {
        groupedReasons.OTHER++;
      }

      return {
        id: l.id,
        gateway: l.provider,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
        reference: l.providerRef || l.idempotencyKey,
        amount: Number(l.amount),
        currency: l.currency,
        client: l.client?.businessName || 'Guest / Unlinked',
        invoiceNumber: l.invoice?.invoiceNumber || null,
        method: l.method,
        errorMessage: l.errorMessage,
        category,
      };
    });

    return {
      totalFailed: items.length,
      burstDetected: burstCount >= 3,
      burstCount,
      groupedReasons,
      items,
    };
  }

  /**
   * One-click batch retry for all failed webhooks in specified time window.
   */
  async retryWebhooksBatch(windowHours = 24, staffUser?: any) {
    const windowStart = new Date(Date.now() - windowHours * 3600_000);
    const logs = await this.prisma.paymentLog.findMany({
      where: {
        createdAt: { gte: windowStart },
        OR: [{ status: PaymentStatus.FAILED }, { status: PaymentStatus.PENDING }],
      },
      take: 100,
    });

    let settled = 0;
    let failed = 0;

    for (const log of logs) {
      try {
        const res = await this.replayWebhook(log.id);
        if (res.success && res.settled) {
          settled++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: staffUser?.id || null,
        action: 'troubleshooting.webhooks_batch_retry',
        resourceType: 'PaymentLog',
        newValue: { windowHours, scanned: logs.length, settled, failed, triggeredBy: staffUser?.email },
      },
    }).catch(() => undefined);

    return {
      total: logs.length,
      scanned: logs.length,
      settled,
      failed,
      windowHours,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Invoices & Reconciliation Desk
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Identify invoices with desynchronized totals or statuses.
   */
  async getUnsyncedInvoices() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { not: 'CANCELLED' } },
      include: {
        client: { select: { id: true, businessName: true, email: true } },
        paymentLogs: {
          select: { id: true, amount: true, status: true, createdAt: true },
          where: { status: PaymentStatus.SUCCESS },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });

    const now = new Date();
    const items: any[] = [];

    for (const inv of invoices) {
      const recordedAmount = Number(inv.amount);

      // 1. Calculate sum from lineItems JSON
      let sumLineItems = 0;
      let hasLineItems = false;
      if (Array.isArray(inv.lineItems) && inv.lineItems.length > 0) {
        hasLineItems = true;
        sumLineItems = inv.lineItems.reduce((acc: number, item: any) => {
          const price = Number(item.total || Number(item.amount || 0) * Number(item.quantity || 1));
          return acc + (isNaN(price) ? 0 : price);
        }, 0);
      }

      // 2. Calculate sum from successful payment logs
      const sumPayments = inv.paymentLogs.reduce((acc, log) => acc + Number(log.amount), 0);

      let discrepancy: 'LINE_ITEM_MISMATCH' | 'STATUS_DESYNC_PAID_AS_UNPAID' | 'STATUS_DESYNC_UNPAID_AS_PAID' | 'OVERDUE_DRIFT' | null = null;
      let discrepancyDetails = '';

      if (sumPayments >= recordedAmount - 0.01 && inv.status !== 'PAID') {
        discrepancy = 'STATUS_DESYNC_PAID_AS_UNPAID';
        discrepancyDetails = `Payments totaling ${inv.currency} ${sumPayments.toFixed(2)} received, but invoice remains ${inv.status}`;
      } else if (hasLineItems && Math.abs(sumLineItems - recordedAmount) > 0.05) {
        discrepancy = 'LINE_ITEM_MISMATCH';
        discrepancyDetails = `Line items sum to ${inv.currency} ${sumLineItems.toFixed(2)}, recorded invoice total is ${inv.currency} ${recordedAmount.toFixed(2)}`;
      } else if (inv.status === 'PAID' && sumPayments < 0.01 && inv.paymentLogs.length > 0) {
        discrepancy = 'STATUS_DESYNC_UNPAID_AS_PAID';
        discrepancyDetails = `Marked PAID without verified successful payments`;
      } else if (inv.dueDate && new Date(inv.dueDate) < now && inv.status === 'SENT') {
        discrepancy = 'OVERDUE_DRIFT';
        discrepancyDetails = `Due date passed on ${new Date(inv.dueDate).toISOString().slice(0, 10)}, still marked SENT`;
      }

      if (discrepancy) {
        items.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          client: inv.client?.businessName || 'Unknown Client',
          clientId: inv.clientId,
          recordedAmount,
          sumLineItems: hasLineItems ? sumLineItems : recordedAmount,
          sumPayments,
          currency: inv.currency,
          status: inv.status,
          dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
          discrepancy,
          discrepancyDetails,
        });
      }
    }

    return {
      totalUnsynced: items.length,
      items,
    };
  }

  /**
   * One-click invoice status & total synchronization.
   */
  async remediateInvoiceSync(dto: RemediateInvoiceSyncDto, staffUser?: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: {
        client: true,
        paymentLogs: { where: { status: PaymentStatus.SUCCESS } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (dto.action === 'SYNC_FROM_PAYMENTS') {
      const latestPaymentDate = invoice.paymentLogs[0]?.createdAt || new Date();

      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: latestPaymentDate },
        });

        await this.settlement.activatePaidSubscription(tx, invoice, {
          provider: PaymentProvider.PAYSTACK,
          providerRef: `manual-sync-${invoice.id}`,
        });

        await tx.auditLog.create({
          data: {
            userId: staffUser?.id || null,
            action: 'troubleshooting.remediate_invoice_sync',
            resourceType: 'Invoice',
            resourceId: invoice.id,
            newValue: { action: 'SYNC_FROM_PAYMENTS', status: 'PAID', paidAt: latestPaymentDate },
          },
        });
      });

      return {
        success: true,
        action: 'SYNC_FROM_PAYMENTS',
        invoiceId: invoice.id,
        status: 'PAID',
        message: `Invoice ${invoice.invoiceNumber} synced to PAID from verified payments. Subscription activated.`,
      };
    }

    if (dto.action === 'RECALCULATE_FROM_ITEMS') {
      if (!Array.isArray(invoice.lineItems) || invoice.lineItems.length === 0) {
        throw new BadRequestException('Invoice does not contain line items to recalculate');
      }

      const sumLineItems = invoice.lineItems.reduce((acc: number, item: any) => {
        const price = Number(item.total || Number(item.amount || 0) * Number(item.quantity || 1));
        return acc + (isNaN(price) ? 0 : price);
      }, 0);

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { amount: sumLineItems },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: 'troubleshooting.remediate_invoice_sync',
          resourceType: 'Invoice',
          resourceId: invoice.id,
          newValue: { action: 'RECALCULATE_FROM_ITEMS', oldAmount: invoice.amount, newAmount: sumLineItems },
        },
      }).catch(() => undefined);

      return {
        success: true,
        action: 'RECALCULATE_FROM_ITEMS',
        invoiceId: invoice.id,
        updatedAmount: sumLineItems,
        message: `Invoice ${invoice.invoiceNumber} amount recalculated to ${invoice.currency} ${sumLineItems.toFixed(2)}`,
      };
    }

    if (dto.action === 'MARK_PAID') {
      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
        await this.settlement.activatePaidSubscription(tx, invoice, {
          provider: PaymentProvider.PAYSTACK,
          providerRef: `manual-mark-paid-${invoice.id}`,
        });
      });
      return { success: true, invoiceId: invoice.id, status: 'PAID' };
    }

    if (dto.action === 'MARK_OVERDUE') {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' },
      });
      return { success: true, invoiceId: invoice.id, status: 'OVERDUE' };
    }

    throw new BadRequestException('Unsupported invoice sync action');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Client Access & Lockout Desk
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Find locked, suspended, or uninitialized client accounts.
   */
  async getClientAccessIssues() {
    const [suspendedClients, lockedUsers] = await Promise.all([
      this.prisma.client.findMany({
        where: {
          OR: [{ status: 'SUSPENDED' }, { deletedAt: { not: null } }],
        },
        include: { user: true },
        take: 100,
      }),
      this.prisma.user.findMany({
        where: {
          role: 'CLIENT',
          OR: [{ deletedAt: { not: null } }, { passwordHash: null }],
        },
        include: { client: true },
        take: 100,
      }),
    ]);

    const clientMap = new Map<string, any>();

    suspendedClients.forEach((c) => {
      clientMap.set(c.id, {
        clientId: c.id,
        businessName: c.businessName,
        contactName: c.contactName,
        email: c.email,
        clientStatus: c.status,
        userDeleted: Boolean(c.user?.deletedAt),
        clientDeleted: Boolean(c.deletedAt),
        hasPassword: Boolean(c.user?.passwordHash),
        lastLoginAt: c.user?.lastLoginAt?.toISOString() || null,
        lockoutReason: c.deletedAt ? 'CLIENT_SOFT_DELETED' : 'CLIENT_SUSPENDED',
      });
    });

    lockedUsers.forEach((u) => {
      if (u.client && !clientMap.has(u.client.id)) {
        clientMap.set(u.client.id, {
          clientId: u.client.id,
          businessName: u.client.businessName,
          contactName: u.client.contactName,
          email: u.email,
          clientStatus: u.client.status,
          userDeleted: Boolean(u.deletedAt),
          clientDeleted: Boolean(u.client.deletedAt),
          hasPassword: Boolean(u.passwordHash),
          lastLoginAt: u.lastLoginAt?.toISOString() || null,
          lockoutReason: u.deletedAt ? 'USER_SOFT_DELETED' : 'PASSWORD_UNSET',
        });
      }
    });

    const items = Array.from(clientMap.values());

    return {
      totalLocked: items.length,
      items,
    };
  }

  /**
   * One-click client access unlock or magic reset token issuance.
   */
  async remediateClientAccess(dto: RemediateClientAccessDto, staffUser?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      include: { user: true },
    });
    if (!client) throw new NotFoundException('Client organization not found');

    if (dto.action === 'UNLOCK_ACCOUNT' || dto.action === 'RESTORE_USER') {
      await this.prisma.$transaction(async (tx) => {
        await tx.client.update({
          where: { id: client.id },
          data: { status: 'ACTIVE', deletedAt: null },
        });

        if (client.userId) {
          await tx.user.update({
            where: { id: client.userId },
            data: { deletedAt: null },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: staffUser?.id || null,
            action: 'troubleshooting.remediate_client_access',
            resourceType: 'Client',
            resourceId: client.id,
            newValue: { action: dto.action, clientEmail: client.email },
          },
        });
      });

      return {
        success: true,
        action: dto.action,
        clientId: client.id,
        status: 'ACTIVE',
        message: `Account for ${client.businessName} has been unlocked and restored to ACTIVE standing.`,
      };
    }

    if (dto.action === 'GENERATE_RESET_LINK') {
      if (!client.user) {
        throw new BadRequestException('Client has no linked user account to generate a reset link for');
      }

      const webBaseUrl = (
        this.config.get<string>('NEXT_PUBLIC_APP_URL') ||
        this.config.get<string>('APP_URL') ||
        'https://bazionweb.com'
      ).replace(/\/$/, '');

      const isUnclaimed = !client.user.passwordHash;
      // For unclaimed accounts: issue 72h/24h claim token. For claimed accounts: issue magic token
      const rawToken = isUnclaimed
        ? `claim_${randomBytes(32).toString('base64url')}`
        : `magic_${randomBytes(32).toString('base64url')}`;

      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 3600_000);

      await this.prisma.refreshToken.create({
        data: {
          tokenHash,
          userId: client.user.id,
          expiresAt,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: 'troubleshooting.remediate_client_access',
          resourceType: 'Client',
          resourceId: client.id,
          newValue: {
            action: 'GENERATE_RESET_LINK',
            recipient: client.user.email,
            tokenType: isUnclaimed ? 'CLAIM' : 'MAGIC_LINK',
          },
        },
      }).catch(() => undefined);

      const resetLink = isUnclaimed
        ? `${webBaseUrl}/portal/claim?token=${rawToken}&email=${encodeURIComponent(client.user.email)}`
        : `${webBaseUrl}/portal/login/verify?token=${rawToken}`;

      return {
        success: true,
        action: 'GENERATE_RESET_LINK',
        clientId: client.id,
        token: rawToken,
        resetLink,
        claimUrl: resetLink,
        expiresIn: 86400,
        message: isUnclaimed
          ? `Account claim link generated successfully for ${client.user.email}`
          : `Magic access link generated successfully for ${client.user.email}`,
      };
    }

    throw new BadRequestException('Unsupported client access remediation action');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Suspended & Stuck Domain States
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Find suspended or stuck provisioning hosting domains.
   */
  async getSuspendedDomains() {
    const oneHourAgo = new Date(Date.now() - 3600_000);

    const accounts = await this.prisma.hostingAccount.findMany({
      where: {
        deletedAt: null,
        OR: [
          { status: 'SUSPENDED' },
          { AND: [{ status: 'PROVISIONING' }, { createdAt: { lt: oneHourAgo } }] },
        ],
      },
      include: {
        client: {
          include: {
            invoices: { where: { status: 'OVERDUE' }, select: { id: true, amount: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const items = accounts.map((acc) => {
      const overdueCount = acc.client?.invoices?.length || 0;
      let suspensionType: 'INCONSISTENT_SUSPENSION' | 'DUNNING_SUSPENSION' | 'STUCK_PROVISIONING' =
        'DUNNING_SUSPENSION';

      if (acc.status === 'PROVISIONING') {
        suspensionType = 'STUCK_PROVISIONING';
      } else if (overdueCount === 0) {
        suspensionType = 'INCONSISTENT_SUSPENSION';
      }

      return {
        id: acc.id,
        domain: acc.domain,
        server: acc.server,
        plan: acc.plan,
        status: acc.status,
        client: acc.client?.businessName || 'Unlinked',
        clientId: acc.clientId,
        overdueInvoicesCount: overdueCount,
        suspensionType,
        createdAt: acc.createdAt.toISOString(),
      };
    });

    return {
      totalSuspended: items.length,
      items,
    };
  }

  /**
   * One-click domain unsuspension or normalization.
   */
  async remediateDomainState(dto: RemediateDomainStateDto, staffUser?: any) {
    const account = await this.prisma.hostingAccount.findUnique({
      where: { id: dto.hostingAccountId },
    });
    if (!account) throw new NotFoundException('Hosting domain record not found');

    if (dto.action === 'UNSUSPEND' || dto.action === 'NORMALIZE_STATUS') {
      await this.prisma.hostingAccount.update({
        where: { id: account.id },
        data: { status: 'ACTIVE' },
      });

      if (this.dokploy) {
        await this.dokploy.restartWorkload(account.id).catch(() => undefined);
      }

      await this.prisma.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: 'troubleshooting.remediate_domain_state',
          resourceType: 'HostingAccount',
          resourceId: account.id,
          newValue: { action: dto.action, domain: account.domain, oldStatus: account.status },
        },
      }).catch(() => undefined);

      return {
        success: true,
        action: dto.action,
        domain: account.domain,
        status: 'ACTIVE',
        message: `Domain ${account.domain} has been restored to ACTIVE status and workload resumed.`,
      };
    }

    throw new BadRequestException('Unsupported domain state remediation action');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Troubleshooting Suite Overview Deck
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Aggregated diagnostic issue counters across all 6 operational categories.
   */
  async getSuiteOverview() {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000);

    const [
      orphanPaymentsCount,
      failedWebhooksCount,
      burstCount,
      suspendedDomainsCount,
      lockedAccountsCount,
      sslRisksCount,
    ] = await Promise.all([
      this.prisma.paymentLog.count({
        where: {
          OR: [
            { clientId: null },
            { invoiceId: null },
            { errorMessage: { contains: 'Orphan', mode: 'insensitive' } },
            { AND: [{ status: PaymentStatus.SUCCESS }, { invoice: { status: { not: 'PAID' } } }] },
          ],
        },
      }),
      this.prisma.paymentLog.count({
        where: { status: PaymentStatus.FAILED },
      }),
      this.prisma.paymentLog.count({
        where: {
          status: PaymentStatus.FAILED,
          createdAt: { gte: fifteenMinutesAgo },
        },
      }),
      this.prisma.hostingAccount.count({
        where: {
          deletedAt: null,
          OR: [{ status: 'SUSPENDED' }, { status: 'PROVISIONING' }],
        },
      }),
      this.prisma.client.count({
        where: {
          OR: [{ status: 'SUSPENDED' }, { deletedAt: { not: null } }],
        },
      }),
      this.prisma.hostingAccount.count({
        where: {
          deletedAt: null,
          sslExpiry: { lte: sevenDaysFromNow },
        },
      }),
    ]);

    return {
      orphanPaymentsCount,
      dnsSslIssuesCount: sslRisksCount,
      failedWebhooksCount,
      burstAnomalyDetected: burstCount >= 3,
      burstCount,
      unsyncedInvoicesCount: 0, // Computed dynamically on invoices tab
      lockedAccountsCount,
      suspendedDomainsCount,
      timestamp: new Date().toISOString(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Webhook Stream & Replay
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Fetches recent payment logs for diagnostic streaming.
   */
  async getWebhookStream(limit = 50): Promise<WebhookLogItem[]> {
    const logs = await this.prisma.paymentLog.findMany({
      take: Math.min(100, limit),
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { businessName: true, contactName: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    });

    return logs.map(l => ({
      id: l.id,
      gateway: l.provider,
      event: l.method === 'MPESA' ? 'daraja.stk_push' : 'charge.success',
      status: l.status,
      createdAt: l.createdAt.toISOString(),
      reference: l.providerRef || l.idempotencyKey,
      amount: Number(l.amount),
      currency: l.currency,
      client: l.client?.businessName || 'Guest / Unlinked',
      method: l.method,
      errorMessage: l.errorMessage,
    }));
  }

  /**
   * Replay/re-verify a payment log entry.
   */
  async replayWebhook(id: string) {
    const log = await this.prisma.paymentLog.findUnique({
      where: { id },
      include: { client: true, invoice: true },
    });
    if (!log) throw new NotFoundException('Payment log entry not found');

    if (log.provider === PaymentProvider.PAYSTACK && log.providerRef) {
      const verifyRes = await this.paystack.verifyTransaction(log.providerRef);
      const charge = verifyRes?.data;
      if (charge?.status === 'success') {
        const settled = await this.settlement.settlePaystackCharge(charge);
        return { success: true, settled };
      }
      return { success: false, status: charge?.status || 'unverified' };
    }

    if (log.provider === PaymentProvider.DARAJA && log.providerRef) {
      const status = await this.daraja.queryStkStatus(log.providerRef);
      if (status.resultCode === '0') {
        const settled = await this.settlement.settleDarajaSuccess({
          checkoutRequestId: status.checkoutRequestId || log.providerRef,
          receiptNumber: status.checkoutRequestId || log.providerRef,
          paidAmount: Number(log.amount),
          payload: status,
        });
        return { success: true, settled };
      }
      return { success: false, resultCode: status.resultCode, resultDesc: status.resultDesc };
    }

    throw new BadRequestException('This payment record cannot be automatically re-verified');
  }

  /**
   * Run on-demand reconciliation of pending payments.
   */
  async runReconciliation() {
    const staleBefore = new Date(Date.now() - 60 * 1000); // Pending > 1 min
    const pendingLogs = await this.prisma.paymentLog.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { lt: staleBefore },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    let settled = 0;
    let failed = 0;

    for (const log of pendingLogs) {
      try {
        if (log.provider === PaymentProvider.PAYSTACK && log.providerRef) {
          const res = await this.paystack.verifyTransaction(log.providerRef);
          if (res?.data?.status === 'success') {
            await this.settlement.settlePaystackCharge(res.data);
            settled++;
          } else if (res?.data?.status === 'failed') {
            await this.prisma.paymentLog.update({
              where: { id: log.id },
              data: {
                status: PaymentStatus.FAILED,
                errorMessage: res.data.gateway_response || 'Declined',
              },
            });
            failed++;
          }
        } else if (log.provider === PaymentProvider.DARAJA && log.providerRef) {
          const res = await this.daraja.queryStkStatus(log.providerRef);
          if (res?.resultCode === '0') {
            await this.settlement.settleDarajaSuccess({
              checkoutRequestId: res.checkoutRequestId || log.providerRef,
              receiptNumber: res.checkoutRequestId || log.providerRef,
              paidAmount: Number(log.amount),
              payload: res,
            });
            settled++;
          } else if (res?.resultCode && res.resultCode !== '1032') {
            await this.prisma.paymentLog.update({
              where: { id: log.id },
              data: {
                status: PaymentStatus.FAILED,
                errorMessage: res.resultDesc || 'M-PESA transaction failed',
              },
            });
            failed++;
          }
        }
      } catch (err: any) {
        this.logger.debug(`Reconciliation check failed for log ${log.id}: ${err.message}`);
      }
    }

    return {
      scanned: pendingLogs.length,
      settled,
      failed,
      timestamp: new Date().toISOString(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Client Impersonation Sandbox
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Mints an isolated, read-only 15-minute JWT view-as session for superadmins.
   */
  async impersonateClient(clientId: string, staffUser: { id: string; email: string }) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { user: true },
    });
    if (!client || !client.user) {
      throw new NotFoundException('Client user account not found');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: staffUser.id,
        action: 'impersonation.launch',
        resourceType: 'Client',
        resourceId: client.id,
        newValue: { targetUser: client.user.email },
      },
    }).catch(() => undefined);

    const secret = this.config.get<string>('JWT_SECRET') || 'dev-secret';
    const token = jwt.sign(
      {
        sub: client.user.id,
        email: client.user.email,
        given_name: client.user.firstName || client.contactName,
        family_name: client.user.lastName || '',
        clientId: client.id,
        clientBusinessName: client.businessName,
        realm_access: { roles: ['CLIENT'] },
        subscriptionStatus: client.status,
        impersonatedBy: staffUser.email || staffUser.id,
        isSandbox: true,
      },
      secret,
      { expiresIn: '15m', issuer: 'bazionweb' },
    );

    return {
      token,
      expiresIn: 900,
      client: {
        id: client.id,
        businessName: client.businessName,
        email: client.email,
        contactName: client.contactName,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Proactive Intelligence & Anomaly Remediation (M3 / R3)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Runs all 4 proactive anomaly rules across infrastructure, webhooks, payments, and proposals.
   */
  async getProactiveScan() {
    const anomalies: Array<{
      id: string;
      rule: 'SSL_EXPIRING_7D' | 'WEBHOOK_BURST' | 'UNAPPLIED_PAYMENT' | 'EXPIRED_QUOTE_DEPOSIT';
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      title: string;
      description: string;
      resourceId: string;
      metadata: Record<string, any>;
      remediationAction: string;
      remediationPayload: Record<string, any>;
    }> = [];

    const counts = {
      sslExpiring: 0,
      webhookBursts: 0,
      unappliedPayments: 0,
      expiredQuoteDeposits: 0,
    };

    const now = new Date();

    // ── Rule 1: SSL Expiry <= 7 Days ──
    try {
      const sevenDaysAhead = new Date(now.getTime() + 7 * 86400_000);
      const accounts = await this.prisma.hostingAccount.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { sslExpiry: { lte: sevenDaysAhead } },
            { sslExpiry: null },
          ],
        },
        include: {
          client: { select: { id: true, businessName: true, email: true } },
        },
      });

      for (const account of accounts) {
        let daysLeft: number | null = null;
        let severity: 'CRITICAL' | 'WARNING' = 'WARNING';
        let isExpired = false;

        if (account.sslExpiry) {
          const diffMs = account.sslExpiry.getTime() - now.getTime();
          daysLeft = Math.ceil(diffMs / 86400_000);
          isExpired = daysLeft <= 0;
          if (daysLeft <= 3) {
            severity = 'CRITICAL';
          } else {
            severity = 'WARNING';
          }
        } else {
          severity = 'CRITICAL';
        }

        const title =
          daysLeft === null
            ? `Missing SSL Certificate for ${account.domain}`
            : isExpired
            ? `SSL Certificate Expired for ${account.domain}`
            : `SSL Expiring for ${account.domain} in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;

        const description =
          daysLeft === null
            ? `Hosting account for ${account.domain} has no SSL expiry record. Needs TLS certificate inspection or reissuance.`
            : isExpired
            ? `SSL certificate for domain ${account.domain} expired ${Math.abs(daysLeft)} days ago. Immediate renewal required to prevent browser security warnings.`
            : `SSL certificate for domain ${account.domain} expires in ${daysLeft} days (${account.sslExpiry?.toISOString().split('T')[0]}). Auto-renewal recommended.`;

        const remediationAction = isExpired || daysLeft === null ? 'REISSUE_SSL' : 'REFRESH_SSL';

        anomalies.push({
          id: `ssl-${account.id}`,
          rule: 'SSL_EXPIRING_7D',
          severity,
          title,
          description,
          resourceId: account.id,
          metadata: {
            domain: account.domain,
            hostingAccountId: account.id,
            daysLeft,
            sslExpiry: account.sslExpiry ? account.sslExpiry.toISOString() : null,
            sslIssuer: account.sslIssuer,
            clientName: account.client?.businessName,
          },
          remediationAction,
          remediationPayload: {
            domain: account.domain,
            hostingAccountId: account.id,
            action: remediationAction,
          },
        });
        counts.sslExpiring++;
      }
    } catch (err: any) {
      this.logger.error(`Proactive Scan Rule 1 (SSL) error: ${err.message}`);
    }

    // ── Rule 2: Failed Webhook Bursts (Past 60 minutes) ──
    try {
      const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60_000);
      const failedWebhookLogs = await this.prisma.paymentLog.findMany({
        where: {
          status: PaymentStatus.FAILED,
          createdAt: { gte: sixtyMinutesAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (failedWebhookLogs.length >= 3) {
        const uniqueProviders = Array.from(new Set(failedWebhookLogs.map((l) => l.provider)));
        const sampleErrors = failedWebhookLogs
          .slice(0, 3)
          .map((l) => l.errorMessage)
          .filter(Boolean);

        anomalies.push({
          id: `webhook-burst-${sixtyMinutesAgo.getTime()}`,
          rule: 'WEBHOOK_BURST',
          severity: 'CRITICAL',
          title: `${failedWebhookLogs.length} Webhooks Failed in last 60 minutes`,
          description: `High failure burst rate detected across payment providers (${uniqueProviders.join(', ')}). ${failedWebhookLogs.length} failures in the 60m sliding window.${sampleErrors.length ? ` Latest error: ${sampleErrors[0]}` : ''}`,
          resourceId: 'payment-webhooks-burst-window',
          metadata: {
            failureCount: failedWebhookLogs.length,
            windowMinutes: 60,
            providers: uniqueProviders,
            failedLogIds: failedWebhookLogs.map((l) => l.id),
          },
          remediationAction: 'RETRY_WEBHOOK_BURST',
          remediationPayload: {
            windowHours: 1,
            failedCount: failedWebhookLogs.length,
          },
        });
        counts.webhookBursts++;
      }
    } catch (err: any) {
      this.logger.error(`Proactive Scan Rule 2 (Webhook Burst) error: ${err.message}`);
    }

    // ── Rule 3: Unapplied Payments ──
    try {
      const unappliedLogs = await this.prisma.paymentLog.findMany({
        where: {
          status: PaymentStatus.SUCCESS,
          OR: [
            { invoiceId: null },
            { invoice: { status: { not: 'PAID' } } },
          ],
        },
        include: {
          invoice: { select: { id: true, invoiceNumber: true, status: true, amount: true, currency: true, notes: true, lineItems: true, clientId: true } },
          client: { select: { id: true, businessName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      for (const log of unappliedLogs) {
        const amountNum = Number(log.amount);
        const severity: 'CRITICAL' | 'WARNING' = amountNum > 0 ? 'CRITICAL' : 'WARNING';
        const hasNoInvoice = !log.invoiceId;

        const title = hasNoInvoice
          ? `Unapplied Payment ${log.providerRef || log.id} (${log.currency} ${log.amount})`
          : `Unsettled Payment on Invoice ${log.invoice?.invoiceNumber || log.invoiceId} (${log.currency} ${log.amount})`;

        const description = hasNoInvoice
          ? `Successful payment of ${log.currency} ${log.amount} via ${log.provider} is not linked to any client invoice.`
          : `Payment ${log.providerRef || log.id} (${log.currency} ${log.amount}) succeeded, but linked invoice ${log.invoice?.invoiceNumber} remains in ${log.invoice?.status} state.`;

        anomalies.push({
          id: `unapplied-payment-${log.id}`,
          rule: 'UNAPPLIED_PAYMENT',
          severity,
          title,
          description,
          resourceId: log.id,
          metadata: {
            paymentLogId: log.id,
            provider: log.provider,
            providerRef: log.providerRef,
            amount: amountNum,
            currency: log.currency,
            invoiceId: log.invoiceId,
            invoiceNumber: log.invoice?.invoiceNumber,
            invoiceStatus: log.invoice?.status,
            clientId: log.clientId,
            clientName: log.client?.businessName,
          },
          remediationAction: 'AUTO_APPLY_PAYMENT',
          remediationPayload: {
            paymentLogId: log.id,
            invoiceId: log.invoiceId,
            clientId: log.clientId,
          },
        });
        counts.unappliedPayments++;
      }
    } catch (err: any) {
      this.logger.error(`Proactive Scan Rule 3 (Unapplied Payments) error: ${err.message}`);
    }

    // ── Rule 4: Pending Deposits with Expired Quotes ──
    try {
      const expiredProposals = await this.prisma.proposal.findMany({
        where: {
          OR: [
            { status: 'EXPIRED' },
            { expiresAt: { lt: now } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      for (const proposal of expiredProposals) {
        const marker = `proposal ${proposal.proposalCode.trim().toUpperCase()}`;
        const depositInvoice = await this.prisma.invoice.findFirst({
          where: {
            OR: [
              { notes: { contains: marker, mode: 'insensitive' } },
              { notes: { contains: proposal.proposalCode, mode: 'insensitive' } },
            ],
            status: { not: 'CANCELLED' },
          },
          include: {
            paymentLogs: {
              where: { status: { in: [PaymentStatus.SUCCESS, PaymentStatus.PENDING] } },
              orderBy: { createdAt: 'desc' },
            },
            client: { select: { id: true, businessName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (depositInvoice) {
          const isPaid = depositInvoice.status === 'PAID' || depositInvoice.paymentLogs.some((p) => p.status === PaymentStatus.SUCCESS);
          const isPending = !isPaid && depositInvoice.paymentLogs.some((p) => p.status === PaymentStatus.PENDING);

          if (isPaid) {
            anomalies.push({
              id: `quote-deposit-${proposal.id}`,
              rule: 'EXPIRED_QUOTE_DEPOSIT',
              severity: 'CRITICAL',
              title: `Paid Deposit (${depositInvoice.currency} ${depositInvoice.amount}) on Expired Quote ${proposal.proposalCode}`,
              description: `Client ${proposal.clientName || proposal.clientEmail} paid the kickoff deposit (${depositInvoice.currency} ${depositInvoice.amount}), but proposal ${proposal.proposalCode} is ${proposal.status}. Project delivery roadmap kickoff is blocked.`,
              resourceId: proposal.id,
              metadata: {
                proposalId: proposal.id,
                proposalCode: proposal.proposalCode,
                invoiceId: depositInvoice.id,
                invoiceNumber: depositInvoice.invoiceNumber,
                amount: Number(depositInvoice.amount),
                currency: depositInvoice.currency,
                invoiceStatus: depositInvoice.status,
                clientEmail: proposal.clientEmail,
                expiresAt: proposal.expiresAt.toISOString(),
              },
              remediationAction: 'EXTEND_AND_ACTIVATE_QUOTE',
              remediationPayload: {
                proposalId: proposal.id,
                proposalCode: proposal.proposalCode,
                invoiceId: depositInvoice.id,
              },
            });
            counts.expiredQuoteDeposits++;
          } else if (isPending) {
            anomalies.push({
              id: `quote-deposit-${proposal.id}`,
              rule: 'EXPIRED_QUOTE_DEPOSIT',
              severity: 'WARNING',
              title: `Pending Deposit Attempt on Expired Quote ${proposal.proposalCode}`,
              description: `Client ${proposal.clientName || proposal.clientEmail} is attempting checkout on quote ${proposal.proposalCode}, but the proposal expired on ${proposal.expiresAt.toISOString().split('T')[0]}.`,
              resourceId: proposal.id,
              metadata: {
                proposalId: proposal.id,
                proposalCode: proposal.proposalCode,
                invoiceId: depositInvoice.id,
                invoiceNumber: depositInvoice.invoiceNumber,
                amount: Number(depositInvoice.amount),
                currency: depositInvoice.currency,
                invoiceStatus: depositInvoice.status,
                clientEmail: proposal.clientEmail,
                expiresAt: proposal.expiresAt.toISOString(),
              },
              remediationAction: 'EXTEND_AND_ACTIVATE_QUOTE',
              remediationPayload: {
                proposalId: proposal.id,
                proposalCode: proposal.proposalCode,
                invoiceId: depositInvoice.id,
              },
            });
            counts.expiredQuoteDeposits++;
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Proactive Scan Rule 4 (Expired Quote Deposits) error: ${err.message}`);
    }

    const criticalCount = anomalies.filter((a) => a.severity === 'CRITICAL').length;
    const warningCount = anomalies.filter((a) => a.severity === 'WARNING').length;
    const infoCount = anomalies.filter((a) => a.severity === 'INFO').length;

    return {
      success: true,
      status: anomalies.length === 0 ? ('HEALTHY' as const) : ('ANOMALIES_DETECTED' as const),
      scannedAt: new Date().toISOString(),
      summary: {
        totalAnomalies: anomalies.length,
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
      },
      counts,
      anomalies,
    };
  }

  /**
   * One-click targeted remediation for proactive anomalies.
   */
  async remediateProactiveAnomaly(dto: RemediateProactiveAnomalyDto, staffUser?: any) {
    const action = dto.remediationAction;
    const payload = dto.remediationPayload || {};

    if (action === 'REFRESH_SSL' || action === 'REISSUE_SSL') {
      const domain = payload.domain;
      if (!domain) throw new BadRequestException('Domain is required for SSL remediation');
      return this.remediateDnsSsl(
        {
          domain,
          hostingAccountId: payload.hostingAccountId,
          action,
        },
        staffUser,
      );
    }

    if (action === 'RETRY_WEBHOOK_BURST') {
      const windowHours = payload.windowHours || 1;
      const res = await this.retryWebhooksBatch(windowHours, staffUser);
      return {
        success: true,
        action: 'RETRY_WEBHOOK_BURST',
        message: `Successfully replayed webhook burst (window: ${windowHours}h): ${res.settled} settled, ${res.failed} remaining failed.`,
        details: res,
      };
    }

    if (action === 'AUTO_APPLY_PAYMENT') {
      const paymentLogId = payload.paymentLogId;
      if (!paymentLogId) throw new BadRequestException('paymentLogId is required to auto-apply payment');

      const log = await this.prisma.paymentLog.findUnique({
        where: { id: paymentLogId },
        include: {
          invoice: { include: { client: true } },
          client: true,
        },
      });
      if (!log) throw new NotFoundException('Payment record not found');

      // Case 1: Linked invoice exists but is not marked PAID
      if (log.invoiceId) {
        const invoice =
          log.invoice ||
          (await this.prisma.invoice.findUnique({
            where: { id: log.invoiceId },
            include: { client: true },
          }));
        if (!invoice) throw new NotFoundException('Linked invoice not found');

        await this.prisma.$transaction(async (tx) => {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'PAID',
              paidAt: log.createdAt || new Date(),
            },
          });

          await tx.paymentLog.update({
            where: { id: log.id },
            data: {
              status: PaymentStatus.SUCCESS,
              errorMessage: null,
            },
          });

          if (invoice.clientId) {
            await tx.client
              .update({
                where: { id: invoice.clientId },
                data: { status: 'ACTIVE' },
              })
              .catch(() => undefined);
          }

          // Check if this is a proposal kickoff deposit
          await provisionProjectFromProposalInvoice(tx, {
            id: invoice.id,
            clientId: invoice.clientId,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            currency: invoice.currency,
            paidAt: new Date(),
            notes: invoice.notes,
            lineItems: invoice.lineItems,
          }).catch(() => undefined);

          await tx.auditLog
            .create({
              data: {
                userId: staffUser?.id || null,
                action: 'proactive.auto_apply_payment',
                resourceType: 'PaymentLog',
                resourceId: log.id,
                newValue: {
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                  amount: Number(log.amount),
                  currency: log.currency,
                  resolvedBy: staffUser?.email || staffUser?.id || 'admin',
                },
              },
            })
            .catch(() => undefined);
        });

        return {
          success: true,
          action: 'AUTO_APPLY_PAYMENT',
          paymentLogId: log.id,
          invoiceId: invoice.id,
          message: `Payment of ${log.currency} ${log.amount} applied to invoice ${invoice.invoiceNumber}. Invoice marked PAID and services activated.`,
        };
      }

      // Case 2: Orphan payment (no invoiceId)
      const clientId = payload.clientId || log.clientId;
      if (clientId) {
        const oldestUnpaid = await this.prisma.invoice.findFirst({
          where: {
            clientId,
            status: { in: ['SENT', 'OVERDUE', 'DRAFT'] },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (oldestUnpaid) {
          return this.remediateOrphanPayment(
            {
              paymentLogId: log.id,
              action: 'LINK_AND_SETTLE',
              targetInvoiceId: oldestUnpaid.id,
            },
            staffUser,
          );
        }

        return this.remediateOrphanPayment(
          {
            paymentLogId: log.id,
            action: 'CREDIT_CLIENT',
            targetClientId: clientId,
          },
          staffUser,
        );
      }

      throw new BadRequestException('Cannot auto-apply payment without linked invoice or client identifier');
    }

    if (action === 'EXTEND_AND_ACTIVATE_QUOTE') {
      const proposalId = payload.proposalId;
      const proposalCode = payload.proposalCode;

      const proposal = await this.prisma.proposal.findFirst({
        where: proposalId ? { id: proposalId } : { proposalCode },
      });
      if (!proposal) throw new NotFoundException('Proposal not found');

      const newExpiry = new Date(Date.now() + 14 * 86400_000);

      // Find linked invoice
      const marker = `proposal ${proposal.proposalCode.trim().toUpperCase()}`;
      const invoice = payload.invoiceId
        ? await this.prisma.invoice.findUnique({
            where: { id: payload.invoiceId },
            include: { paymentLogs: true, client: true },
          })
        : await this.prisma.invoice.findFirst({
            where: {
              OR: [
                { notes: { contains: marker, mode: 'insensitive' } },
                { notes: { contains: proposal.proposalCode, mode: 'insensitive' } },
              ],
              status: { not: 'CANCELLED' },
            },
            include: { paymentLogs: true, client: true },
            orderBy: { createdAt: 'desc' },
          });

      const isPaid =
        invoice &&
        (invoice.status === 'PAID' ||
          invoice.paymentLogs.some((p) => p.status === PaymentStatus.SUCCESS));

      await this.prisma.$transaction(async (tx) => {
        if (isPaid) {
          await tx.proposal.update({
            where: { id: proposal.id },
            data: {
              expiresAt: newExpiry,
              status: 'ACCEPTED',
            },
          });

          if (invoice) {
            if (invoice.status !== 'PAID') {
              await tx.invoice.update({
                where: { id: invoice.id },
                data: { status: 'PAID', paidAt: new Date() },
              });
            }

            if (invoice.clientId) {
              await tx.client
                .update({
                  where: { id: invoice.clientId },
                  data: { status: 'ACTIVE' },
                })
                .catch(() => undefined);
            }

            await provisionProjectFromProposalInvoice(tx, {
              id: invoice.id,
              clientId: invoice.clientId,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              currency: invoice.currency,
              paidAt: new Date(),
              notes: invoice.notes
                ? `${invoice.notes} proposal ${proposal.proposalCode}`
                : `proposal ${proposal.proposalCode}`,
              lineItems: invoice.lineItems,
            }).catch(() => undefined);
          }

          await tx.auditLog
            .create({
              data: {
                userId: staffUser?.id || null,
                action: 'proactive.extend_and_activate_quote',
                resourceType: 'Proposal',
                resourceId: proposal.id,
                newValue: {
                  proposalCode: proposal.proposalCode,
                  status: 'ACCEPTED',
                  extendedByDays: 14,
                  newExpiry: newExpiry.toISOString(),
                  invoiceId: invoice?.id,
                  resolvedBy: staffUser?.email || staffUser?.id || 'admin',
                },
              },
            })
            .catch(() => undefined);
        } else {
          await tx.proposal.update({
            where: { id: proposal.id },
            data: {
              expiresAt: newExpiry,
              status: 'LOCKED',
            },
          });

          await tx.auditLog
            .create({
              data: {
                userId: staffUser?.id || null,
                action: 'proactive.extend_quote',
                resourceType: 'Proposal',
                resourceId: proposal.id,
                newValue: {
                  proposalCode: proposal.proposalCode,
                  status: 'LOCKED',
                  extendedByDays: 14,
                  newExpiry: newExpiry.toISOString(),
                  resolvedBy: staffUser?.email || staffUser?.id || 'admin',
                },
              },
            })
            .catch(() => undefined);
        }
      });

      return {
        success: true,
        action: 'EXTEND_AND_ACTIVATE_QUOTE',
        proposalCode: proposal.proposalCode,
        newStatus: isPaid ? 'ACCEPTED' : 'LOCKED',
        expiresAt: newExpiry.toISOString(),
        message: isPaid
          ? `Proposal ${proposal.proposalCode} extended by 14 days and marked ACCEPTED. Client project delivery roadmap successfully provisioned!`
          : `Proposal ${proposal.proposalCode} extended by 14 days and unlocked for client checkout.`,
      };
    }

    throw new BadRequestException(`Unsupported remediation action: ${action}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ───────────────────────────────────────────────────────────────────────────


  private async inspectTlsCert(cleanHost: string, ip: string): Promise<tls.PeerCertificate> {
    return new Promise<tls.PeerCertificate>((resolve, reject) => {
      const socket = tls.connect(
        { host: ip, port: 443, servername: cleanHost, timeout: 5000 },
        () => {
          const c = socket.getPeerCertificate();
          socket.destroy();
          resolve(c);
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
}
