import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { provisionProjectFromProposalInvoice } from './project-provisioning.util';

const PROJECT_INCLUDE = {
  client: { select: { businessName: true } },
  tasks: { orderBy: { sortOrder: 'asc' } as const },
  _count: { select: { tasks: true } },
} as const;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures any settled proposal kickoff deposit invoices for this client have
   * their corresponding Project + Milestone roadmap provisioned (idempotent).
   */
  private async ensurePaidProposalProjectsProvisioned(clientId: string) {
    const paidDeposits = await this.prisma.invoice.findMany({
      where: {
        clientId,
        status: 'PAID',
        notes: { contains: 'proposal BZ-', mode: 'insensitive' },
      },
      orderBy: { paidAt: 'asc' },
    });

    const seenCodes = new Set<string>();
    for (const inv of paidDeposits) {
      const m = /proposal\s+(BZ-[A-Z0-9-]+)/i.exec(inv.notes ?? '');
      const code = m?.[1]?.toUpperCase();
      if (!code || seenCodes.has(code)) continue;
      seenCodes.add(code);
      await provisionProjectFromProposalInvoice(this.prisma, inv).catch((err: Error) =>
        this.logger.warn(`Backfill provisioning skipped for ${code}: ${err.message}`),
      );
    }
  }

  async findAll(user: any, filters: { page: number; limit: number }) {
    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    const where: any = { deletedAt: null };
    if (!isStaff) {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client) return { data: [], meta: { total: 0 } };
      await this.ensurePaidProposalProjectsProvisioned(client.id);
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
    await this.ensurePaidProposalProjectsProvisioned(client.id);
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

  async signOffMilestone(projectId: string, taskId: string, user: any) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!project || project.deletedAt) throw new NotFoundException('Project not found');

    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    if (!isStaff) {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client || project.clientId !== client.id) throw new ForbiddenException('Access denied');
      if (project.status !== 'REVIEW') {
        throw new BadRequestException('Milestones can be signed off once placed in Client Review by engineering.');
      }
    }

    const task = project.tasks.find(t => t.id === taskId);
    if (!task) throw new NotFoundException('Milestone task not found');

    await this.prisma.projectTask.update({
      where: { id: taskId },
      data: { status: 'DONE', completedAt: new Date() },
    });

    const refreshedTasks = await this.prisma.projectTask.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
    const doneCount = refreshedTasks.filter(t => t.status === 'DONE').length;
    const totalCount = refreshedTasks.length || 1;
    const completionPct = Math.round((doneCount / totalCount) * 100);
    const nextTodo = refreshedTasks.find(t => t.status === 'TODO');

    if (nextTodo && !refreshedTasks.some(t => t.status === 'IN_PROGRESS')) {
      await this.prisma.projectTask.update({
        where: { id: nextTodo.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        completionPct,
        status: completionPct >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
        ...(completionPct >= 100 ? { completedAt: new Date() } : {}),
      },
      include: PROJECT_INCLUDE,
    });

    return { data: updated };
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
