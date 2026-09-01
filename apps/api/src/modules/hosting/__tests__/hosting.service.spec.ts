import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HostingService } from '../hosting.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockAccount = {
  id: 'hosting-uuid-1',
  clientId: 'client-uuid-1',
  domain: 'acaciahealthcare.co.ke',
  server: 'Oracle Cloud (Nairobi)',
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
  },
  client:  { findFirst: jest.fn() },
  backup:  { create: jest.fn() },
};

const mockEvents = { emit: jest.fn() };

describe('HostingService', () => {
  let service: HostingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HostingService,
        { provide: PrismaService,  useValue: mockPrisma },
        { provide: EventEmitter2,  useValue: mockEvents },
      ],
    }).compile();
    service = module.get<HostingService>(HostingService);
    jest.clearAllMocks();
  });

  // ── findMe() ────────────────────────────────────────────────────────────────

  describe('findMe()', () => {
    it('returns hosting accounts for client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.hostingAccount.findMany.mockResolvedValue([mockAccount]);

      const result = await service.findMe('user-uuid-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].domain).toBe('acaciahealthcare.co.ke');
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
      expect(result.data.domain).toBe('acaciahealthcare.co.ke');
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
        { ...mockAccount, id: 'hosting-uuid-2', domain: 'parkviewlaw.co.ke' },
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
        domain: 'acaciahealthcare.co.ke',
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
      const secondAccount = { ...mockAccount, id: 'hosting-uuid-2', domain: 'parkviewlaw.co.ke' };
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
});
