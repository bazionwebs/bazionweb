import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { VaultService } from '../vault.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('VaultService', () => {
  let service: VaultService;
  let prisma: any;
  let storedRow: any;

  const clientUser = { id: 'user-1', roles: ['CLIENT'] };
  const otherUser = { id: 'user-2', roles: ['CLIENT'] };
  const reqMeta = { ipAddress: '127.0.0.1', userAgent: 'jest-test' };

  beforeEach(async () => {
    storedRow = null;
    prisma = {
      client: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.userId === 'user-1') return { id: 'client-1', businessName: 'Abazion Project' };
          if (where.userId === 'user-2') return { id: 'client-2', businessName: 'Other Org' };
          return null;
        }),
      },
      vaultSecret: {
        findMany: jest.fn().mockImplementation(async () => (storedRow && !storedRow.deletedAt ? [storedRow] : [])),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          storedRow = {
            id: 'secret-1',
            ...data,
            lastRevealedAt: null,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return storedRow;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
          storedRow && storedRow.id === where.id ? storedRow : null,
        ),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          storedRow = { ...storedRow, ...data };
          return storedRow;
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'VAULT_MASTER_KEY' ? 'unit-test-32-byte-encryption-seed-key-2026!!' : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<VaultService>(VaultService);
  });

  it('encrypts secret with AES-256-GCM, stores masked hint, and decrypts on reveal with audit logs', async () => {
    const rawSecret = 'cf_live_token_9876543210abcdef';
    const created = await service.create(
      {
        label: 'Cloudflare DNS Zone Key',
        category: 'API_KEY',
        username: 'ops@bazionweb.com',
        serviceUrl: 'https://dash.cloudflare.com',
        value: rawSecret,
      },
      clientUser,
      reqMeta,
    );

    expect(created.data.label).toBe('Cloudflare DNS Zone Key');
    expect(created.data.maskedHint).toBe('cf••••••ef');
    expect(storedRow.encryptedValue).not.toContain(rawSecret);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'vault.secret_created' }) }),
    );

    const revealed = await service.reveal('secret-1', clientUser, reqMeta);
    expect(revealed.data.value).toBe(rawSecret);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'vault.secret_revealed' }) }),
    );
  });

  it('prevents cross-tenant access and rejects tampered AAD', async () => {
    await service.create(
      {
        label: 'Registrar Login',
        category: 'DOMAIN_REGISTRAR',
        value: 'SuperSecret!2026',
      },
      clientUser,
      reqMeta,
    );

    // Another client attempts to reveal secret-1 -> ForbiddenException
    await expect(service.reveal('secret-1', otherUser, reqMeta)).rejects.toThrow(ForbiddenException);

    // Simulate tampered clientId in DB (staff user bypasses tenant guard, GCM AAD rejects)
    storedRow.clientId = 'tampered-client';
    await expect(
      service.reveal('secret-1', { id: 'admin-1', roles: ['ADMIN'] }, reqMeta),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('soft-deletes secret and throws NotFoundException afterwards', async () => {
    await service.create(
      { label: 'SSH Key', category: 'HOSTING_SSH', value: 'ssh-ed25519 AAAA...' },
      clientUser,
      reqMeta,
    );

    const removed = await service.remove('secret-1', clientUser, reqMeta);
    expect(removed.data.deleted).toBe(true);
    await expect(service.reveal('secret-1', clientUser, reqMeta)).rejects.toThrow(NotFoundException);
  });

  it('fails fast if VAULT_MASTER_KEY is not configured or too short without falling back to JWT_SECRET', async () => {
    const unconfiguredModule = await Test.createTestingModule({
      providers: [
        VaultService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'JWT_SECRET' ? 'legacy-jwt-secret-that-must-never-be-used-as-vault-fallback' : undefined,
            ),
          },
        },
      ],
    }).compile();

    const unconfiguredService = unconfiguredModule.get<VaultService>(VaultService);
    await expect(
      unconfiguredService.create(
        { label: 'DB Password', category: 'DATABASE', value: 'secretPass123' },
        clientUser,
        reqMeta,
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
