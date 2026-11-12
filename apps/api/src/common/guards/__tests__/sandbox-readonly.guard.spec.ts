import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from '../jwt-auth.guard';
import {
  ALLOW_SANDBOX_MUTATION_KEY,
  SandboxReadOnlyGuard,
  SANDBOX_READONLY_MESSAGE,
} from '../sandbox-readonly.guard';
import { SubscriptionGuard } from '../subscription.guard';

const JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';

function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  const values: Record<string, string | undefined> = {
    JWT_SECRET,
    KEYCLOAK_URL: undefined,
    KEYCLOAK_REALM: 'bazion',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function makeContext(options: {
  method: string;
  url?: string;
  headers?: Record<string, string>;
  user?: Record<string, any>;
  isPublic?: boolean;
  allowSandboxMutation?: boolean;
}): {
  context: ExecutionContext;
  request: any;
  reflector: Reflector;
} {
  const handler = function testHandler() {};
  class TestController {}
  const request: any = {
    method: options.method,
    url: options.url ?? '/api/v1/clients/me/onboard',
    headers: options.headers ?? {},
    ip: '127.0.0.1',
    ...(options.user ? { user: options.user } : {}),
  };

  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === 'isPublic') return Boolean(options.isPublic);
      if (key === ALLOW_SANDBOX_MUTATION_KEY) return Boolean(options.allowSandboxMutation);
      return undefined;
    }),
  } as unknown as Reflector;

  const context = {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request, reflector };
}

function signLocalToken(payload: Record<string, unknown>): string {
  return jwt.sign(
    {
      sub: 'client-user-1',
      email: 'client@example.com',
      realm_access: { roles: ['CLIENT'] },
      ...payload,
    },
    JWT_SECRET,
    { algorithm: 'HS256', issuer: 'bazionweb', expiresIn: '15m' },
  );
}

describe('Sandbox / Impersonation Read-Only Enforcement', () => {
  it('allows GET requests with an impersonation / sandbox JWT via JwtAuthGuard and SubscriptionGuard', async () => {
    const token = signLocalToken({
      impersonatedBy: 'support@bazionweb.com',
      isSandbox: true,
    });
    const config = makeConfig();
    const { context, request, reflector } = makeContext({
      method: 'GET',
      url: '/api/v1/hosting/me',
      headers: { authorization: `Bearer ${token}` },
    });

    const jwtGuard = new JwtAuthGuard(reflector, config);
    await expect(jwtGuard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      id: 'client-user-1',
      impersonatedBy: 'support@bazionweb.com',
      isSandbox: true,
    });

    const subscriptionGuard = new SubscriptionGuard({} as any);
    await expect(subscriptionGuard.canActivate(context)).resolves.toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'blocks %s mutations for impersonated/sandbox JWTs in JwtAuthGuard (even on @Public routes with optional token)',
    async (method) => {
      const token = signLocalToken({
        impersonatedBy: 'superadmin@bazionweb.com',
        isSandbox: true,
      });
      const config = makeConfig();

      // Protected controller route (e.g. clients/me/onboard, tickets, hosting)
      const protectedCase = makeContext({
        method,
        headers: { authorization: `Bearer ${token}` },
      });
      const protectedGuard = new JwtAuthGuard(protectedCase.reflector, config);
      await expect(protectedGuard.canActivate(protectedCase.context)).rejects.toThrow(
        new ForbiddenException(SANDBOX_READONLY_MESSAGE),
      );

      // @Public() route with optional sandbox bearer token (prevents accidental mutation bypass)
      const publicCase = makeContext({
        method,
        url: '/api/v1/auth/claim-account',
        headers: { authorization: `Bearer ${token}` },
        isPublic: true,
      });
      const publicGuard = new JwtAuthGuard(publicCase.reflector, config);
      await expect(publicGuard.canActivate(publicCase.context)).rejects.toThrow(
        new ForbiddenException(SANDBOX_READONLY_MESSAGE),
      );
    },
  );

  it('allows @AllowSandboxMutation() POST /api/v1/auth/logout for impersonation sessions', async () => {
    const token = signLocalToken({
      impersonatedBy: 'support@bazionweb.com',
      isSandbox: true,
    });
    const config = makeConfig();
    const { context, reflector } = makeContext({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${token}`, 'x-bazion-sandbox': 'true' },
      isPublic: true,
      allowSandboxMutation: true,
    });

    const jwtGuard = new JwtAuthGuard(reflector, config);
    const globalGuard = new SandboxReadOnlyGuard(reflector, config);

    await expect(globalGuard.canActivate(context)).resolves.toBe(true);
    await expect(jwtGuard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks x-bazion-sandbox header and sandbox Bearer JWT globally via SandboxReadOnlyGuard and writes an audit record', async () => {
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const prismaMock = { auditLog: { create: auditCreate } } as any;
    const config = makeConfig();

    const headerCase = makeContext({
      method: 'POST',
      url: '/api/v1/pricing/quote',
      headers: { 'x-bazion-sandbox': 'true', 'user-agent': 'jest-test' },
    });
    const globalGuard = new SandboxReadOnlyGuard(headerCase.reflector, config, prismaMock);
    await expect(globalGuard.canActivate(headerCase.context)).rejects.toThrow(
      new ForbiddenException(SANDBOX_READONLY_MESSAGE),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'sandbox.mutation_blocked',
          resourceType: 'sandbox_guard',
          newValue: expect.objectContaining({
            method: 'POST',
            path: '/api/v1/pricing/quote',
            sandboxHeader: true,
          }),
        }),
      }),
    );

    const token = signLocalToken({ impersonatedBy: 'admin@bazionweb.com', isSandbox: true });
    const jwtCase = makeContext({
      method: 'PATCH',
      url: '/api/v1/clients/123',
      headers: { authorization: `Bearer ${token}` },
    });
    const jwtGlobalGuard = new SandboxReadOnlyGuard(jwtCase.reflector, config, prismaMock);
    await expect(jwtGlobalGuard.canActivate(jwtCase.context)).rejects.toThrow(
      new ForbiddenException(SANDBOX_READONLY_MESSAGE),
    );
  });

  it('rejects sandbox mutations inside SubscriptionGuard as defense-in-depth', async () => {
    const subscriptionGuard = new SubscriptionGuard({} as any);
    const { context } = makeContext({
      method: 'POST',
      user: { id: 'client-1', roles: ['CLIENT'], impersonatedBy: 'admin@bazionweb.com', isSandbox: true },
    });

    await expect(subscriptionGuard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(SANDBOX_READONLY_MESSAGE),
    );
  });
});
