import { Reflector } from '@nestjs/core';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { MfaGuard } from '../mfa.guard';

describe('MfaGuard', () => {
  let guard: MfaGuard;
  let reflector: Reflector;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(() => {
    reflector = new Reflector();
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    guard = new MfaGuard(reflector, prisma as any);
  });

  function createMockContext(user: any, requireMfa = false): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requireMfa);
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user, rawJwtPayload: {} }),
      }),
    } as any;
  }

  it('allows unauthenticated users (delegates to JwtAuthGuard)', async () => {
    const ctx = createMockContext(null);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('allows non-staff client users when route does not require MFA', async () => {
    const ctx = createMockContext({ id: 'client-1', roles: ['CLIENT'] }, false);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('FAILS CLOSED (throws ForbiddenException) if staff user is not found in database', async () => {
    const ctx = createMockContext({ id: 'admin-1', roles: ['ADMIN'] }, false);
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('blocks staff user when mfaEnabled is false in database', async () => {
    const ctx = createMockContext({ id: 'admin-1', roles: ['ADMIN'] }, false);
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN', mfaEnabled: false });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows staff user when mfaEnabled is true in database', async () => {
    const ctx = createMockContext({ id: 'admin-1', roles: ['ADMIN'] }, false);
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN', mfaEnabled: true });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('enforces MFA for any user on @RequireMfa routes', async () => {
    const ctx = createMockContext({ id: 'user-1', roles: ['CLIENT'] }, true);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'CLIENT', mfaEnabled: false });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
