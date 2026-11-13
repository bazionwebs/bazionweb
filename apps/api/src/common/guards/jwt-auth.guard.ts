import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Optional,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import jwksClient from 'jwks-rsa';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertSandboxReadOnly,
  createKeycloakJwksClient,
  extractBearerToken,
  hasSandboxClaims,
  verifyBearerTokenForRequest,
} from './sandbox-readonly.guard';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata('isPublic', true);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof jwksClient>;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    this.jwks = createKeycloakJwksClient(config);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      // Optional authentication: populate request.user if Bearer token is provided
      const token = this.extractToken(request);
      if (token) {
        try {
          const decoded = await this.verifyToken(token);
          (request as any).rawJwtPayload = decoded;
          request.user = await this.buildUserFromClaims(decoded, { allowUnlinkedOidc: true });
        } catch {
          // Optional bearer token verification error is safely ignored on public endpoints
        }
      }
      assertSandboxReadOnly(request, context, this.reflector);
      return true;
    }

    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing authentication token');

    let decoded: any;
    try {
      decoded = await this.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    (request as any).rawJwtPayload = decoded;
    request.user = await this.buildUserFromClaims(decoded, { allowUnlinkedOidc: false });

    assertSandboxReadOnly(request, context, this.reflector);

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles?.length) {
      const userRoles: string[] = request.user.roles ?? [];
      if (!requiredRoles.some(r => userRoles.includes(r))) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }

  private async buildUserFromClaims(
    decoded: any,
    options: { allowUnlinkedOidc: boolean },
  ) {
    const baseUser =
      decoded.iss === 'bazionweb' || decoded.iss === 'bazionweb-bff'
        ? this.mapLocalUser(decoded)
        : this.mapKeycloakUser(decoded);

    const oidcIssRaw =
      typeof decoded?.oidcIss === 'string' && decoded.oidcIss.trim()
        ? decoded.oidcIss
        : decoded?.iss && decoded.iss !== 'bazionweb' && decoded.iss !== 'bazionweb-bff'
          ? decoded.iss
          : undefined;
    const oidcSubRaw =
      typeof decoded?.oidcSub === 'string' && decoded.oidcSub.trim()
        ? decoded.oidcSub
        : oidcIssRaw
          ? decoded?.sub
          : undefined;

    const oidcIss = typeof oidcIssRaw === 'string' ? oidcIssRaw.trim().replace(/\/+$/, '') : '';
    const oidcSub = typeof oidcSubRaw === 'string' ? oidcSubRaw.trim() : '';

    if (oidcIss && oidcSub && this.prisma && (this.prisma as any).oidcIdentityLink) {
      const link = await (this.prisma as any).oidcIdentityLink.findUnique({
        where: { issuer_subject: { issuer: oidcIss, subject: oidcSub } },
        include: {
          user: { include: { client: true } },
          client: true,
        },
      });

      if (!link || link.revokedAt || (link.user && link.user.deletedAt)) {
        if (options.allowUnlinkedOidc) {
          return {
            ...baseUser,
            oidcIss,
            oidcSub,
            claimRequired: true,
          };
        }
        throw new ForbiddenException({
          code: 'OIDC_ACCOUNT_CLAIM_REQUIRED',
          message:
            'OIDC identity is not linked to a Bazionweb customer record. Complete account claim first.',
        });
      }

      return {
        ...baseUser,
        id: link.userId,
        sub: link.userId,
        email: link.user?.email ?? baseUser.email,
        clientId: link.clientId ?? link.client?.id ?? link.user?.client?.id ?? baseUser.clientId,
        oidcIss,
        oidcSub,
        claimRequired: false,
      };
    }

    return baseUser;
  }

  private extractToken(request: any): string | null {
    return extractBearerToken(request);
  }

  private verifyToken(token: string): Promise<any> {
    return verifyBearerTokenForRequest(token, this.config, this.jwks);
  }

  private mapLocalUser(decoded: any) {
    return {
      id: decoded.sub,
      email: decoded.email,
      firstName: decoded.given_name,
      lastName: decoded.family_name,
      roles: decoded.realm_access?.roles ?? [],
      keycloakId: undefined,
      clientId: decoded.clientId,
      clientBusinessName: decoded.clientBusinessName,
      oidcIss: decoded.oidcIss,
      oidcSub: decoded.oidcSub,
      impersonatedBy: decoded.impersonatedBy,
      isSandbox: hasSandboxClaims(decoded),
    };
  }

  private mapKeycloakUser(decoded: any) {
    return {
      id: decoded.sub,
      email: decoded.email,
      firstName: decoded.given_name,
      lastName: decoded.family_name,
      roles: decoded.realm_access?.roles ?? [],
      keycloakId: decoded.sub,
      clientId: decoded.clientId,
      impersonatedBy: decoded.impersonatedBy,
      isSandbox: hasSandboxClaims(decoded),
    };
  }
}
