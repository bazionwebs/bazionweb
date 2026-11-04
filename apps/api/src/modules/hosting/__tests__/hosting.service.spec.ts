import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HostingService } from '../hosting.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DeploymentProvider } from '../providers/deployment-provider.interface';
import { resolveHostingTier } from '../constants/hosting-tiers.config';
import { resolveServerTopology } from '../constants/server-topologies.config';
import { EmailRoutingHelper } from '../email/email-routing.helper';
import { DatabaseTenancyHelper } from '../database/database-tenancy.helper';
import { RedisTenancyHelper } from '../cache/redis-tenancy.helper';

const mockAccount = {
  id: 'hosting-uuid-1',
  clientId: 'client-uuid-1',
  domain: 'acaciahealthcare.com',
  server: 'Oracle Cloud (Frankfurt)',
  plan: 'Business',
  status: 'ACTIVE',
  sslExpiry: new Date('2026-03-12'),
  deletedAt: null,
  client: { id: 'client-uuid-1', userId: 'user-uuid-1', businessName: 'Acacia Healthcare', plan: {} },
  backups: [],
  _count: { backups: 30 },
};

const mockClient = { id: 'client-uuid-1', userId: 'user-uuid-1' };

const staffUser  = { id: 'staff-uuid', roles: ['SUPPORT'] };
const clientUser = { id: 'user-uuid-1', roles: ['CLIENT'] };
const otherUser  = { id: 'other-uuid', roles: ['CLIENT'] };

const mockPrisma = {
  hostingAccount: {
    findMany:   jest.fn(),
    findFirst:  jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
    count:      jest.fn(),
    create:     jest.fn(),
  },
  client:  { findFirst: jest.fn() },
  backup:  { create: jest.fn() },
};

const mockEvents = { emit: jest.fn() };

