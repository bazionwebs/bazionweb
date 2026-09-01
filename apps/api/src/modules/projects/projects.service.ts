import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const PROJECT_INCLUDE = {
  client: { select: { businessName: true } },
  tasks: { orderBy: { sortOrder: 'asc' } as const },
  _count: { select: { tasks: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: any, filters: { page: number; limit: number }) {
    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    const where: any = { deletedAt: null };
    if (!isStaff) {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client) return { data: [], meta: { total: 0 } };
      where.clientId = client.id;
    }
    const [total, items] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({ where, include: PROJECT_INCLUDE, orderBy: { updatedAt: 'desc' }, skip: (filters.page - 1) * filters.limit, take: filters.limit }),
    ]);
    return { data: items, meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) } };
  }

  async findMe(userId: string) {
    const client = await this.prisma.client.findFirst({ where: { userId } });
    if (!client) throw new NotFoundException('Client not found');
    const projects = await this.prisma.project.findMany({ where: { clientId: client.id, deletedAt: null }, include: PROJECT_INCLUDE, orderBy: { updatedAt: 'desc' } });
    return { data: projects };
  }

  async findOne(id: string, user: any) {
    const project = await this.prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
    if (!project || project.deletedAt) throw new NotFoundException('Project not found');
    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    if (!isStaff) {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client || project.clientId !== client.id) throw new ForbiddenException('Access denied');
    }
    return { data: project };
  }

  async create(dto: any) {
    const project = await this.prisma.project.create({ data: dto, include: PROJECT_INCLUDE });
    return { data: project };
  }

  async update(id: string, dto: any) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    const updated = await this.prisma.project.update({ where: { id }, data: dto, include: PROJECT_INCLUDE });
    return { data: updated };
  }
}
