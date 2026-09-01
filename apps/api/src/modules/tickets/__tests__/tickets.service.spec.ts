import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketsService } from '../tickets.service';
import { PrismaService } from '../../../prisma/prisma.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockClient = {
  id: 'client-uuid-1',
  userId: 'user-uuid-1',
  businessName: 'Acacia Healthcare Ltd',
  plan: { tier: 'BUSINESS', p1ResponseMinutes: 15 },
};

const mockTicket = {
  id: 'ticket-uuid-1',
  clientId: 'client-uuid-1',
  subject: 'Contact form not sending emails',
  priority: 'P2',
  status: 'OPEN',
  category: 'HOSTING',
  assignedTo: null,
  resolvedAt: null,
  slaBreached: false,
  createdAt: new Date('2025-06-01'),
  updatedAt: new Date('2025-06-01'),
  client: { ...mockClient, userId: 'user-uuid-1' },
  assignee: null,
  comments: [],
};

const staffUser  = { id: 'staff-uuid', roles: ['SUPPORT'] };
const clientUser = { id: 'user-uuid-1', roles: ['CLIENT'] };
const otherUser  = { id: 'other-uuid', roles: ['CLIENT'] };

// ── Mock PrismaService ────────────────────────────────────────────────────────

const mockPrisma = {
  client:        { findFirst: jest.fn(), findUnique: jest.fn() },
  ticket:        { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
  ticketComment: { create: jest.fn(), findMany: jest.fn() },
};

const mockEvents = { emit: jest.fn() };

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService,  useValue: mockPrisma },
        { provide: EventEmitter2,  useValue: mockEvents },
      ],
    }).compile();
    service = module.get<TicketsService>(TicketsService);
    jest.clearAllMocks();
  });

  // ── create() ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = { subject: 'Site is down', priority: 'P1' as const, category: 'HOSTING' as const, body: 'Error 503 on all pages' };

    it('creates ticket and emits event', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.ticket.create.mockResolvedValue({ ...mockTicket, priority: 'P1', subject: dto.subject });

      const result = await service.create(dto, clientUser);

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ priority: 'P1', subject: dto.subject }) }),
      );
      expect(mockEvents.emit).toHaveBeenCalledWith('ticket.created', expect.any(Object));
      expect(result.data.subject).toBe(dto.subject);
    });

    it('throws ForbiddenException when user has no client account', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      await expect(service.create(dto, clientUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── findAll() ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated tickets for staff (all clients)', async () => {
      mockPrisma.ticket.count.mockResolvedValue(1);
      mockPrisma.ticket.findMany.mockResolvedValue([mockTicket]);

      const result = await service.findAll(staffUser, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      // Staff: no clientId filter
      expect(mockPrisma.client.findFirst).not.toHaveBeenCalled();
    });

    it('scopes tickets to own client for CLIENT role', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.ticket.count.mockResolvedValue(2);
      mockPrisma.ticket.findMany.mockResolvedValue([mockTicket]);

      await service.findAll(clientUser, { scope: 'mine', page: 1, limit: 20 });

      expect(mockPrisma.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: clientUser.id } }),
      );
    });

    it('returns empty when client has no account', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const result = await service.findAll(clientUser, { scope: 'mine', page: 1, limit: 20 });
      expect(result.data).toHaveLength(0);
    });
  });

  // ── findOne() ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns ticket for owner', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);
      const result = await service.findOne('ticket-uuid-1', clientUser);
      expect(result.data.id).toBe('ticket-uuid-1');
    });

    it('returns ticket for staff', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);
      const result = await service.findOne('ticket-uuid-1', staffUser);
      expect(result.data).toBeDefined();
    });

    it('throws NotFoundException for missing ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-uuid', staffUser)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for wrong client', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);
      await expect(service.findOne('ticket-uuid-1', otherUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── update() ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates ticket status and emits event', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);
      mockPrisma.ticket.update.mockResolvedValue({ ...mockTicket, status: 'IN_PROGRESS' });

      const result = await service.update('ticket-uuid-1', { status: 'IN_PROGRESS' as any }, staffUser);

      expect(mockPrisma.ticket.update).toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith('ticket.updated', expect.any(Object));
      expect(result.data.status).toBe('IN_PROGRESS');
    });

    it('sets resolvedAt when status changes to RESOLVED', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, resolvedAt: null });
      mockPrisma.ticket.update.mockResolvedValue({ ...mockTicket, status: 'RESOLVED', resolvedAt: new Date() });

      await service.update('ticket-uuid-1', { status: 'RESOLVED' as any }, staffUser);

      const updateCall = mockPrisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.resolvedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException for missing ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { status: 'RESOLVED' as any }, staffUser))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── addComment() ────────────────────────────────────────────────────────────

  describe('addComment()', () => {
    it('adds public comment', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);
      mockPrisma.ticketComment.create.mockResolvedValue({
        id: 'comment-1', body: 'Test reply', isInternal: false,
        author: { firstName: 'Sarah', lastName: 'K.', role: 'CLIENT' },
      });
      mockPrisma.ticket.update.mockResolvedValue(mockTicket);

      const result = await service.addComment('ticket-uuid-1', { body: 'Test reply' }, clientUser);
      expect(result.data.body).toBe('Test reply');
    });

    it('marks staff comment as internal when flag is set', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);
      mockPrisma.ticketComment.create.mockResolvedValue({
        id: 'comment-2', body: 'Internal note', isInternal: true,
        author: { firstName: 'Joseph', lastName: 'M.', role: 'SUPPORT' },
      });

      await service.addComment('ticket-uuid-1', { body: 'Internal note', isInternal: true }, staffUser);

      const createCall = mockPrisma.ticketComment.create.mock.calls[0][0];
      expect(createCall.data.isInternal).toBe(true);
    });

    it('throws NotFoundException for missing ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);
      await expect(service.addComment('missing', { body: 'reply' }, clientUser))
        .rejects.toThrow(NotFoundException);
    });
  });
});