describe('HostingService', () => {
  let service: HostingService;

  beforeEach(async () => {
    mockPrisma.hostingAccount.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HostingService,
        { provide: PrismaService,  useValue: mockPrisma },
        { provide: EventEmitter2,  useValue: mockEvents },
      ],
    }).compile();
    service = module.get<HostingService>(HostingService);
    jest.clearAllMocks();
    mockPrisma.hostingAccount.findMany.mockResolvedValue([]);
  });

  // ── findMe() ────────────────────────────────────────────────────────────────

  describe('findMe()', () => {
    it('returns hosting accounts for client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.hostingAccount.findMany.mockResolvedValue([mockAccount]);

      const result = await service.findMe('user-uuid-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].domain).toBe('acaciahealthcare.com');
    });

    it('throws NotFoundException when user has no client account', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      await expect(service.findMe('ghost-user')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findOne() ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('allows staff to access any account', async () => {
      mockPrisma.hostingAccount.findUnique.mockResolvedValue(mockAccount);
      const result = await service.findOne('hosting-uuid-1', staffUser);
      expect(result.data.id).toBe('hosting-uuid-1');
    });

    it('allows owner to access own account', async () => {
      mockPrisma.hostingAccount.findUnique.mockResolvedValue(mockAccount);
      const result = await service.findOne('hosting-uuid-1', clientUser);
      expect(result.data.domain).toBe('acaciahealthcare.com');
    });

    it('throws ForbiddenException for wrong user', async () => {
      mockPrisma.hostingAccount.findUnique.mockResolvedValue(mockAccount);
      await expect(service.findOne('hosting-uuid-1', otherUser)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for missing account', async () => {
      mockPrisma.hostingAccount.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-uuid', staffUser)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for soft-deleted account', async () => {
      mockPrisma.hostingAccount.findUnique.mockResolvedValue({ ...mockAccount, deletedAt: new Date() });
      await expect(service.findOne('hosting-uuid-1', staffUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ── triggerDailyBackups() ───────────────────────────────────────────────────

  describe('triggerDailyBackups()', () => {
    it('creates a backup record for each active account', async () => {
      mockPrisma.hostingAccount.findMany.mockResolvedValue([
        mockAccount,
        { ...mockAccount, id: 'hosting-uuid-2', domain: 'parkviewlaw.com' },
      ]);
      mockPrisma.backup.create.mockResolvedValue({});

      await service.triggerDailyBackups();

      expect(mockPrisma.backup.create).toHaveBeenCalledTimes(2);
    });

    it('creates backups with PENDING status', async () => {
      mockPrisma.hostingAccount.findMany.mockResolvedValue([mockAccount]);
      mockPrisma.backup.create.mockResolvedValue({});

      await service.triggerDailyBackups();

      const createCall = mockPrisma.backup.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('PENDING');
      expect(createCall.data.type).toBe('DAILY_INCREMENTAL');
    });

    it('sets expiry 30 days from now', async () => {
      mockPrisma.hostingAccount.findMany.mockResolvedValue([mockAccount]);
      mockPrisma.backup.create.mockResolvedValue({});

      await service.triggerDailyBackups();

      const createCall = mockPrisma.backup.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const diffDays = Math.round((expiresAt.getTime() - Date.now()) / 86_400_000);
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(30);
    });

    it('does nothing if no active accounts', async () => {
      mockPrisma.hostingAccount.findMany.mockResolvedValue([]);
      await service.triggerDailyBackups();
      expect(mockPrisma.backup.create).not.toHaveBeenCalled();
    });
  });

  // ── checkSslExpiry() ────────────────────────────────────────────────────────

  describe('checkSslExpiry()', () => {
    it('emits ssl.expiry_warning for certs expiring within 30 days', async () => {
      const expiringDate = new Date(Date.now() + 15 * 86_400_000); // 15 days from now
      mockPrisma.hostingAccount.findMany.mockResolvedValue([mockAccount]);
      mockPrisma.hostingAccount.update.mockResolvedValue(mockAccount);

      // Mock the private getSSLExpiry method
      jest.spyOn(service as any, 'getSSLExpiry').mockResolvedValue(expiringDate);

      await service.checkSslExpiry();

      expect(mockEvents.emit).toHaveBeenCalledWith('ssl.expiry_warning', expect.objectContaining({
        domain: 'acaciahealthcare.com',
        daysLeft: expect.any(Number),
      }));
    });

    it('does not emit for certs with >30 days remaining', async () => {
      const futureDate = new Date(Date.now() + 90 * 86_400_000); // 90 days
      mockPrisma.hostingAccount.findMany.mockResolvedValue([mockAccount]);
      mockPrisma.hostingAccount.update.mockResolvedValue(mockAccount);
      jest.spyOn(service as any, 'getSSLExpiry').mockResolvedValue(futureDate);

      await service.checkSslExpiry();

      expect(mockEvents.emit).not.toHaveBeenCalled();
    });

    it('updates ssl_expiry in DB after checking', async () => {
      const expiryDate = new Date('2026-06-01');
      mockPrisma.hostingAccount.findMany.mockResolvedValue([mockAccount]);
      mockPrisma.hostingAccount.update.mockResolvedValue(mockAccount);
      jest.spyOn(service as any, 'getSSLExpiry').mockResolvedValue(expiryDate);

      await service.checkSslExpiry();

      expect(mockPrisma.hostingAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sslExpiry: expiryDate }) }),
      );
    });

    it('continues processing remaining accounts when one fails', async () => {
      const secondAccount = { ...mockAccount, id: 'hosting-uuid-2', domain: 'parkviewlaw.com' };
      mockPrisma.hostingAccount.findMany.mockResolvedValue([mockAccount, secondAccount]);
      mockPrisma.hostingAccount.update.mockResolvedValue(mockAccount);

      const getSSLExpiry = jest.spyOn(service as any, 'getSSLExpiry');
      getSSLExpiry
        .mockRejectedValueOnce(new Error('Connection refused'))     // first fails
        .mockResolvedValueOnce(new Date('2026-06-01'));              // second succeeds

      await service.checkSslExpiry();

      expect(mockPrisma.hostingAccount.update).toHaveBeenCalledTimes(1); // only second updated
    });
  });

  // ── create() & DeploymentProvider Integration ───────────────────────────────

  describe('create()', () => {
    const createDto = {
      clientId: 'client-uuid-1',
      domain: 'newclient.co.ke',
      server: 'Contabo Cloud VPS',
      plan: 'Business',
      ipAddress: '192.0.2.1',
      serverOs: 'Ubuntu 24.04',
    };

    it('creates hosting account in database and emits hosting.provisioned event', async () => {
      mockPrisma.hostingAccount.create = jest.fn().mockResolvedValue({
        id: 'new-hosting-uuid',
        ...createDto,
        status: 'PROVISIONING',
        client: { businessName: 'New Client Ltd' },
      });

      const result = await service.create(createDto);

      expect(result.data.domain).toBe('newclient.co.ke');
      expect(result.data.status).toBe('PROVISIONING');
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'hosting.provisioned',
        expect.objectContaining({
          account: expect.objectContaining({ domain: 'newclient.co.ke' }),
        }),
      );
    });

    it('invokes deploymentProvider.createWorkload when configured', async () => {
      mockPrisma.hostingAccount.create = jest.fn().mockResolvedValue({
        id: 'new-hosting-uuid',
        ...createDto,
        status: 'PROVISIONING',
        client: { businessName: 'New Client Ltd' },
      });

      const mockProvider = {
        providerName: 'DokployProvider',
        name: 'DokployProvider',
        isConfigured: jest.fn().mockReturnValue(true),
        createWorkload: jest.fn().mockResolvedValue({
          workloadId: 'dok-workload-99',
          applicationId: 'dok-workload-99',
          domain: 'newclient.co.ke',
          status: 'PENDING',
          url: 'https://newclient.co.ke',
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HostingService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: EventEmitter2, useValue: mockEvents },
          { provide: DeploymentProvider, useValue: mockProvider },
        ],
      }).compile();

      const serviceWithProvider = module.get<HostingService>(HostingService);

      const result = await serviceWithProvider.create(createDto);

      expect(mockProvider.createWorkload).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'newclient.co.ke',
          clientId: 'client-uuid-1',
        }),
      );
      expect(result.provisionResult).toBeDefined();
      expect(result.provisionResult?.workloadId).toBe('dok-workload-99');
    });

    it('handles deploymentProvider error gracefully without failing database creation', async () => {
      mockPrisma.hostingAccount.create = jest.fn().mockResolvedValue({
        id: 'new-hosting-uuid',
        ...createDto,
        status: 'PROVISIONING',
        client: { businessName: 'New Client Ltd' },
      });

      const failingProvider = {
        providerName: 'DokployProvider',
        isConfigured: jest.fn().mockReturnValue(true),
        createWorkload: jest.fn().mockRejectedValue(new Error('Dokploy API timeout')),
      };

      const serviceWithFailingProvider = new HostingService(
        mockPrisma as any,
        mockEvents as any,
        failingProvider as any,
      );

      const result = await serviceWithFailingProvider.create(createDto);

      expect(result.data.id).toBe('new-hosting-uuid');
      expect(result.provisionResult).toBeUndefined();
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'hosting.provisioned',
        expect.objectContaining({ account: expect.anything() }),
      );
    });

    it('throws BadRequestException when hosting plan tier is invalid', async () => {
      await expect(
        service.create({
          ...createDto,
          plan: 'unsupported-plan-tier-xyz',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when attempting to provision on control-plane node', async () => {
      await expect(
        service.create({
          ...createDto,
          server: 'virtarix-control-plane',
        }),
      ).rejects.toThrow('Tenant workloads cannot be provisioned on control plane node');
    });

    it('throws BadRequestException when target worker node reaches max tenant density', async () => {
      const mockExisting = Array.from({ length: 23 }, (_, i) => ({
        id: `account-${i}`,
        plan: 'host-essential',
        server: 'leaseweb-london-worker-baseline',
      }));
      mockPrisma.hostingAccount.findMany.mockResolvedValue(mockExisting);

      await expect(service.create(createDto)).rejects.toThrow(
        /Server capacity boundary reached/,
      );
    });

    it('throws BadRequestException when target node usable memory headroom is exceeded', async () => {
      // 8 x host-pro (8 * 512MB = 4096MB) + 2 x host-business (2 * 256MB = 512MB) = 4608MB across 10 accounts
      // Available headroom = 4800MB - 4608MB = 192MB
      // Attempting to add host-business (requires 256MB) -> 4608 + 256 = 4864MB > 4800MB usable
      const mockExisting = [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `pro-${i}`,
          plan: 'host-pro',
          server: 'leaseweb-london-worker-baseline',
        })),
        { id: 'biz-1', plan: 'host-business', server: 'leaseweb-london-worker-baseline' },
        { id: 'biz-2', plan: 'host-business', server: 'leaseweb-london-worker-baseline' },
      ];
      mockPrisma.hostingAccount.findMany.mockResolvedValue(mockExisting);

      await expect(
        service.create({
          ...createDto,
          plan: 'host-business', // requires 256MB -> 4608 + 256 = 4864MB > 4800MB usable
        }),
      ).rejects.toThrow(/Server memory capacity boundary exceeded/);
    });

    it('passes canonical tier resource limits (CPU, memory, swap, PIDs, restart policy) to deployment provider', async () => {
      mockPrisma.hostingAccount.create = jest.fn().mockResolvedValue({
        id: 'new-hosting-uuid',
        ...createDto,
        status: 'PROVISIONING',
        client: { businessName: 'New Client Ltd' },
      });

      const mockProvider = {
        providerName: 'DokployProvider',
        name: 'DokployProvider',
        isConfigured: jest.fn().mockReturnValue(true),
        createWorkload: jest.fn().mockResolvedValue({
          workloadId: 'dok-workload-cgroups',
          domain: 'newclient.co.ke',
          status: 'PENDING',
          url: 'https://newclient.co.ke',
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          HostingService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: EventEmitter2, useValue: mockEvents },
          { provide: DeploymentProvider, useValue: mockProvider },
        ],
      }).compile();

      const serviceWithProvider = module.get<HostingService>(HostingService);
      await serviceWithProvider.create({
        ...createDto,
        plan: 'host-business',
      });

      expect(mockProvider.createWorkload).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceLimits: {
            cpus: 1.5,
            memoryLimitMb: 768,
            memoryReservationMb: 256,
            memorySwapMb: 768,
            pidsLimit: 150,
            restartPolicy: 'unless-stopped',
          },
        }),
      );
    });

    it('generates email routing DNS config and tenant database/redis config in create()', async () => {
      mockPrisma.hostingAccount.create = jest.fn().mockResolvedValue({
        id: 'new-hosting-uuid',
        ...createDto,
        plan: 'host-professional',
        status: 'PROVISIONING',
        client: { businessName: 'Pro Client Ltd' },
      });

      const result = await service.create({
        ...createDto,
        plan: 'host-professional',
        databaseType: 'postgresql',
        emailProvider: 'CLOUDFLARE_EMAIL_ROUTING',
        emailAliases: ['info', 'sales'],
      });

      expect(result.database).toBeDefined();
      expect(result.database?.type).toBe('postgresql');
      expect(result.database?.databaseName).toMatch(/^db_/);
      expect(result.database?.databaseUser).toMatch(/^usr_/);
      expect(result.database?.provisioningSql).toContain('CREATE DATABASE');

      expect(result.redis).toBeDefined();
      expect(result.redis?.keyPrefix).toMatch(/^app:/);
      expect(result.redis?.aclUserCommand).toContain('ACL SETUSER');

      expect(result.emailDns).toBeDefined();
      expect(result.emailDns?.provider).toBe('CLOUDFLARE_EMAIL_ROUTING');
      expect(result.emailDns?.mxRecords.length).toBeGreaterThan(0);
      expect(result.emailDns?.spfRecord.value).toContain('v=spf1');
    });
  });
});

