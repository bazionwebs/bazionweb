import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ManualProvisionClientDto } from './dto/manual-provision-client.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

    // Clients can't change their own plan, status, or login email
    if (!isStaff) {
      delete (dto as any).status;
      delete (dto as any).planTier;
      delete (dto as any).email;
    }

    const normalizeNullable = (v: string | null | undefined) =>
      v == null ? null : typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : null;

    const data: Record<string, any> = {};
    const userPatch: Record<string, any> = {};

    if (dto.email !== undefined && dto.email && typeof dto.email === 'string' && dto.email.trim()) {
      const cleanEmail = dto.email.trim().toLowerCase();
      if (cleanEmail !== client.email) {
        if (!isStaff) throw new ForbiddenException('Only administrators can update account email addresses');
        const [conflictClient, conflictUser] = await Promise.all([
          this.prisma.client.findFirst({ where: { email: cleanEmail, id: { not: id } } }),
          this.prisma.user.findFirst({ where: { email: cleanEmail, id: { not: client.userId } } }),
        ]);
        if (conflictClient || conflictUser) {
          throw new ConflictException('This email address is already in use by another account');
        }
        data.email = cleanEmail;
        userPatch.email = cleanEmail;
      }
    }

    if (dto.businessName !== undefined && dto.businessName && typeof dto.businessName === 'string' && dto.businessName.trim()) {
      data.businessName = dto.businessName.trim();
    }
    if (dto.contactName !== undefined && dto.contactName && typeof dto.contactName === 'string' && dto.contactName.trim()) {
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
      if (plan) {
        data.plan = { connect: { id: plan.id } };
        // Sync active subscriptions to the new plan to prevent SSOT billing drift
        await this.prisma.subscription.updateMany({
          where: { clientId: id, status: 'ACTIVE' },
          data: { planId: plan.id },
        }).catch(() => undefined);
      }
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data,
      include: CLIENT_INCLUDE,
    });

    // Keep linked User identity fields synchronized with Client contact details
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

    if (this.prisma.auditLog) {
      await this.prisma.auditLog.create({
        data: {
          userId: user?.id || null,
          action: 'client.update',
          resourceType: 'Client',
          resourceId: id,
          newValue: {
            updatedFields: Object.keys(data),
            changes: data,
            updatedBy: user?.email || user?.id || 'admin',
          },
        },
      }).catch(() => undefined);
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

  /**
   * Admin: Atomically provision client account, user auth record, initial project,
   * active subscription, and a 72-hour cryptographic claim token.
   */
  async manualProvision(dto: ManualProvisionClientDto, staffUser?: any) {
    const cleanEmail = dto.email.trim().toLowerCase();

    const [existingClient, existingUser] = await Promise.all([
      this.prisma.client.findFirst({ where: { email: cleanEmail } }),
      this.prisma.user.findUnique({ where: { email: cleanEmail } }),
    ]);

    if (existingClient || existingUser) {
      throw new ConflictException('A user or client account with this email address already exists');
    }

    // Resolve plan: either specific planId, planTier, or default first active plan
    let plan = null;
    if (dto.planId) {
      plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } }).catch(() => null);
    }
    if (!plan && dto.planTier) {
      plan = await this.prisma.plan.findFirst({
        where: { tier: dto.planTier as any, isActive: true },
      }).catch(() => null);
    }
    if (!plan) {
      plan = await this.prisma.plan.findFirst({
        where: { isActive: true },
        orderBy: { priceMonthly: 'asc' },
      });
    }
    if (!plan) {
      throw new BadRequestException('No active service plan available for client assignment');
    }

    const nameParts = dto.contactName.trim().split(/\s+/);
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(' ') || null;

    // Cryptographic 72-hour single-use claim token
    const rawClaimToken = `claim_${randomBytes(32).toString('base64url')}`;
    const tokenHash = createHash('sha256').update(rawClaimToken).digest('hex');
    const claimExpiresAt = new Date(Date.now() + 72 * 3600_000); // 72 hours

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create client User account (unclaimed, passwordHash null)
      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          role: 'CLIENT',
          passwordHash: null,
          firstName,
          lastName,
          phone: dto.phone || null,
          keycloakId: `manual-${Date.now()}`,
        },
      });

      // 2. Create Client organization record
      const client = await tx.client.create({
        data: {
          userId: user.id,
          businessName: dto.businessName.trim(),
          contactName: dto.contactName.trim(),
          email: cleanEmail,
          phone: dto.phone || null,
          country: dto.country || dto.marketCode || 'KE',
          planId: plan.id,
          status: 'ACTIVE',
        },
        include: CLIENT_INCLUDE,
      });

      // 3. Create initial Project workspace
      const initialProjectName =
        dto.projectTitle?.trim() || `${dto.businessName.trim()} Launch Project`;
      const project = await tx.project.create({
        data: {
          clientId: client.id,
          name: initialProjectName,
          description: `Initial workspace project provisioned via administrative onboarding.`,
          status: 'PLANNING',
          completionPct: 0,
        },
      });

      // 4. Create active initial subscription
      const subscription = await tx.subscription.create({
        data: {
          clientId: client.id,
          planId: plan.id,
          billingCycle: 'MONTHLY',
          status: 'ACTIVE',
          provider: 'INTASEND',
          startDate: new Date(),
          renewalDate: new Date(Date.now() + 30 * 86_400_000),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
          notes: 'Manually provisioned by administrator',
        },
      });

      // 5. Store hashed claim token in RefreshToken table
      await tx.refreshToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt: claimExpiresAt,
        },
      });

      // 6. Log audit event
      await tx.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: 'client.manual_provision',
          resourceType: 'Client',
          resourceId: client.id,
          newValue: {
            businessName: client.businessName,
            email: client.email,
            plan: plan.name,
            projectId: project.id,
            subscriptionId: subscription.id,
            provisionedBy: staffUser?.email || staffUser?.id || 'admin',
          },
        },
      });

      return { client, user, project };
    });

    const webBaseUrl = (
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.config.get<string>('APP_URL') ||
      (process.env.NODE_ENV === 'production' ? 'https://bazionweb.com' : 'http://localhost:3000')
    ).replace(/\/$/, '');
    const claimUrl = `${webBaseUrl}/portal/claim?token=${rawClaimToken}&email=${encodeURIComponent(cleanEmail)}`;

    return {
      client: result.client,
      user: result.user,
      project: result.project,
      invitationToken: rawClaimToken,
      claimUrl,
      expiresIn: 72 * 3600,
    };
  }

  /**
   * Admin: Generate a fresh 72-hour claim token for an unclaimed client account.
   */
  async resendInvite(id: string, staffUser?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!client || client.deletedAt) throw new NotFoundException('Client not found');
    if (!client.user) throw new NotFoundException('Client has no linked user account');

    if (client.user.passwordHash) {
      throw new BadRequestException('Client account has already claimed credentials and set a password');
    }

    // Revoke prior active claim tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId: client.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Mint fresh 72-hour token
    const rawClaimToken = `claim_${randomBytes(32).toString('base64url')}`;
    const tokenHash = createHash('sha256').update(rawClaimToken).digest('hex');
    const claimExpiresAt = new Date(Date.now() + 72 * 3600_000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: client.user.id,
        expiresAt: claimExpiresAt,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: staffUser?.id || null,
        action: 'client.resend_invite',
        resourceType: 'Client',
        resourceId: client.id,
        newValue: { targetEmail: client.email, reissuedBy: staffUser?.email || staffUser?.id },
      },
    }).catch(() => undefined);

    const webBaseUrl = (
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.config.get<string>('APP_URL') ||
      (process.env.NODE_ENV === 'production' ? 'https://bazionweb.com' : 'http://localhost:3000')
    ).replace(/\/$/, '');
    const claimUrl = `${webBaseUrl}/portal/claim?token=${rawClaimToken}&email=${encodeURIComponent(client.email)}`;

    return {
      success: true,
      invitationToken: rawClaimToken,
      claimUrl,
      recipientEmail: client.email,
      contactName: client.contactName || client.businessName,
      expiresIn: 72 * 3600,
    };
  }

  /**
   * Admin: Synchronize and repair onboarding state for a client workspace
   * (ensures linked user, initial project, active subscription, and active client standing).
   */
  async syncOnboarding(id: string, staffUser?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        user: true,
        projects: { where: { deletedAt: null } },
        subscriptions: { where: { status: 'ACTIVE' } },
        plan: true,
      },
    });
    if (!client || client.deletedAt) throw new NotFoundException('Client not found');

    const repairedItems: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      // 1. Repair client status
      if (client.status !== 'ACTIVE') {
        await tx.client.update({
          where: { id: client.id },
          data: { status: 'ACTIVE' },
        });
        repairedItems.push(`Client status normalized from ${client.status} to ACTIVE`);
      }

      // 2. Repair missing User
      let userId = client.userId;
      if (!client.user) {
        const parts = client.contactName.split(/\s+/);
        const newUser = await tx.user.create({
          data: {
            email: client.email,
            role: 'CLIENT',
            firstName: parts[0] || null,
            lastName: parts.slice(1).join(' ') || null,
            phone: client.phone,
            keycloakId: `sync-${Date.now()}`,
          },
        });
        await tx.client.update({
          where: { id: client.id },
          data: { userId: newUser.id },
        });
        userId = newUser.id;
        repairedItems.push('Recreated missing linked User auth identity');
      }

      // 3. Repair missing initial Project
      if (client.projects.length === 0) {
        await tx.project.create({
          data: {
            clientId: client.id,
            name: `${client.businessName} Launch Project`,
            description: 'Workspace project auto-synchronized during operational sync.',
            status: 'PLANNING',
          },
        });
        repairedItems.push('Provisioned initial Launch Project');
      }

      // 4. Repair missing active Subscription
      if (client.subscriptions.length === 0) {
        const plan = client.plan || (await tx.plan.findFirst({ where: { isActive: true } }));
        if (plan) {
          await tx.subscription.create({
            data: {
              clientId: client.id,
              planId: plan.id,
              status: 'ACTIVE',
              billingCycle: 'MONTHLY',
              startDate: new Date(),
              renewalDate: new Date(Date.now() + 30 * 86_400_000),
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
            },
          });
          repairedItems.push('Provisioned missing active Subscription');
        }
      }

      await tx.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: 'client.sync_onboarding',
          resourceType: 'Client',
          resourceId: client.id,
          newValue: { repairedItems, syncedBy: staffUser?.email || staffUser?.id },
        },
      });
    });

    return {
      success: true,
      clientId: client.id,
      repairedItems: repairedItems.length > 0 ? repairedItems : ['Workspace state was already synchronized'],
      status: 'ACTIVE',
    };
  }
}
