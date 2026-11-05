import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const CLIENT_INCLUDE = {
  plan: true,
  subscriptions: {
    where: { status: 'ACTIVE' },
    include: { plan: true },
    take: 1,
    orderBy: { createdAt: 'desc' } as const,
  },
  _count: { select: { tickets: true, projects: true, hostingAccounts: true } },
} as const;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
    const existing = await this.prisma.client.findFirst({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A client with this email already exists');

    const plan = await this.prisma.plan
      .findFirstOrThrow({ where: { tier: dto.planTier as any, isActive: true } })
      .catch(() =>
        this.prisma.plan.findFirstOrThrow({
          where: { isActive: true },
          orderBy: { priceMonthly: 'asc' },
        }),
      );

    const client = await this.prisma.client.create({
      data: {
        businessName: dto.businessName,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        country: dto.country ?? null,
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

  /**
   * Client: mark the guided portal onboarding as complete. Idempotent — the
   * first completion timestamp is preserved on repeat calls.
   */
  async markOnboarded(userId: string, completedSteps?: string[]) {
    const validStepKeys = new Set(['profile', 'domain', 'vault', 'roadmap']);
    const sanitizedSteps = Array.isArray(completedSteps)
      ? Array.from(new Set(completedSteps.filter((s) => typeof s === 'string' && validStepKeys.has(s))))
      : Array.from(validStepKeys);

    const client = await this.prisma.client.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, onboardedAt: true },
    });
    if (!client) throw new NotFoundException('Client account not found');
    if (client.onboardedAt) {
      return {
        success: true,
        onboardedAt: client.onboardedAt.toISOString(),
        completedSteps: sanitizedSteps,
      };
    }
    const updated = await this.prisma.client.update({
      where: { id: client.id },
      data: { onboardedAt: new Date() },
      select: { onboardedAt: true },
    });
    return {
      success: true,
      onboardedAt: updated.onboardedAt!.toISOString(),
      completedSteps: sanitizedSteps,
    };
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

    const normalizeNullable = (v: string | undefined) =>
      v === undefined ? undefined : v.trim() === '' ? null : v.trim();

    const data: Record<string, any> = {};
    if (dto.businessName !== undefined && dto.businessName.trim()) {
      data.businessName = dto.businessName.trim();
    }
    if (dto.contactName !== undefined && dto.contactName.trim()) {
      data.contactName = dto.contactName.trim();
    }
    if (dto.phone !== undefined) data.phone = normalizeNullable(dto.phone);
    if (dto.address !== undefined) data.address = normalizeNullable(dto.address);
    if (dto.country !== undefined) data.country = normalizeNullable(dto.country);
    if (dto.taxPin !== undefined) data.taxPin = normalizeNullable(dto.taxPin);
    if (dto.status) data.status = dto.status as any;
    if (dto.planTier) {
      const plan = await this.prisma.plan
        .findFirst({ where: { tier: dto.planTier as any, isActive: true } })
        .catch(() => null);
      if (plan) data.plan = { connect: { id: plan.id } };
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data,
      include: CLIENT_INCLUDE,
    });

    // Keep linked User identity fields synchronized with Client contact details
    const userPatch: Record<string, any> = {};
    if (data.contactName) {
      const parts = String(data.contactName).split(/\s+/);
      userPatch.firstName = parts[0] || null;
      userPatch.lastName = parts.slice(1).join(' ') || null;
    }
    if (dto.phone !== undefined) {
      userPatch.phone = data.phone;
    }
    if (Object.keys(userPatch).length > 0 && client.userId) {
      await this.prisma.user
        .update({ where: { id: client.userId }, data: userPatch })
        .catch(() => undefined);
    }

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
