import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const REQUIRE_MFA_KEY = 'requireMfa';

/**
 * Decorator — apply to any controller or route that requires MFA-verified tokens.
 * Usage: @RequireMfa() on controller class or individual route handler.
 */
export const RequireMfa = () => SetMetadata(REQUIRE_MFA_KEY, true);

/**
 * MfaGuard — enforces that staff-role users have MFA enabled.
 *
 * Rules:
 *  - CLIENT role: MFA not required (opt-in via settings)
 *  - SUPPORT / ADMIN / SUPER_ADMIN: MFA required, enforced here
 *  - Checks Keycloak JWT claim `acr` (Authentication Context Reference)
 *    Value 'mfa' indicates the token was issued after MFA verification
 *  - Falls back to DB check of user.mfa_enabled flag
 */
@Injectable()
export class MfaGuard implements CanActivate {
  private readonly STAFF_ROLES = ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'];

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireMfa = this.reflector.getAllAndOverride<boolean>(REQUIRE_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user    = request.user;

    if (!user) return true; // JwtAuthGuard handles unauthenticated

    const isStaff = this.STAFF_ROLES.some(r => user.roles?.includes(r));

    // Only enforce MFA for staff roles, or when @RequireMfa() is explicitly set
    if (!isStaff && !requireMfa) return true;

    // Check Keycloak JWT `acr` claim — 'mfa' or specific LOA level
    const acrClaim = request.rawJwtPayload?.acr;
    if (acrClaim === 'mfa' || acrClaim === 'gold' || acrClaim === '2') {
      return true; // Token issued after MFA step
    }

    // Fallback: check DB flag (set during Keycloak post-login webhook)
    const dbUser = await this.prisma.user.findUnique({
      where:  { keycloakId: user.keycloakId },
      select: { mfaEnabled: true, role: true },
    });

    if (!dbUser) return true;

    // Staff without MFA enabled — block and instruct
    if (this.STAFF_ROLES.includes(dbUser.role) && !dbUser.mfaEnabled) {
      throw new ForbiddenException(
        'Multi-factor authentication is required for staff accounts. ' +
        'Please enable MFA at https://auth.bazionweb.com/realms/bazionweb/account/totp',
      );
    }

    return true;
  }
}
