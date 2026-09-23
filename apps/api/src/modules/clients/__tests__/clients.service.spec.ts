import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ClientsService } from '../clients.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPlan = { id: 'plan-uuid-1', name: 'Business', tier: 'BUSINESS', priceMonthly: 199 };

const mockClient = {
  id: 'client-uuid-1',
  userId: 'user-uuid-1',
  businessName: 'Acacia Healthcare Ltd',
  contactName: 'Sarah Kamau',
  email: 'sarah@acacia.com',
  phone: '+15550101234',
  country: 'US',
  planId: 'plan-uuid-1',
  status: 'ACTIVE',
  deletedAt: null,
  plan: mockPlan,
  subscriptions: [],
  _count: { tickets: 1, projects: 0, hostingAccounts: 1 },
};

const adminUser  = { id: 'admin-uuid', roles: ['ADMIN'] };
const clientUser = { id: 'user-uuid-1', roles: ['CLIENT'] };
const otherUser  = { id: 'other-uuid', roles: ['CLIENT'] };

const mockPrisma = {
  client: {
    findFirst:        jest.fn(),
    findUnique:       jest.fn(),
    findMany:         jest.fn(),
    count:            jest.fn(),
    create:           jest.fn(),
    update:           jest.fn(),
  },
  plan: {
    findFirstOrThrow: jest.fn(),
  },
};

describe('ClientsService', () => {
  let service: ClientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ClientsService>(ClientsService);
    jest.clearAllMocks();
  });

  // ── create() ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = {
      businessName: 'New Business Ltd',
      contactName:  'John Doe',
      email:        'john@newbiz.com',
      planTier:     'STARTER',
    };

    it('creates a new client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      mockPrisma.plan.findFirstOrThrow.mockResolvedValue(mockPlan);
      mockPrisma.client.create.mockResolvedValue({ ...mockClient, email: dto.email, businessName: dto.businessName });

      const result = await service.create(dto);

      expect(mockPrisma.client.create).toHaveBeenCalled();
      expect(result.data.email).toBe(dto.email);
    });

    it('throws ConflictException for duplicate email', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ── findAll() ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated clients', async () => {
      mockPrisma.client.count.mockResolvedValue(3);
      mockPrisma.client.findMany.mockResolvedValue([mockClient]);

      const result = await service.findAll({ page: 1, limit: 25 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(3);
      expect(result.meta.totalPages).toBe(1);
    });

    it('applies status filter', async () => {
      mockPrisma.client.count.mockResolvedValue(0);
      mockPrisma.client.findMany.mockResolvedValue([]);

      await service.findAll({ status: 'TRIAL', page: 1, limit: 25 });

      const countCall = mockPrisma.client.count.mock.calls[0][0];
      expect(countCall.where.status).toBe('TRIAL');
    });

    it('applies search filter on businessName', async () => {
      mockPrisma.client.count.mockResolvedValue(1);
      mockPrisma.client.findMany.mockResolvedValue([mockClient]);

      await service.findAll({ q: 'Acacia', page: 1, limit: 25 });

      const countCall = mockPrisma.client.count.mock.calls[0][0];
      expect(countCall.where.OR).toBeDefined();
      expect(countCall.where.OR[0].businessName.contains).toBe('Acacia');
    });
  });

  // ── findByUserId() ──────────────────────────────────────────────────────────

  describe('findByUserId()', () => {
    it('returns own client account', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      const result = await service.findByUserId('user-uuid-1');
      expect(result.data.id).toBe('client-uuid-1');
    });

    it('throws NotFoundException when user has no client account', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      await expect(service.findByUserId('ghost-user')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findOne() ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('allows admin to access any client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const result = await service.findOne('client-uuid-1', adminUser);
      expect(result.data.id).toBe('client-uuid-1');
    });

    it('allows client to access own record', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const result = await service.findOne('client-uuid-1', clientUser);
      expect(result.data).toBeDefined();
    });

    it('throws ForbiddenException for other client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      await expect(service.findOne('client-uuid-1', otherUser)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for missing client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-uuid', adminUser)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for soft-deleted client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ ...mockClient, deletedAt: new Date() });
      await expect(service.findOne('client-uuid-1', adminUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ── update() ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('admin can update businessName', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.client.update.mockResolvedValue({ ...mockClient, businessName: 'Updated Name' });

      const result = await service.update('client-uuid-1', { businessName: 'Updated Name' }, adminUser);
      expect(result.data.businessName).toBe('Updated Name');
    });

    it('client cannot change own status', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.client.update.mockResolvedValue(mockClient);

      await service.update('client-uuid-1', { status: 'SUSPENDED' } as any, clientUser);

      const updateCall = mockPrisma.client.update.mock.calls[0][0];
      // status should be stripped from the update data
      expect(updateCall.data.status).toBeUndefined();
    });
  });

  // ── softDelete() ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets deletedAt and status to CANCELLED', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.client.update.mockResolvedValue({ ...mockClient, deletedAt: new Date(), status: 'CANCELLED' });

      const result = await service.softDelete('client-uuid-1');

      const updateCall = mockPrisma.client.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
      expect(updateCall.data.status).toBe('CANCELLED');
      expect(result.data.deleted).toBe(true);
    });

    it('throws NotFoundException for missing client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('missing-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
