import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { TicketPriority, TicketStatus } from '@prisma/client';

// P1–P4 response windows in minutes, matching plan SLAs (MPD Section 5.2)
export const SLA_MINUTES: Record<string, Record<TicketPriority, number>> = {
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

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          clientId: client.id,
          subject: dto.subject.trim(),
          priority: dto.priority,
          category: dto.category,
          status: 'OPEN',
        },
      });

      if (dto.body?.trim()) {
        await tx.ticketComment.create({
          data: {
            ticketId: created.id,
            authorId: user.id,
            body: dto.body.trim(),
            isInternal: false,
          },
        });
      }

      return tx.ticket.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          client: { include: { plan: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
          comments: {
            where: { isInternal: false },
            include: { author: { select: { firstName: true, lastName: true, role: true } } },
            orderBy: { createdAt: 'asc' },
          },
          _count: { select: { comments: true } },
        },
      });
    });

    this.events.emit('ticket.created', { ticket, client });
    this.logger.log(`Ticket ${ticket.id} created — ${ticket.priority} by ${client.businessName}`);

    return { data: ticket };
  }

  async findAll(user: any, filters: {
    scope?: string; status?: string; priority?: string; page: number; limit: number;
  }) {
    const page = Math.max(1, Math.floor(Number(filters.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(filters.limit) || 20)));
    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    const where: any = { deletedAt: undefined };

    if (!isStaff || filters.scope === 'mine') {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client) return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      where.clientId = client.id;
    }

    if (filters.status) {
      const normalizedStatus = filters.status.toUpperCase();
      if (!Object.values(TicketStatus).includes(normalizedStatus as TicketStatus)) {
        throw new BadRequestException(`Invalid ticket status filter: ${filters.status}`);
      }
      where.status = normalizedStatus;
    }
    if (filters.priority) {
      const normalizedPriority = filters.priority.toUpperCase();
      if (!Object.values(TicketPriority).includes(normalizedPriority as TicketPriority)) {
        throw new BadRequestException(`Invalid ticket priority filter: ${filters.priority}`);
      }
      where.priority = normalizedPriority;
    }

    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: {
          client: { select: { businessName: true } },
          assignee: { select: { firstName: true, lastName: true } },
          comments: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { id: true, body: true, createdAt: true },
          },
          _count: { select: { comments: true } },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
      include: {
        client: { select: { businessName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
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

    // Auto-update status when staff first replies or when client answers PENDING_CLIENT
    if (isStaff && ticket.status === 'OPEN') {
      await this.prisma.ticket.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
    } else if (!isStaff && ticket.status === 'PENDING_CLIENT') {
      await this.prisma.ticket.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    if (isStaff && !comment.isInternal) {
      this.events.emit('ticket.commented', { ticket, comment });
    }

    return { data: comment };
  }

  async getComments(id: string, user: any) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { client: true },
    });
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
