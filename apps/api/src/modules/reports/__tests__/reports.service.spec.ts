import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../reports.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;
  let events: any;

  beforeEach(async () => {
    prisma = {
      client: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      ticket: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      hostingAccount: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      backup: {
        count: jest.fn(),
      },
      subscription: {
        findMany: jest.fn(),
      },
    };

    events = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('findMe', () => {
    it('should throw NotFoundException if client not found', async () => {
      (prisma.client!.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findMe('user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.client!.findFirst).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('should return reports for the client', async () => {
      const mockClient = { id: 'client-1', userId: 'user-1' };
      (prisma.client!.findFirst as jest.Mock).mockResolvedValue(mockClient);
      (prisma.ticket!.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findMe('user-1');
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('findForClient', () => {
    it('should throw ForbiddenException if non-staff user tries to access other client', async () => {
      const user = { id: 'user-1', roles: ['CLIENT'] };
      const mockClient = { id: 'client-1', userId: 'user-1' };
      (prisma.client!.findFirst as jest.Mock).mockResolvedValue(mockClient);

      await expect(service.findForClient('client-2', user)).rejects.toThrow(ForbiddenException);
    });

    it('should allow staff to access any client reports', async () => {
      const user = { id: 'staff-1', roles: ['ADMIN'] };
      (prisma.ticket!.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findForClient('client-1', user);
      expect(result).toHaveProperty('data');
    });
  });

  describe('getMrr', () => {
    it('should return MRR data', async () => {
      (prisma.subscription!.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getMrr();
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('totalMrr');
      expect(result.data).toHaveProperty('arr');
    });
  });

  describe('getUptimeSummary', () => {
    it('should return uptime summary data', async () => {
      (prisma.hostingAccount!.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getUptimeSummary(7);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('totalSites');
    });
  });

  describe('getSlaCompliance', () => {
    it('should return SLA compliance data', async () => {
      (prisma.ticket!.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSlaCompliance();
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('complianceRate');
    });
  });
});