describe('Hosting Tier Profiles & Normalization', () => {
  it('resolves canonical tier profiles with calibrated cgroups resource limits', () => {
    const essential = resolveHostingTier('host-essential');
    expect(essential).toBeDefined();
    expect(essential?.cpus).toBe(0.5);
    expect(essential?.memoryLimitMb).toBe(384);
    expect(essential?.memoryReservationMb).toBe(128);
    expect(essential?.memorySwapMb).toBe(384);
    expect(essential?.pidsLimit).toBe(100);
    expect(essential?.mailboxes).toBe(0);

    const business = resolveHostingTier('host-business');
    expect(business?.cpus).toBe(1.5);
    expect(business?.memoryLimitMb).toBe(768);
    expect(business?.memoryReservationMb).toBe(256);
    expect(business?.memorySwapMb).toBe(768);
    expect(business?.mailboxes).toBe(5);

    const pro = resolveHostingTier('host-professional');
    expect(pro?.cpus).toBe(2.0);
    expect(pro?.memoryLimitMb).toBe(1536);
    expect(pro?.memoryReservationMb).toBe(512);
    expect(pro?.memorySwapMb).toBe(1536);
    expect(pro?.mailboxes).toBe(10);

    const cloud = resolveHostingTier('host-cloud');
    expect(cloud?.cpus).toBe(4.0);
    expect(cloud?.memoryLimitMb).toBe(2048);
    expect(cloud?.memoryReservationMb).toBe(1024);
    expect(cloud?.memorySwapMb).toBe(2048);
    expect(cloud?.database).toBe('dedicated');
    expect(cloud?.redis).toBe('dedicated');
  });

  it('resolves commercial aliases and case-insensitive strings', () => {
    expect(resolveHostingTier('Starter')?.tierId).toBe('host-essential');
    expect(resolveHostingTier('business')?.tierId).toBe('host-business');
    expect(resolveHostingTier('HOST-PRO')?.tierId).toBe('host-professional');
    expect(resolveHostingTier('managed-cloud')?.tierId).toBe('host-cloud');
    expect(resolveHostingTier('unknown-tier-xyz')).toBeNull();
    expect(resolveHostingTier(null)).toBeNull();
  });
});

