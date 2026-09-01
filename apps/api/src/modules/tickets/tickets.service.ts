import {
  Injectable, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { TicketPriority } from '@prisma/client';

// P1–P4 response windows in minutes, matching plan SLAs (MPD Section 5.2)
const SLA_MINUTES: Record<string, Record<TicketPriority, number>> = {
  STARTER:    { P1: 60,  P2: 240,  P3: 1440, P4: 2880 },
  GROWTH:     { P1: 30,  P2: 120,  P3: 240,  P4: 1440 },
  BUSINESS:   { P1: 15,  P2: 60,   P3: 240,  P4: 720  },
  ENTERPRISE: { P1: 5,   P2: 30,   P3: 120,  P4: 480  },
};

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateTicketDto, user: any) {
    // Resolve clientId from authenticated user
    const client = await this.prisma.client.findFirst({
      where: { userId: user.id, deletedAt: null },
      include: { plan: true },
    });
    if (!client) throw new ForbiddenException('No active client account found');

    const ticket = await this.prisma.ticket.create({
      data: {
        clientId: client.id,
        subject: dto.subject,
        priority: dto.priority,
        category: dto.category,
        status: 'OPEN',
      },
      include: { client: { include: { plan: true } }, assignee: true },
    });

    this.events.emit('ticket.created', { ticket, client });
    this.logger.log(`Ticket ${ticket.id} created — ${ticket.priority} by ${client.businessName}`);

    return { data: ticket };
  }

  async findAll(user: any, filters: {
    scope?: string; status?: string; priority?: string; page: number; limit: number;
  }) {
    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    const where: any = { deletedAt: undefined };

    if (!isStaff || filters.scope === 'mine') {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client) return { data: [], meta: { page: 1, limit: filters.limit, total: 0, totalPages: 0 } };
      where.clientId = client.id;
    }

    if (filters.status) where.status = filters.status.toUpperCase();
    if (filters.priority) where.priority = filters.priority.toUpperCase();

    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: {
          client: { select: { businessName: true } },
          assignee: { select: { firstName: true, lastName: true } },
          _count: { select: { comments: true } },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: items,
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findOne(id: string, user: any) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        client: { include: { plan: true } },
        assignee: { select: { firstName: true, lastName: true, email: true } },
        comments: {
          where: { isInternal: false },
          include: { author: { select: { firstName: true, lastName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertAccessible(ticket, user);

    return { data: ticket };
  }

  async update(id: string, dto: UpdateTicketDto, user: any) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const data: any = { ...dto };
    if (dto.status === 'RESOLVED' && !ticket.resolvedAt) {
      data.resolvedAt = new Date();
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data,
      include: { client: { select: { businessName: true } }, assignee: true },
    });

    this.events.emit('ticket.updated', { ticket: updated, updatedBy: user, changes: dto });

    return { data: updated };
  }

  async addComment(id: string, dto: AddCommentDto, user: any) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertAccessible(ticket, user);

    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));

    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId: id,
        authorId: user.id,
        body: dto.body,
        isInternal: isStaff && (dto.isInternal ?? false),
      },
      include: { author: { select: { firstName: true, lastName: true, role: true } } },
    });

    // Auto-update status to IN_PROGRESS when staff first replies
    if (isStaff && ticket.status === 'OPEN') {
      await this.prisma.ticket.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return { data: comment };
  }

  async getComments(id: string, user: any) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertAccessible(ticket, user);

    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));

    const comments = await this.prisma.ticketComment.findMany({
      where: {
        ticketId: id,
        ...(isStaff ? {} : { isInternal: false }),
      },
      include: {
        author: { select: { firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { data: comments };
  }

  private assertAccessible(ticket: any, user: any) {
    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    if (!isStaff && ticket.client?.userId !== user.id) {
      throw new ForbiddenException('Access denied to this ticket');
    }
  }
}
