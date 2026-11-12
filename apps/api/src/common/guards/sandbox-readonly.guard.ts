import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { PrismaService } from '../../prisma/prisma.service';

export const ALLOW_SANDBOX_MUTATION_KEY = 'allowSandboxMutation';
export const AllowSandboxMutation = () => SetMetadata(ALLOW_SANDBOX_MUTATION_KEY, true);

export const SANDBOX_READONLY_MESSAGE =
  'Sandbox impersonation sessions are read-only; mutations are prohibited.';

const MUTATING_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function headerFlagIsTrue(raw: unknown): boolean {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string') return false;
  const normalized = first.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

export function isMutatingHttpMethod(method: string | undefined | null): boolean {
  return MUTATING_HTTP_METHODS.has(String(method ?? 'GET').toUpperCase());
}

export function hasSandboxHeader(request: any): boolean {
  const headers = request?.headers;
  if (!headers || typeof headers !== 'object') return false;
  return (
    headerFlagIsTrue(headers['x-bazion-sandbox']) ||
    headerFlagIsTrue(headers['x-bazion-impersonating'])
  );
}

export function hasSandboxClaims(claimsOrUser: any): boolean {
  if (!claimsOrUser || typeof claimsOrUser !== 'object') return false;
  return Boolean(
    claimsOrUser.isSandbox === true ||
      claimsOrUser.is_sandbox === true ||
      claimsOrUser.impersonating === true ||
      claimsOrUser.impersonatedBy,
  );
}

export function extractBearerToken(request: any): string | null {
  const auth = request?.headers?.authorization;
  return typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

export function createKeycloakJwksClient(config: ConfigService): ReturnType<typeof jwksClient> {
  return jwksClient({
    jwksUri: `${config.get('KEYCLOAK_URL')}/realms/${config.get('KEYCLOAK_REALM')}/protocol/openid-connect/certs`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600_000,
  });
}

export function verifyBearerTokenForRequest(
  token: string,
  config: ConfigService,
  jwks?: ReturnType<typeof jwksClient>,
): Promise<any> {
  // Local BazionWeb tokens (HS256) first; Keycloak RS256 only when configured.
  const unverified = jwt.decode(token) as { iss?: string } | null;
  if (unverified?.iss === 'bazionweb') {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        config.get<string>('JWT_SECRET') ?? '',
        { algorithms: ['HS256'], issuer: 'bazionweb' },
        (err, decoded) => (err ? reject(err) : resolve(decoded)),
      );
    });
  }

  const keycloakUrl = config.get<string>('KEYCLOAK_URL');
  if (!keycloakUrl || !jwks) {
    return Promise.reject(new Error('No local issuer and Keycloak is not configured'));
  }
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        jwks.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err as Error);
          callback(null, key?.getPublicKey());
        });
      },
      {
        algorithms: ['RS256'],
        issuer: `${keycloakUrl}/realms/${config.get('KEYCLOAK_REALM')}`,
      },
      (err, decoded) => (err ? reject(err) : resolve(decoded)),
    );
  });
}

export function assertSandboxReadOnly(
  request: any,
  context: ExecutionContext,
  reflector: Reflector,
): void {
  if (!isMutatingHttpMethod(request?.method)) return;

  const allowSandboxMutation = reflector.getAllAndOverride<boolean>(
    ALLOW_SANDBOX_MUTATION_KEY,
    [context.getHandler(), context.getClass()],
  );
  if (allowSandboxMutation) return;

  if (
    hasSandboxHeader(request) ||
    hasSandboxClaims(request?.user) ||
    hasSandboxClaims(request?.rawJwtPayload)
  ) {
    throw new ForbiddenException(SANDBOX_READONLY_MESSAGE);
  }
}

/**
 * Global guard ensuring support impersonation / sandbox sessions and x-bazion-sandbox requests
 * remain strictly read-only across every mutating HTTP endpoint unless explicitly opted out
 * (e.g. logout).
 */
@Injectable()
export class SandboxReadOnlyGuard implements CanActivate {
  private readonly jwks?: ReturnType<typeof jwksClient>;

  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    if (this.config?.get<string>('KEYCLOAK_URL')) {
      this.jwks = createKeycloakJwksClient(this.config);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!isMutatingHttpMethod(request?.method)) return true;

    const allowSandboxMutation = this.reflector.getAllAndOverride<boolean>(
      ALLOW_SANDBOX_MUTATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowSandboxMutation) return true;

    let decodedClaims = request?.rawJwtPayload;
    if (!hasSandboxClaims(request?.user) && !hasSandboxClaims(decodedClaims) && this.config) {
      const token = extractBearerToken(request);
      if (token) {
        try {
          decodedClaims = await verifyBearerTokenForRequest(token, this.config, this.jwks);
        } catch {
          // Invalid or unauthenticated bearer tokens are left for route-level JwtAuthGuard.
        }
      }
    }

    if (
      hasSandboxHeader(request) ||
      hasSandboxClaims(request?.user) ||
      hasSandboxClaims(decodedClaims)
    ) {
      await this.recordBlockedMutation(request, decodedClaims);
      throw new ForbiddenException(SANDBOX_READONLY_MESSAGE);
    }

    return true;
  }

  private async recordBlockedMutation(request: any, decodedClaims: any): Promise<void> {
    const createAudit = this.prisma?.auditLog?.create;
    if (typeof createAudit !== 'function') return;
    const rawUrl = String(request?.url ?? '');
    const path = rawUrl.split('?')[0] ?? rawUrl;
    const ip = Array.isArray(request?.ip) ? request.ip[0] : request?.ip;
    await createAudit({
      data: {
        userId: request?.user?.id ?? decodedClaims?.sub ?? null,
        action: 'sandbox.mutation_blocked',
        resourceType: 'sandbox_guard',
        resourceId: null,
        newValue: {
          method: String(request?.method ?? '').toUpperCase(),
          path,
          impersonatedBy: request?.user?.impersonatedBy ?? decodedClaims?.impersonatedBy ?? null,
          sandboxHeader: hasSandboxHeader(request),
        },
        ipAddress: ip ?? null,
        userAgent: request?.headers?.['user-agent'] ?? null,
      },
    }).catch(() => undefined);
  }
}