describe('Server Topologies & Node Headroom', () => {
  it('resolves baseline worker node topology and capacity parameters', () => {
    const node = resolveServerTopology('leaseweb-london-worker-baseline');
    expect(node.role).toBe('worker');
    expect(node.totalMemoryMb).toBe(6144);
    expect(node.reservedMemoryMb).toBe(1344);
    expect(node.usableMemoryMb).toBe(4800);
    expect(node.maxTenantCount).toBe(23);
  });

  it('resolves expansion worker node topology with high density thresholds', () => {
    const node = resolveServerTopology('leaseweb-london-worker-expansion');
    expect(node.totalMemoryMb).toBe(16384);
    expect(node.reservedMemoryMb).toBe(1504);
    expect(node.usableMemoryMb).toBe(14880);
    expect(node.maxTenantCount).toBe(61);
  });

  it('strictly isolates virtarix-control-plane with zero tenant capacity', () => {
    const node = resolveServerTopology('virtarix-control-plane');
    expect(node.role).toBe('control-plane');
    expect(node.usableMemoryMb).toBe(0);
    expect(node.maxTenantCount).toBe(0);
  });

  it('falls back safely to default baseline node for legacy fixtures or unknown strings', () => {
    expect(resolveServerTopology('Contabo Cloud VPS').nodeId).toBe('leaseweb-london-worker-baseline');
    expect(resolveServerTopology(null).nodeId).toBe('leaseweb-london-worker-baseline');
  });
});

