import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service';
import { HostingService } from '../hosting.service';
import { DokployProvider } from '../providers/dokploy.provider';
import { resolveHostingTier } from '../constants/hosting-tiers.config';
import { resolveServerTopology } from '../constants/server-topologies.config';
import { EmailRoutingHelper } from '../email/email-routing.helper';
import { DatabaseTenancyHelper } from '../database/database-tenancy.helper';
import { RedisTenancyHelper } from '../cache/redis-tenancy.helper';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Milestone 1 Adversarial Stress Tests', () => {
  // =========================================================================
  // VECTOR 1: Plan Names, Casing, Whitespace, Null/Undefined, and Keyword Exploits
  // =========================================================================
  describe('Vector 1: resolveHostingTier Adversarial Testing', () => {
    it('handles null, undefined, empty, and non-string plan inputs safely', () => {
      expect(resolveHostingTier(null)).toBeNull();
      expect(resolveHostingTier(undefined)).toBeNull();
      expect(resolveHostingTier('')).toBeNull();
      expect(resolveHostingTier('   ')).toBeNull();
      expect(resolveHostingTier(123 as any)).toBeNull();
      expect(resolveHostingTier({} as any)).toBeNull();
      expect(resolveHostingTier([] as any)).toBeNull();
    });

    it('handles edge case casing and messy whitespace correctly', () => {
      expect(resolveHostingTier('HOST-ESSENTIAL')?.tierId).toBe('host-essential');
      expect(resolveHostingTier('  host-business  ')?.tierId).toBe('host-business');
      expect(resolveHostingTier('\tHost-Professional\n')?.tierId).toBe('host-professional');
      expect(resolveHostingTier('MANAGED_CLOUD')?.tierId).toBe('host-cloud');
      expect(resolveHostingTier('host   essential')?.tierId).toBe('host-essential');
      expect(resolveHostingTier('HOST__BUSINESS')?.tierId).toBe('host-business');
    });

    it('resolves commercial aliases reliably', () => {
      expect(resolveHostingTier('starter')?.tierId).toBe('host-essential');
      expect(resolveHostingTier('growth')?.tierId).toBe('host-business');
      expect(resolveHostingTier('scale')?.tierId).toBe('host-professional');
      expect(resolveHostingTier('enterprise')?.tierId).toBe('host-cloud');
      expect(resolveHostingTier('managed-cloud')?.tierId).toBe('host-cloud');
    });

    it('returns null for completely unsupported or invalid plan names', () => {
      expect(resolveHostingTier('unsupported-tier-xyz')).toBeNull();
      expect(resolveHostingTier('free-forever')).toBeNull();
      expect(resolveHostingTier('tier-99')).toBeNull();
      expect(resolveHostingTier('super-server')).toBeNull();
      expect(resolveHostingTier('undefined')).toBeNull();
    });

    it('empirically probes keyword false-positives', () => {
      // Examining greedy keyword matching:
      // normalized.includes('pro') triggers host-professional
      // normalized.includes('managed') triggers host-cloud
      const proResult = resolveHostingTier('problematic');
      const unmanagedResult = resolveHostingTier('unmanaged');
      const productResult = resolveHostingTier('product-tier');

      expect(proResult?.tierId).toBe('host-professional');
      expect(unmanagedResult?.tierId).toBe('host-cloud');
      expect(productResult?.tierId).toBe('host-professional');
    });
  });

  // =========================================================================
  // VECTOR 2: Control Plane Isolation & Alias Variations
  // =========================================================================
  describe('Vector 2: Control Plane Targeting Variations', () => {
    const controlPlaneVariations = [
      'virtarix-control-plane',
      'Virtarix Control Plane',
      'virtarix_control_plane',
      'VIRTARIX_CONTROL_PLANE',
      '  virtarix-control-plane  ',
      'control-plane',
      'virtarix',
      'mgmt-server',
      'virtarix.management.node',
    ];

    it.each(controlPlaneVariations)(
      'resolves "%s" to virtarix-control-plane with 0 usable memory and 0 max tenants',
      (identifier) => {
        const topology = resolveServerTopology(identifier);
        expect(topology.nodeId).toBe('virtarix-control-plane');
        expect(topology.role).toBe('control-plane');
        expect(topology.usableMemoryMb).toBe(0);
        expect(topology.maxTenantCount).toBe(0);
      },
    );
  });

  // =========================================================================
  // VECTOR 3: Boundary Tests for maxTenantCount (22nd, 23rd, 24th Tenant)
  // =========================================================================
  describe('Vector 3: maxTenantCount Density Boundaries in HostingService', () => {
    let service: HostingService;
    let prisma: {
      $queryRaw: jest.Mock;
      hostingAccount: {
        findMany: jest.Mock;
        findUnique: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
      };
    };
    let mockEvents: { emit: jest.Mock };
    let mockDeploymentProvider: {
      isConfigured: jest.Mock;
      createWorkload: jest.Mock;
    };

    beforeEach(async () => {
      prisma = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        hostingAccount: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      };

      mockEvents = { emit: jest.fn() };

      mockDeploymentProvider = {
        isConfigured: jest.fn().mockReturnValue(true),
        createWorkload: jest.fn().mockResolvedValue({
          workloadId: 'dokploy-test-id',
          status: 'RUNNING',
          endpoint: 'https://test.bazion.com',
          details: {},
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HostingService,
          { provide: PrismaService, useValue: prisma },
          { provide: EventEmitter2, useValue: mockEvents },
        ],
      }).compile();

      service = module.get<HostingService>(HostingService);
      (service as any).deploymentProvider = mockDeploymentProvider;
    });

    it('permits provisioning the 23rd tenant on baseline node (activeAccounts = 22)', async () => {
      const mockAccounts = Array.from({ length: 22 }, (_, i) => ({
        id: `acct-${i + 1}`,
        plan: 'host-essential',
        server: 'leaseweb-london-worker-baseline',
      }));

      prisma.hostingAccount.findMany.mockResolvedValue(mockAccounts);
      prisma.hostingAccount.create.mockResolvedValue({
        id: 'acct-23',
        clientId: 'client-23',
        domain: 'tenant23.co.ke',
        server: 'leaseweb-london-worker-baseline',
        plan: 'host-essential',
        status: 'PROVISIONING',
      });

      const result = await service.create({
        clientId: 'client-23',
        domain: 'tenant23.co.ke',
        server: 'leaseweb-london-worker-baseline',
        plan: 'host-essential',
      });

      expect(result).toBeDefined();
      expect(prisma.hostingAccount.create).toHaveBeenCalled();
      expect(mockDeploymentProvider.createWorkload).toHaveBeenCalled();
    });

    it('REJECTS provisioning the 24th tenant on baseline node (activeAccounts = 23)', async () => {
      const mockAccounts = Array.from({ length: 23 }, (_, i) => ({
        id: `acct-${i + 1}`,
        plan: 'host-essential',
        server: 'leaseweb-london-worker-baseline',
      }));

      prisma.hostingAccount.findMany.mockResolvedValue(mockAccounts);

      await expect(
        service.create({
          clientId: 'client-24',
          domain: 'tenant24.co.ke',
          server: 'leaseweb-london-worker-baseline',
          plan: 'host-essential',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.hostingAccount.create).not.toHaveBeenCalled();
      expect(mockDeploymentProvider.createWorkload).not.toHaveBeenCalled();
    });

    it('REJECTS provisioning when server is already over saturated (activeAccounts = 24)', async () => {
      const mockAccounts = Array.from({ length: 24 }, (_, i) => ({
        id: `acct-${i + 1}`,
        plan: 'host-essential',
        server: 'leaseweb-london-worker-baseline',
      }));

      prisma.hostingAccount.findMany.mockResolvedValue(mockAccounts);

      await expect(
        service.create({
          clientId: 'client-25',
          domain: 'tenant25.co.ke',
          server: 'leaseweb-london-worker-baseline',
          plan: 'host-essential',
        }),
      ).rejects.toThrow(
        /Server capacity boundary reached: node "Leaseweb London Worker \(Baseline\)" has reached its maximum tenant density threshold/,
      );
    });

    it('strictly rejects any provisioning attempt targeting control plane variations', async () => {
      const variations = [
        'virtarix-control-plane',
        'Virtarix Control Plane',
        'virtarix_control_plane',
        'VIRTARIX_CONTROL_PLANE',
        'control-plane',
      ];

      for (const server of variations) {
        await expect(
          service.create({
            clientId: 'client-cp-test',
            domain: 'cptest.co.ke',
            server,
            plan: 'host-essential',
          }),
        ).rejects.toThrow(
          /Tenant workloads cannot be provisioned on control plane node "Virtarix Control Plane"/,
        );
      }
    });
  });

  // =========================================================================
  // VECTOR 4: Usable Memory Headroom Boundaries (5,120 MB vs 5,121 MB)
  // =========================================================================
  describe('Vector 4: usableMemoryMb Headroom Boundaries in HostingService', () => {
    let service: HostingService;
    let prisma: {
      $queryRaw: jest.Mock;
      hostingAccount: {
        findMany: jest.Mock;
        findUnique: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
      };
    };
    let mockEvents: { emit: jest.Mock };
    let mockDeploymentProvider: {
      isConfigured: jest.Mock;
      createWorkload: jest.Mock;
    };

    beforeEach(async () => {
      prisma = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        hostingAccount: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      };

      mockEvents = { emit: jest.fn() };

      mockDeploymentProvider = {
        isConfigured: jest.fn().mockReturnValue(true),
        createWorkload: jest.fn().mockResolvedValue({
          workloadId: 'dokploy-test-id',
          status: 'RUNNING',
          endpoint: 'https://test.bazion.com',
          details: {},
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HostingService,
          { provide: PrismaService, useValue: prisma },
          { provide: EventEmitter2, useValue: mockEvents },
        ],
      }).compile();

      service = module.get<HostingService>(HostingService);
      (service as any).deploymentProvider = mockDeploymentProvider;
    });

    it('SUCCEEDS when total allocated memory fits within 4,800 MB headroom (4,608 MB + 128 MB)', async () => {
      // 8 x host-professional (512 MB each = 4,096 MB) + 2 x host-business (256 MB each = 512 MB) = 4,608 MB
      // 4,608 + 128 = 4,736 MB <= 4,800 MB
      const accounts = [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `pro-${i}`,
          plan: 'host-professional',
          server: 'leaseweb-london-worker-baseline',
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `biz-${i}`,
          plan: 'host-business',
          server: 'leaseweb-london-worker-baseline',
        })),
      ];

      prisma.hostingAccount.findMany.mockResolvedValue(accounts);
      prisma.hostingAccount.create.mockResolvedValue({
        id: 'acct-exact-fit',
        clientId: 'client-fit',
        domain: 'exactfit.co.ke',
        server: 'leaseweb-london-worker-baseline',
        plan: 'host-essential',
        status: 'PROVISIONING',
      });

      const result = await service.create({
        clientId: 'client-fit',
        domain: 'exactfit.co.ke',
        server: 'leaseweb-london-worker-baseline',
        plan: 'host-essential',
      });

      expect(result).toBeDefined();
      expect(prisma.hostingAccount.create).toHaveBeenCalled();
    });

    it('REJECTS when total memory allocation exceeds 4,800 MB headroom (4,608 MB + 256 MB)', async () => {
      // 8 x host-professional (4,096 MB) + 2 x host-business (512 MB) = 4,608 MB allocated
      // Headroom: 4,800 - 4,608 = 192 MB. Host Business requires 256 MB.
      const accounts = [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `pro-${i}`,
          plan: 'host-professional',
          server: 'leaseweb-london-worker-baseline',
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `biz-${i}`,
          plan: 'host-business',
          server: 'leaseweb-london-worker-baseline',
        })),
      ];

      prisma.hostingAccount.findMany.mockResolvedValue(accounts);

      await expect(
        service.create({
          clientId: 'client-overflow',
          domain: 'overflow.co.ke',
          server: 'leaseweb-london-worker-baseline',
          plan: 'host-business', // requires 256MB
        }),
      ).rejects.toThrow(
        /Server memory capacity boundary exceeded: node "Leaseweb London Worker \(Baseline\)" has only 192MB available memory headroom, but tier "Host Business" requires 256MB reservation/,
      );
    });

    it('REJECTS when attempting to provision a tier larger than remaining headroom', async () => {
      // 8 x host-professional (4,096 MB) allocated
      // Available: 4,800 - 4,096 = 704 MB
      // Attempting to provision Managed Cloud (1,024 MB reservation)
      const accounts = Array.from({ length: 8 }, (_, i) => ({
        id: `pro-${i}`,
        plan: 'host-professional',
        server: 'leaseweb-london-worker-baseline',
      }));

      prisma.hostingAccount.findMany.mockResolvedValue(accounts);

      await expect(
        service.create({
          clientId: 'client-cloud',
          domain: 'cloud.co.ke',
          server: 'leaseweb-london-worker-baseline',
          plan: 'host-cloud', // requires 1024 MB
        }),
      ).rejects.toThrow(
        /Server memory capacity boundary exceeded: node "Leaseweb London Worker \(Baseline\)" has only 704MB available memory headroom, but tier "Managed Cloud" requires 1024MB reservation/,
      );
    });
  });

  // =========================================================================
  // VECTOR 5: Mailbox Limit Boundary Tests & Alias Normalization
  // =========================================================================
  describe('Vector 5: EmailRoutingHelper Boundary Tests', () => {
    it('enforces Host Essential 0 mailboxes: rejects custom corporate email aliases', () => {
      expect(() =>
        EmailRoutingHelper.generateEmailDnsRecords(
          'essentialcorp.co.ke',
          'CLOUDFLARE_EMAIL_ROUTING',
          ['info'],
          'host-essential',
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        EmailRoutingHelper.generateEmailDnsRecords(
          'essentialcorp.co.ke',
          'CLOUDFLARE_EMAIL_ROUTING',
          ['support@essentialcorp.co.ke'],
          'host-essential',
        ),
      ).toThrow(
        /Host Essential plan does not include custom corporate email inboxes/,
      );
    });

    it('allows Host Essential to generate transactional DNS when no custom aliases passed', () => {
      const config = EmailRoutingHelper.generateEmailDnsRecords(
        'essentialcorp.co.ke',
        'CLOUDFLARE_EMAIL_ROUTING',
        [],
        'host-essential',
      );
      expect(config.aliases).toEqual([]);
      expect(config.maxInboxes).toBe(0);
      expect(config.mxRecords.length).toBeGreaterThan(0);
    });

    it('permits exactly 5 aliases for Host Business', () => {
      const fiveAliases = ['info', 'sales', 'billing', 'support', 'contact'];
      const config = EmailRoutingHelper.generateEmailDnsRecords(
        'bizcorp.co.ke',
        'CLOUDFLARE_EMAIL_ROUTING',
        fiveAliases,
        'host-business',
      );
      expect(config.aliases).toHaveLength(5);
      expect(config.maxInboxes).toBe(5);
    });

    it('permits 6 raw aliases if duplicates reduce total unique aliases to 5', () => {
      const withDuplicates = ['info', 'sales', 'billing', 'support', 'contact', 'info@bizcorp.co.ke'];
      const config = EmailRoutingHelper.generateEmailDnsRecords(
        'bizcorp.co.ke',
        'CLOUDFLARE_EMAIL_ROUTING',
        withDuplicates,
        'host-business',
      );
      expect(config.aliases).toHaveLength(5);
    });

    it('REJECTS 6 unique aliases for Host Business with BadRequestException', () => {
      const sixAliases = ['info', 'sales', 'billing', 'support', 'contact', 'extra'];
      expect(() =>
        EmailRoutingHelper.generateEmailDnsRecords(
          'bizcorp.co.ke',
          'CLOUDFLARE_EMAIL_ROUTING',
          sixAliases,
          'host-business',
        ),
      ).toThrow(
        /Plan "host-business" allows a maximum of 5 corporate inboxes. Received 6 aliases/,
      );
    });

    it('rejects invalid or malicious email alias formats', () => {
      const maliciousAliases = [
        'admin; DROP TABLE',
        'user<script>',
        'space alias',
        'a'.repeat(65),
      ];

      for (const alias of maliciousAliases) {
        expect(() =>
          EmailRoutingHelper.generateEmailDnsRecords(
            'bizcorp.co.ke',
            'CLOUDFLARE_EMAIL_ROUTING',
            [alias],
            'host-business',
          ),
        ).toThrow(BadRequestException);
      }
    });

    it('rejects malicious or invalid domain formats', () => {
      const maliciousDomains = [
        "domain.com'; DROP TABLE users; --",
        'domain..com',
        'localhost',
        '   ',
        null as any,
      ];

      for (const domain of maliciousDomains) {
        expect(() =>
          EmailRoutingHelper.generateEmailDnsRecords(
            domain,
            'CLOUDFLARE_EMAIL_ROUTING',
            ['info'],
            'host-business',
          ),
        ).toThrow(BadRequestException);
      }
    });

    it('strips url scheme and path from domain input during normalization', () => {
      const config1 = EmailRoutingHelper.generateEmailDnsRecords(
        'https://mycorp.co.ke',
        'CLOUDFLARE_EMAIL_ROUTING',
        ['info'],
        'host-business',
      );
      expect(config1.domain).toBe('mycorp.co.ke');

      const config2 = EmailRoutingHelper.generateEmailDnsRecords(
        'mycorp.co.ke/some/path',
        'CLOUDFLARE_EMAIL_ROUTING',
        ['info'],
        'host-business',
      );
      expect(config2.domain).toBe('mycorp.co.ke');
    });
  });

  // =========================================================================
  // VECTOR 6: SQL Identifier Sanitization & Injection Defense
  // =========================================================================
  describe('Vector 6: DatabaseTenancyHelper SQL Injection Defense', () => {
    const maliciousDomainInputs = [
      "domain.com'; DROP TABLE users; --",
      'admin" OR 1=1 --',
      "x'; DELETE FROM accounts; --",
      'db_injection`--',
      '../../../etc/passwd',
      '<script>alert(1)</script>',
      'union select null, null, null--',
      ';;;\'\'\'---',
      'foo.bar.co.ke:3306',
      'https://my-domain.com/evil',
    ];

    it.each(maliciousDomainInputs)(
      'sanitizes malicious domain "%s" into safe alphanumeric SQL identifier',
      (maliciousInput) => {
        const dbIdentifier = DatabaseTenancyHelper.sanitizeIdentifier(maliciousInput, 'db');
        const usrIdentifier = DatabaseTenancyHelper.sanitizeIdentifier(maliciousInput, 'usr');

        // Must match strict pattern: prefix_base_hex
        expect(dbIdentifier).toMatch(/^db_[a-z0-9_]+_[a-f0-9]{6}$/);
        expect(usrIdentifier).toMatch(/^usr_[a-z0-9_]+_[a-f0-9]{6}$/);

        // Must NOT contain unsafe SQL characters
        expect(dbIdentifier).not.toMatch(/['";`\s\-\/\\]/);
        expect(usrIdentifier).not.toMatch(/['";`\s\-\/\\]/);

        // Total length must be <= 63 characters (Postgres identifier limit)
        expect(dbIdentifier.length).toBeLessThanOrEqual(63);
        expect(usrIdentifier.length).toBeLessThanOrEqual(63);
      },
    );

    it('generates secure provisioning SQL with zero unescaped injections', () => {
      const config = DatabaseTenancyHelper.provisionTenantDatabase({
        domain: "hacked.com'; DROP DATABASE master; --",
        clientId: 'client-evil',
        type: 'postgresql',
      });

      expect(config.provisioningSql).toContain(`CREATE DATABASE "${config.databaseName}"`);
      expect(config.provisioningSql).toContain(`CREATE USER "${config.databaseUser}"`);
      expect(config.provisioningSql).not.toContain('DROP DATABASE');
      expect(config.databaseName).not.toContain(';');
      expect(config.databaseUser).not.toContain(';');
    });

    it('rejects empty inputs with BadRequestException', () => {
      expect(() => DatabaseTenancyHelper.sanitizeIdentifier('', 'db')).toThrow(BadRequestException);
      expect(() => DatabaseTenancyHelper.sanitizeIdentifier(null as any, 'db')).toThrow(BadRequestException);
    });

    it('documents fallback to "tenant" when input consists purely of stripped characters', () => {
      const idWhitespace = DatabaseTenancyHelper.sanitizeIdentifier('   ', 'db');
      expect(idWhitespace).toMatch(/^db_tenant_[a-f0-9]{6}$/);
    });
  });

  // =========================================================================
  // VECTOR 7: Redis Key Prefix & ACL Command Injection Defense
  // =========================================================================
  describe('Vector 7: RedisTenancyHelper Security & Boundaries', () => {
    const maliciousDomains = [
      'tenant.com\r\nSET evil 1\r\n',
      'tenant.com * +@all',
      'tenant.com; FLUSHALL;',
      'tenant.com ~*',
      'attacker.co.ke:6379/db',
    ];

    it.each(maliciousDomains)(
      'sanitizes malicious domain "%s" into strict Redis tenant key prefix',
      (domain) => {
        const prefix = RedisTenancyHelper.generateTenantKeyPrefix(domain);
        expect(prefix).toMatch(/^app:[a-z0-9_]{1,20}:$/);
        const slug = prefix.replace(/^app:|:$/g, '');
        expect(slug).not.toMatch(/[\r\n\s*~;:]/);
      },
    );

    it('generates ACL command strictly restricting user to key prefix and revoking dangerous commands', () => {
      const config = RedisTenancyHelper.provisionTenantRedis({
        domain: "victimcorp.co.ke'; FLUSHALL; --",
        clientId: 'client-redis-01',
      });

      expect(config.aclUserCommand).toBeDefined();
      expect(config.aclUserCommand).toContain(`~${config.keyPrefix}*`);
      expect(config.aclUserCommand).toContain('-@dangerous');
      expect(config.aclUserCommand).toContain('-@admin');
      expect(config.aclUserCommand).toContain('+ping');
      expect(config.aclUserCommand).toContain('+select');
      expect(config.aclUserCommand).not.toContain('FLUSHALL');
      expect(config.aclUserCommand).not.toContain('\r');
      expect(config.aclUserCommand).not.toContain('\n');
    });

    it('tests generateAclCommand directly with untrusted inputs', () => {
      const cmd = RedisTenancyHelper.generateAclCommand(
        'usr_test',
        'secretPass123',
        'app:test:',
      );
      expect(cmd).toBe('ACL SETUSER usr_test on >secretPass123 ~app:test:* +@all -@dangerous -@admin +ping +select');
    });
  });

  // =========================================================================
  // VECTOR 8: DokployProvider Resource Limits & Allocation Guards
  // =========================================================================
  describe('Vector 8: DokployProvider Allocation Guard Edge Cases', () => {
    let provider: DokployProvider;
    let mockHttpClient: {
      post: jest.Mock;
      get: jest.Mock;
      interceptors: { response: { use: jest.Mock } };
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'DOKPLOY_API_URL') return 'http://127.0.0.1:3000';
        if (key === 'DOKPLOY_API_KEY') return 'test-token';
        return defaultValue;
      }),
    };

    beforeEach(async () => {
      jest.clearAllMocks();

      mockHttpClient = {
        post: jest.fn().mockImplementation((url: string) => {
          if (url === '/api/project.create') {
            return Promise.resolve({ data: { projectId: 'project-test-id' } });
          }
          if (url === '/api/application.create') {
            return Promise.resolve({ data: { applicationId: 'app-test-id' } });
          }
          return Promise.resolve({ data: {} });
        }),
        get: jest.fn().mockResolvedValue({
          data: [{ projectId: 'project-test-id', name: 'client-test' }],
        }),
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      };

      mockedAxios.create.mockReturnValue(mockHttpClient as any);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DokployProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<DokployProvider>(DokployProvider);
    });

    it('rejects allocation when resourceLimits is completely missing', async () => {
      await expect(
        provider.createWorkload({
          name: 'app-no-limits',
          domain: 'nolimits.co.ke',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // CRITICAL EMPIRICAL CHALLENGE:
    // Testing the logic: strictly requires both positive cpus and memoryLimitMb
    it('strictly enforces the allocation guard when partial limits are supplied', async () => {
      const createdPayloads: any[] = [];
      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/project.create') {
          return Promise.resolve({ data: { projectId: 'project-test-id' } });
        }
        if (url === '/api/application.create') {
          createdPayloads.push(payload);
          return Promise.resolve({ data: { applicationId: 'app-partial-01' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Scenario A: Caller passes ONLY cpus, forgetting memoryLimitMb
      let threwOnMissingMemory = false;
      try {
        await provider.createWorkload({
          name: 'app-only-cpus',
          domain: 'onlycpus.co.ke',
          resourceLimits: {
            cpus: 1.5,
          } as any,
        });
      } catch (err) {
        if (err instanceof BadRequestException) {
          threwOnMissingMemory = true;
        }
      }

      // Scenario B: Caller passes ONLY memoryLimitMb, forgetting cpus
      let threwOnMissingCpu = false;
      try {
        await provider.createWorkload({
          name: 'app-only-mem',
          domain: 'onlymem.co.ke',
          resourceLimits: {
            memoryLimitMb: 1024,
          } as any,
        });
      } catch (err) {
        if (err instanceof BadRequestException) {
          threwOnMissingCpu = true;
        }
      }

      expect(threwOnMissingMemory).toBe(true);
      expect(threwOnMissingCpu).toBe(true);
      expect(createdPayloads).toHaveLength(0);
    });
  });
});
