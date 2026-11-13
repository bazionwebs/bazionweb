import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubscriptionsController } from '../billing.controller';

describe('SubscriptionsController', () => {
  const subId = '11111111-1111-4111-8111-111111111111';

  let mockPrisma: {
    subscription: { findUnique: jest.Mock };
  };
  let mockDunningService: {
    cancelSubscriptionWithSync: jest.Mock;
  };
  let controller: SubscriptionsController;

  beforeEach(() => {
    mockPrisma = {
      subscription: { findUnique: jest.fn() },
    };
    mockDunningService = {
      cancelSubscriptionWithSync: jest.fn().mockResolvedValue({
        id: subId,
        status: 'CANCELLED',
      }),
    };
    controller = new SubscriptionsController(mockPrisma as any, mockDunningService as any);
  });

  it('throws NotFoundException when subscription does not exist', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(
      controller.cancelSubscription(subId, { user: { id: 'user-1', roles: ['CLIENT'] } }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects non-owner client with ForbiddenException', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: subId,
      client: { userId: 'owner-user-1' },
    });

    await expect(
      controller.cancelSubscription(subId, { user: { id: 'other-user-2', roles: ['CLIENT'] } }),
    ).rejects.toThrow(ForbiddenException);
    expect(mockDunningService.cancelSubscriptionWithSync).not.toHaveBeenCalled();
  });

  it('allows owner to cancel subscription and delegates to cancelSubscriptionWithSync', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: subId,
      client: { userId: 'owner-user-1' },
    });

    const res = await controller.cancelSubscription(
      subId,
      { user: { id: 'owner-user-1', roles: ['CLIENT'] } },
      { reasonCode: 'CUSTOMER_REQUEST' },
    );

    expect(res).toEqual({ id: subId, status: 'CANCELLED' });
    expect(mockDunningService.cancelSubscriptionWithSync).toHaveBeenCalledWith({
      subscriptionId: subId,
      reasonCode: 'CUSTOMER_REQUEST',
    });
  });

  it('allows ADMIN staff to cancel any client subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: subId,
      client: { userId: 'owner-user-1' },
    });

    await controller.cancelSubscription(
      subId,
      { user: { id: 'admin-1', roles: ['ADMIN'] } },
      { reasonCode: 'FRAUD_REVIEW' },
    );

    expect(mockDunningService.cancelSubscriptionWithSync).toHaveBeenCalledWith({
      subscriptionId: subId,
      reasonCode: 'FRAUD_REVIEW',
    });
  });
});