describe('EmailRoutingHelper', () => {
  it('normalizes domain names stripping protocols and trailing paths', () => {
    expect(EmailRoutingHelper.normalizeDomain('https://example.com/')).toBe('example.com');
    expect(EmailRoutingHelper.normalizeDomain('HTTP://TEST.CO.KE:8080/path')).toBe('test.co.ke');
  });

  it('rejects invalid domain strings', () => {
    expect(() => EmailRoutingHelper.normalizeDomain('')).toThrow(BadRequestException);
    expect(() => EmailRoutingHelper.normalizeDomain('invalid_domain')).toThrow(BadRequestException);
  });

  it('enforces 0 inboxes on Host Essential and throws if aliases provided', () => {
    expect(() =>
      EmailRoutingHelper.generateEmailDnsRecords('test.co.ke', 'CLOUDFLARE_EMAIL_ROUTING', ['info'], 'host-essential'),
    ).toThrow(/Host Essential plan does not include custom corporate email inboxes/);
  });

  it('enforces max 5 inboxes on Host Business and throws if limit exceeded', () => {
    const sixAliases = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    expect(() =>
      EmailRoutingHelper.generateEmailDnsRecords('test.co.ke', 'CLOUDFLARE_EMAIL_ROUTING', sixAliases, 'host-business'),
    ).toThrow(/allows a maximum of 5 corporate inboxes/);
  });

  it('generates valid DNS records for supported providers', () => {
    const cf = EmailRoutingHelper.generateEmailDnsRecords('test.co.ke', 'CLOUDFLARE_EMAIL_ROUTING', ['info'], 'host-business');
    expect(cf.mxRecords.some((r) => r.host.includes('cloudflare.net'))).toBe(true);
    expect(cf.spfRecord.value).toContain('include:_spf.mx.cloudflare.net');

    const zoho = EmailRoutingHelper.generateEmailDnsRecords('test.co.ke', 'ZOHO_MAIL', ['info'], 'host-business');
    expect(zoho.mxRecords.some((r) => r.host.includes('zoho.com'))).toBe(true);
    expect(zoho.spfRecord.value).toContain('include:zoho.com');
  });

  it('merges SPF records correctly without duplicates', () => {
    const merged = EmailRoutingHelper.mergeSpf('v=spf1 include:sendgrid.net ~all', 'include:_spf.mx.cloudflare.net');
    expect(merged).toBe('v=spf1 include:sendgrid.net include:_spf.mx.cloudflare.net ~all');
    // Idempotent
    expect(EmailRoutingHelper.mergeSpf(merged, 'include:_spf.mx.cloudflare.net')).toBe(merged);
  });
});

