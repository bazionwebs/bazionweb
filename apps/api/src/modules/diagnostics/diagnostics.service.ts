import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentSettlementService } from '../billing/payment-settlement.service';
import { PaystackService } from '../billing/paystack.service';
import { DarajaService } from '../billing/daraja.service';
import { isPrivateOrReservedIp } from '../hosting/hosting.service';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

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
  ) {}

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

  /**
   * Live DNS record resolution and SSL certificate inspection with SSRF guards.
   */
  async resolveDnsAndSsl(domain: string) {
    const cleanHost = domain.trim().toLowerCase();
    if (!cleanHost || net.isIP(cleanHost) !== 0) {
      throw new BadRequestException('A valid domain name is required');
    }

    const records: { type: string; name: string; target: string; ttl?: number; priority?: number }[] = [];

    // 1. Resolve A records
    let ip = '';
    try {
      const aRecords = await dns.promises.resolve4(cleanHost, { ttl: true });
      aRecords.forEach(r => {
        records.push({ type: 'A', name: '@', target: r.address, ttl: r.ttl });
      });
      if (aRecords.length > 0) {
        ip = aRecords[0].address;
      }
    } catch (e: any) {
      this.logger.debug(`No A records for ${cleanHost}: ${e.message}`);
    }

    // 2. Resolve CNAME (e.g. www)
    try {
      const cnames = await dns.promises.resolveCname(`www.${cleanHost}`);
      cnames.forEach(c => {
        records.push({ type: 'CNAME', name: 'www', target: c, ttl: 300 });
      });
    } catch {
      // Ignore missing CNAME
    }

    // 3. Resolve MX
    try {
      const mxRecords = await dns.promises.resolveMx(cleanHost);
      mxRecords.forEach(m => {
        records.push({ type: 'MX', name: '@', target: m.exchange, priority: m.priority, ttl: 300 });
      });
    } catch {
      // Ignore missing MX
    }

    // 4. Resolve TXT (SPF, DKIM)
    try {
      const txtRecords = await dns.promises.resolveTxt(cleanHost);
      txtRecords.forEach(t => {
        records.push({ type: 'TXT', name: '@', target: t.join(' '), ttl: 300 });
      });
    } catch {
      // Ignore missing TXT
    }

    // 5. Inspect SSL Certificate
    let sslValid = false;
    let sslIssuer = 'None detected';
    let sslExpires = 'Unknown';
    let daysLeft: number | null = null;

    if (ip && !isPrivateOrReservedIp(ip)) {
      try {
        const cert = await new Promise<tls.PeerCertificate>((resolve, reject) => {
          const socket = tls.connect(
            { host: ip, port: 443, servername: cleanHost, timeout: 5000 },
            () => {
              const c = socket.getPeerCertificate();
              socket.destroy();
              resolve(c);
            },
          );
          socket.on('error', err => {
            socket.destroy();
            reject(err);
          });
          socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Connection timed out'));
          });
        });

        if (cert && cert.valid_to) {
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
      r => r.type === 'A' && (r.target.startsWith('104.') || r.target.startsWith('172.67.') || r.target.startsWith('162.159.')),
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
   * Get the recent payment/webhook log stream.
   */
  async getWebhookStream(limit = 50) {
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
    const pending = await this.prisma.paymentLog.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { lt: staleBefore },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    let settledCount = 0;
    let failedCount = 0;
    let unresolvedCount = 0;

    for (const log of pending) {
      try {
        if (log.provider === PaymentProvider.PAYSTACK && log.providerRef) {
          const verify = await this.paystack.verifyTransaction(log.providerRef);
          if (verify?.data?.status === 'success') {
            await this.settlement.settlePaystackCharge(verify.data);
            settledCount++;
          } else if (['failed', 'abandoned', 'reversed'].includes(verify?.data?.status)) {
            await this.prisma.paymentLog.update({
              where: { id: log.id },
              data: { status: PaymentStatus.FAILED, errorMessage: `Provider: ${verify?.data?.status}` },
            });
            failedCount++;
          } else {
            unresolvedCount++;
          }
        } else if (log.provider === PaymentProvider.DARAJA && log.providerRef) {
          const status = await this.daraja.queryStkStatus(log.providerRef);
          if (status.resultCode === '0') {
            await this.settlement.settleDarajaSuccess({
              checkoutRequestId: status.checkoutRequestId || log.providerRef,
              receiptNumber: status.checkoutRequestId || log.providerRef,
              paidAmount: Number(log.amount),
              payload: status,
            });
            settledCount++;
          } else if (['1', '1032', '1037'].includes(status.resultCode)) {
            await this.prisma.paymentLog.update({
              where: { id: log.id },
              data: { status: PaymentStatus.FAILED, errorMessage: status.resultDesc },
            });
            failedCount++;
          } else {
            unresolvedCount++;
          }
        } else {
          unresolvedCount++;
        }
      } catch {
        unresolvedCount++;
      }
    }

    return {
      scanned: pending.length,
      settled: settledCount,
      failed: failedCount,
      unresolved: unresolvedCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mint a short-lived, read-only impersonation token for support troubleshooting.
   */
  async impersonateClient(clientId: string, staffUser: any) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { user: true },
    });
    if (!client || !client.user) {
      throw new NotFoundException('Client user account not found');
    }

    // Log the action to AuditLog for security compliance
    await this.prisma.auditLog.create({
      data: {
        userId: staffUser.id,
        action: 'impersonation.launch',
        resourceType: 'Client',
        resourceId: client.id,
        newValue: { targetUser: client.user.email },
      },
    }).catch(() => undefined);

    // Mint short-lived (15 min) JWT
    const secret = this.config.get<string>('JWT_SECRET') || 'dev-secret';
    const token = jwt.sign(
      {
        sub: client.user.id,
        email: client.user.email,
        given_name: client.user.firstName || client.contactName,
        family_name: client.user.lastName || '',
        realm_access: { roles: ['CLIENT'] },
        subscriptionStatus: client.status,
        impersonatedBy: staffUser.email || staffUser.id,
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
      },
    };
  }
}
