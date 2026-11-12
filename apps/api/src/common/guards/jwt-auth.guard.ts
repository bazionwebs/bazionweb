import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import jwksClient from 'jwks-rsa';
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
          request.user = decoded.iss === 'bazionweb'
            ? this.mapLocalUser(decoded)
            : this.mapKeycloakUser(decoded);
        } catch {
          // Optional bearer token verification error is safely ignored on public endpoints
        }
      }
      assertSandboxReadOnly(request, context, this.reflector);
      return true;
    }

    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing authentication token');

    try {
      const decoded = await this.verifyToken(token);
      (request as any).rawJwtPayload = decoded;
      request.user = decoded.iss === 'bazionweb'
        ? this.mapLocalUser(decoded)
        : this.mapKeycloakUser(decoded);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

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
      impersonatedBy: decoded.impersonatedBy,
      isSandbox: hasSandboxClaims(decoded),
    };
  }
}