describe('DatabaseTenancyHelper', () => {
  it('generates safe, compliant SQL identifiers for PostgreSQL and MariaDB', () => {
    const dbName = DatabaseTenancyHelper.sanitizeIdentifier('my-shop.co.ke', 'db');
    expect(dbName).toMatch(/^db_my_shop_[a-f0-9]{6}$/);
    expect(dbName.length).toBeLessThanOrEqual(63);

    const userName = DatabaseTenancyHelper.sanitizeIdentifier('my-shop.co.ke', 'usr');
    expect(userName).toMatch(/^usr_my_shop_[a-f0-9]{6}$/);
    expect(userName.length).toBeLessThanOrEqual(63);
  });

  it('generates high-entropy alphanumeric secure password without URI-reserved characters', () => {
    const pw = DatabaseTenancyHelper.generateSecurePassword(28);
    expect(pw).toHaveLength(28);
    expect(/^[A-Za-z0-9]+$/.test(pw)).toBe(true);
  });

  it('generates valid provisioning SQL for MariaDB and PostgreSQL', () => {
    const pgSql = DatabaseTenancyHelper.generateProvisioningSql({
      type: 'postgresql',
      databaseName: 'db_test_123',
      databaseUser: 'usr_test_123',
      password: 'SafePassword123',
    });
    expect(pgSql).toContain('CREATE DATABASE "db_test_123"');
    expect(pgSql).toContain('GRANT ALL PRIVILEGES ON DATABASE');

    const mariaSql = DatabaseTenancyHelper.generateProvisioningSql({
      type: 'mariadb',
      databaseName: 'db_test_123',
      databaseUser: 'usr_test_123',
      password: 'SafePassword123',
    });
    expect(mariaSql).toContain('CREATE DATABASE IF NOT EXISTS `db_test_123`');
    expect(mariaSql).toContain('GRANT ALL PRIVILEGES ON `db_test_123`.*');
  });

  it('generates dedicated container configuration for Managed Cloud', () => {
    const config = DatabaseTenancyHelper.provisionTenantDatabase({
      domain: 'enterprise.co.ke',
      clientId: 'client-cloud',
      plan: 'host-cloud',
    });
    expect(config.isDedicated).toBe(true);
    expect(config.dockerComposeService).toBeDefined();
    expect(config.dockerComposeService?.deploy?.resources?.limits?.memory).toBe('2048M');
  });
});

describe('RedisTenancyHelper', () => {
  it('generates isolated key prefix formatted as app:<slug>:', () => {
    const prefix = RedisTenancyHelper.generateTenantKeyPrefix('Acacia-Shop.co.ke');
    expect(prefix).toBe('app:acacia_shop:');
    expect(prefix.endsWith(':')).toBe(true);
  });

  it('generates Redis ACL command with dangerous commands revoked', () => {
    const acl = RedisTenancyHelper.generateAclCommand('usr_tenant_1', 'SecretPass', 'app:acacia:');
    expect(acl).toContain('ACL SETUSER usr_tenant_1 on >SecretPass ~app:acacia:*');
    expect(acl).toContain('-@dangerous -@admin');
  });

  it('generates dedicated Redis container configuration for Managed Cloud', () => {
    const config = RedisTenancyHelper.provisionTenantRedis({
      domain: 'enterprise.co.ke',
      clientId: 'client-cloud',
      plan: 'host-cloud',
    });
    expect(config.isDedicated).toBe(true);
    expect(config.dockerComposeService).toBeDefined();
    expect(config.dockerComposeService?.image).toBe('redis:7-alpine');
    expect(config.dockerComposeService?.deploy?.resources?.limits?.memory).toBe('512M');
  });
});


