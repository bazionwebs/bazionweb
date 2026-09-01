import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const CLIENT_INCLUDE = {
  plan: true,
  subscriptions: { where: { status: 'ACTIVE' }, take: 1, orderBy: { createdAt: 'desc' } as const },
  _count: { select: { tickets: true, projects: true, hostingAccounts: true } },
} as const;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
    const existing = await this.prisma.client.findFirst({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A client with this email already exists');

    const plan = await this.prisma.plan.findFirstOrThrow({ where: { tier: dto.planTier as any } });

    const client = await this.prisma.client.create({
      data: {
        businessName: dto.businessName,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        country: dto.country ?? 'KE',
        plan: { connect: { id: plan.id } },
        status: 'TRIAL',
        user: {
          create: {
            email: dto.email,
            role: 'CLIENT',
            keycloakId: `pending-${Date.now()}`, // Replaced by Keycloak webhook post-registration
          },
        },
      },
      include: CLIENT_INCLUDE,
    });

    return { data: client };
  }

  async findAll(filters: { status?: string; plan?: string; q?: string; page: number; limit: number }) {
    const where: any = { deletedAt: null };
    if (filters.status) where.status = filters.status.toUpperCase();
    if (filters.plan) where.plan = { tier: filters.plan.toUpperCase() };
    if (filters.q) {
      where.OR = [
        { businessName: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        include: CLIENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: items,
      meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  async findByUserId(userId: string) {
    const client = await this.prisma.client.findFirst({
      where: { userId, deletedAt: null },
      include: CLIENT_INCLUDE,
    });
    if (!client) throw new NotFoundException('Client account not found');
    return { data: client };
  }

  async findOne(id: string, user: any) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: CLIENT_INCLUDE,
    });
    if (!client || client.deletedAt) throw new NotFoundException('Client not found');

    const isStaff = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    if (!isStaff && client.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    return { data: client };
  }

  async update(id: string, dto: UpdateClientDto, user: any) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client || client.deletedAt) throw new NotFoundException('Client not found');

    const isStaff = ['ADMIN', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    if (!isStaff && client.userId !== user.id) throw new ForbiddenException('Access denied');

    // Clients can't change their own plan/status
    if (!isStaff) {
      delete (dto as any).status;
      delete (dto as any).planTier;
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.businessName && { businessName: dto.businessName }),
        ...(dto.contactName && { contactName: dto.contactName }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.status && { status: dto.status as any }),
      },
      include: CLIENT_INCLUDE,
    });

    return { data: updated };
  }

  async softDelete(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Client not found');

    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });

    return { data: { deleted: true, id } };
  }
}
