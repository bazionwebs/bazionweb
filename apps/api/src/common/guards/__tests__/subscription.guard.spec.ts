import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { SubscriptionGuard } from '../subscription.guard';
import { PrismaService } from '../../../prisma/prisma.service';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let prisma: {
    client: { findUnique: jest.Mock };
  };

  const createContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any);

  beforeEach(() => {
    prisma = {
      client: {
        findUnique: jest.fn(),
      },
    };
    guard = new SubscriptionGuard(prisma as unknown as PrismaService);
  });

  it('returns false when no user is attached to the request', async () => {
    const ctx = createContext(null);
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });

  it.each(['ADMIN', 'SUPPORT', 'SUPER_ADMIN'])(
    'bypasses client entitlement checks for %s staff',
    async role => {
      const ctx = createContext({ id: 'staff-1', roles: [role] });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(prisma.client.findUnique).not.toHaveBeenCalled();
    },
  );

  it('allows an ACTIVE client without active subscriptions', async () => {
    prisma.client.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      deletedAt: null,
      subscriptions: [],
    });

    const ctx = createContext({ id: 'user-1', roles: ['CLIENT'] });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows a client with a live ACTIVE subscription', async () => {
    prisma.client.findUnique.mockResolvedValue({
      status: 'PENDING',
      deletedAt: null,
      subscriptions: [{ id: 'sub-live-1' }],
    });

    const ctx = createContext({ id: 'user-1', roles: ['CLIENT'] });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('denies a deleted client even if status was ACTIVE', async () => {
    prisma.client.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      deletedAt: new Date(),
      subscriptions: [],
    });

    const ctx = createContext({ id: 'user-1', roles: ['CLIENT'] });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('denies an unclaimed/unpaid guest without active subscriptions', async () => {
    prisma.client.findUnique.mockResolvedValue({
      status: 'TRIAL',
      deletedAt: null,
      subscriptions: [],
    });

    const ctx = createContext({ id: 'guest-1', roles: ['CLIENT'] });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'An active subscription is required to use this workspace. Complete payment first.',
    );
  });

  it('denies a user with no matching client record', async () => {
    prisma.client.findUnique.mockResolvedValue(null);

    const ctx = createContext({ id: 'unknown-1', roles: ['CLIENT'] });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
