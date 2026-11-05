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
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

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
    this.jwks = jwksClient({
      jwksUri: `${config.get('KEYCLOAK_URL')}/realms/${config.get('KEYCLOAK_REALM')}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600_000,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
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
    const auth = request.headers?.authorization;
    return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  }

  private verifyToken(token: string): Promise<any> {
    // Local BazionWeb tokens (HS256) first; Keycloak RS256 only when configured.
    const unverified = jwt.decode(token) as { iss?: string } | null;
    if (unverified?.iss === 'bazionweb') {
      return new Promise((resolve, reject) => {
        jwt.verify(
          token,
          this.config.get<string>('JWT_SECRET') ?? '',
          { algorithms: ['HS256'], issuer: 'bazionweb' },
          (err, decoded) => (err ? reject(err) : resolve(decoded)),
        );
      });
    }

    const keycloakUrl = this.config.get<string>('KEYCLOAK_URL');
    if (!keycloakUrl) {
      return Promise.reject(new Error('No local issuer and Keycloak is not configured'));
    }
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          this.jwks.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err as Error);
            callback(null, key?.getPublicKey());
          });
        },
        {
          algorithms: ['RS256'],
          issuer: `${this.config.get('KEYCLOAK_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}`,
        },
        (err, decoded) => (err ? reject(err) : resolve(decoded)),
      );
    });
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
      isSandbox: Boolean(decoded.isSandbox || decoded.impersonatedBy),
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
    };
  }
}
