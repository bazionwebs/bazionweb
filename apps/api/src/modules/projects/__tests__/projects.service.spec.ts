import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from '../projects.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      project: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      client: {
        findFirst: jest.fn(),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      projectTask: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb: any) => (typeof cb === 'function' ? cb(prisma) : Promise.all(cb))),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('findAll', () => {
    it('should return all projects for staff users', async () => {
      const user = { id: 'admin-1', roles: ['ADMIN'] };
      (prisma.project!.count as jest.Mock).mockResolvedValue(5);
      (prisma.project!.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll(user, { page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result.meta.total).toBe(5);
    });

    it('should return only client projects for non-staff users', async () => {
      const user = { id: 'client-1', roles: ['CLIENT'] };
      const mockClient = { id: 'client-id-1', userId: 'client-1' };
      (prisma.client!.findFirst as jest.Mock).mockResolvedValue(mockClient);
      (prisma.project!.count as jest.Mock).mockResolvedValue(2);
      (prisma.project!.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll(user, { page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
    });
  });

  describe('findMe', () => {
    it('should throw NotFoundException if client not found', async () => {
      (prisma.client!.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findMe('user-1')).rejects.toThrow(NotFoundException);
    });

    it('should return client projects', async () => {
      (prisma.client!.findFirst as jest.Mock).mockResolvedValue({ id: 'client-1', userId: 'user-1' });
      (prisma.project!.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findMe('user-1');
      expect(result).toHaveProperty('data');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if project not found', async () => {
      const user = { id: 'user-1', roles: ['CLIENT'] };
      (prisma.project!.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('proj-1', user)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-staff user tries to access other client project', async () => {
      const user = { id: 'user-1', roles: ['CLIENT'] };
      const mockProject = { id: 'proj-1', clientId: 'client-2', deletedAt: null };
      const mockClient = { id: 'client-1', userId: 'user-1' };
      (prisma.project!.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.client!.findFirst as jest.Mock).mockResolvedValue(mockClient);

      await expect(service.findOne('proj-1', user)).rejects.toThrow(ForbiddenException);
    });

    it('should return project for valid access', async () => {
      const user = { id: 'user-1', roles: ['CLIENT'] };
      const mockProject = { id: 'proj-1', clientId: 'client-1', deletedAt: null };
      const mockClient = { id: 'client-1', userId: 'user-1' };
      (prisma.project!.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.client!.findFirst as jest.Mock).mockResolvedValue(mockClient);

      const result = await service.findOne('proj-1', user);
      expect(result).toHaveProperty('data');
    });
  });

  describe('create', () => {
    it('should create a project', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      (prisma.project!.create as jest.Mock).mockResolvedValue(mockProject);

      const result = await service.create({ name: 'Test Project' });
      expect(result.data).toEqual(mockProject);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if project not found', async () => {
      (prisma.project!.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('proj-1', { name: 'Updated' })).rejects.toThrow(NotFoundException);
    });

    it('should update project', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      const mockUpdated = { ...mockProject, name: 'Updated' };
      (prisma.project!.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.project!.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await service.update('proj-1', { name: 'Updated' });
      expect(result.data.name).toBe('Updated');
    });
  });
});
