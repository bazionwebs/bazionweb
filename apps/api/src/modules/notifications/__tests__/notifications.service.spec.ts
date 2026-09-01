import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      client: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('create', () => {
    it('should create and push a notification', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
        type: 'TICKET_UPDATE',
        title: 'Test',
        message: 'Test message',
        createdAt: new Date(),
      };
      (prisma.notification!.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.create({
        userId: 'user-1',
        type: 'TICKET_UPDATE',
        title: 'Test',
        message: 'Test message',
      });

      expect(result).toEqual(mockNotification);
      expect(prisma.notification!.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      (prisma.notification!.count as jest.Mock).mockResolvedValue(5);
      (prisma.notification!.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll('user-1', { page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(5);
    });
  });

  describe('markRead', () => {
    it('should throw NotFoundException if notification not found', async () => {
      (prisma.notification!.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.markRead('notif-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      (prisma.notification!.findUnique as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        userId: 'user-2',
      });

      await expect(service.markRead('notif-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should mark notification as read', async () => {
      const mockNotif = { id: 'notif-1', userId: 'user-1', read: false };
      const mockUpdated = { ...mockNotif, read: true };
      (prisma.notification!.findUnique as jest.Mock).mockResolvedValue(mockNotif);
      (prisma.notification!.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await service.markRead('notif-1', 'user-1');

      expect(result.data.read).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('should mark all unread notifications as read', async () => {
      (prisma.notification!.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const result = await service.markAllRead('user-1');

      expect(result.data.updated).toBe(3);
    });
  });
});
