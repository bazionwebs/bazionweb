import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const STAFF_ROLES = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'];

/**
 * Server-side entitlement gate for client service endpoints.
 *
 * The web AuthGuard is a UX helper only — it can be bypassed by editing
 * sessionStorage. This guard is the authority: a CLIENT principal must own a
 * client record that is ACTIVE or have a live ACTIVE/TRIAL subscription.
 *
 * Guest identities created by pay-first checkout are deliberately TRIAL with
 * no subscription until the payment webhook activates them, so they cannot
 * use the portal before paying.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    const isStaff = STAFF_ROLES.some(role => user.roles?.includes(role));
    if (isStaff) return true;

    const now = new Date();
    const client = await this.prisma.client.findUnique({
      where: { userId: user.id },
      select: {
        status: true,
        deletedAt: true,
        subscriptions: {
          where: {
            status: { in: ['ACTIVE', 'TRIAL'] },
            OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    const entitled =
      !client?.deletedAt &&
      (client?.status === 'ACTIVE' || (client?.subscriptions?.length ?? 0) > 0);

    if (!entitled) {
      throw new ForbiddenException(
        'An active subscription is required to use this workspace. Complete payment first.',
      );
    }

    return true;
  }
}
