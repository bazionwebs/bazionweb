import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ClientsService } from '../../clients/clients.service';

const TEST_SECRET = 'super-secret-jwt-key-minimum-32-chars-ok';

function makeConfig(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string, def?: any) => (key in values ? values[key] : def)),
  };
}

describe('OIDC (issuer, subject) Identity Mapping & Local Customer Login Policy', () => {
  it('returns claimRequired=true for unlinked OIDC identity and NEVER auto-links by email', async () => {
    const prisma = {
      oidcIdentityLink: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const authService = new AuthService(makeConfig({}) as any, prisma as any);

    const res = await authService.exchangeOidcCallback({
      issuer: 'https://platform.bazionweb.com/',
      subject: 'oidc-sub-alice',
      email: 'alice@example.com',
    });

    expect(res).toEqual({
      linked: false,
      claimRequired: true,
      issuer: 'https://platform.bazionweb.com',
      subject: 'oidc-sub-alice',
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.oidc_identity.claim_required' }),
      }),
    );
  });

  it('creates an audited 1-to-1 OidcIdentityLink on claimOidcAccount and rejects conflicting links', async () => {
    const rawClaim = 'claim_valid-single-use-token';
    const tokenHash = createHash('sha256').update(rawClaim).digest('hex');

    const storedToken = {
      id: 'tok-1',
      tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 600_000),
      user: {
        id: 'user-alice-uuid',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Mwangi',
        role: 'CLIENT',
        deletedAt: null,
      },
    };

    const clientRecord = {
      id: 'client-alice-1',
      email: 'alice@example.com',
      userId: 'user-alice-uuid',
      status: 'ACTIVE',
      subscriptions: [{ id: 'sub-1', status: 'ACTIVE' }],
      invoices: [{ id: 'inv-1', paidAt: new Date() }],
    };

    const tx = {
      oidcIdentityLink: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'link-1' }),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { update: jest.fn().mockResolvedValue({}) },
      client: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const prisma = {
      refreshToken: { findUnique: jest.fn().mockResolvedValue(storedToken) },
      client: { findUnique: jest.fn().mockResolvedValue(clientRecord) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };

    const authService = new AuthService(makeConfig({}) as any, prisma as any);

    const linked = await authService.claimOidcAccount(
      {
        issuer: 'https://platform.bazionweb.com',
        subject: 'oidc-sub-alice',
        email: 'alice@example.com',
        claimToken: rawClaim,
      },
      '10.0.0.1',
    );

    expect(linked).toMatchObject({
      linked: true,
      claimRequired: false,
      linkId: 'link-1',
      issuer: 'https://platform.bazionweb.com',
      subject: 'oidc-sub-alice',
      userId: 'user-alice-uuid',
      clientId: 'client-alice-1',
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'auth.oidc_identity.linked',
          resourceType: 'OidcIdentityLink',
          resourceId: 'link-1',
        }),
      }),
    );

    // Conflicting 1-to-1 link throws ConflictException
    tx.oidcIdentityLink.findFirst.mockResolvedValueOnce({ id: 'existing-link' });
    await expect(
      authService.claimOidcAccount({
        issuer: 'https://platform.bazionweb.com',
        subject: 'oidc-sub-other',
        email: 'alice@example.com',
        claimToken: rawClaim,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('resolves (issuer, subject) in JwtAuthGuard before Client access, blocks unlinked subjects, and isolates commercial records', async () => {
    const config = makeConfig({
      OIDC_BFF_SESSION_SECRET: TEST_SECRET,
      KEYCLOAK_URL: '',
    });

    const aliceToken = jwt.sign(
      {
        iss: 'bazionweb-bff',
        sub: 'oidc-sub-alice',
        oidcIss: 'https://platform.bazionweb.com',
        oidcSub: 'oidc-sub-alice',
        email: 'alice@example.com',
        realm_access: { roles: ['CLIENT'] },
      },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );

    const unlinkedToken = jwt.sign(
      {
        iss: 'bazionweb-bff',
        sub: 'oidc-sub-unlinked',
        oidcIss: 'https://platform.bazionweb.com',
        oidcSub: 'oidc-sub-unlinked',
        email: 'stranger@example.com',
        realm_access: { roles: ['CLIENT'] },
      },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );

    const prisma = {
      oidcIdentityLink: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.issuer_subject.subject === 'oidc-sub-alice') {
            return {
              id: 'link-alice',
              issuer: 'https://platform.bazionweb.com',
              subject: 'oidc-sub-alice',
              userId: 'user-alice-uuid',
              clientId: 'client-alice-1',
              revokedAt: null,
              user: { id: 'user-alice-uuid', email: 'alice@example.com', deletedAt: null },
              client: { id: 'client-alice-1' },
            };
          }
          return null;
        }),
      },
      client: {
        findFirst: jest.fn(async ({ where }: any) =>
          where.userId === 'user-alice-uuid' ? { id: 'client-alice-1', userId: 'user-alice-uuid' } : null,
        ),
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === 'client-alice-1') {
            return { id: 'client-alice-1', userId: 'user-alice-uuid', deletedAt: null };
          }
          if (where.id === 'client-bob-2') {
            return { id: 'client-bob-2', userId: 'user-bob-uuid', deletedAt: null };
          }
          return null;
        }),
      },
    };

    const guard = new JwtAuthGuard(new Reflector(), config as any, prisma as any);

    const makeExecCtx = (token: string) => {
      const req: any = {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      };
      return {
        req,
        ctx: {
          switchToHttp: () => ({ getRequest: () => req }),
          getHandler: () => (() => undefined),
          getClass: () => class Dummy {},
        } as any,
      };
    };

    // Unlinked OIDC subject fails closed with ForbiddenException
    const unlinked = makeExecCtx(unlinkedToken);
    await expect(guard.canActivate(unlinked.ctx)).rejects.toThrow(ForbiddenException);

    // Linked OIDC subject resolves to canonical Bazionweb User.id & Client.id
    const alice = makeExecCtx(aliceToken);
    await expect(guard.canActivate(alice.ctx)).resolves.toBe(true);
    expect(alice.req.user.id).toBe('user-alice-uuid');
    expect(alice.req.user.clientId).toBe('client-alice-1');

    // Linked OIDC user can read own commercial client record, and is denied Bob's record
    const clientsSvc = new ClientsService(prisma as any, config as any);
    const ownClient = await clientsSvc.findByUserId(alice.req.user.id);
    expect(ownClient.data.id).toBe('client-alice-1');

    await expect(clientsSvc.findOne('client-bob-2', alice.req.user)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('disables local customer password & magic-link login when Platform SSoT is active while keeping staff policy distinct', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.email === 'customer@example.com') {
            return { id: 'u-cust', email: 'customer@example.com', role: 'CLIENT', deletedAt: null, passwordHash: 'scrypt$...' };
          }
          return null;
        }),
      },
    };

    const ssotConfig = makeConfig({
      PLATFORM_SSOT_MODE: 'true',
      STAFF_LOCAL_AUTH_POLICY: 'allow_staff_only',
    });
    const authSvc = new AuthService(ssotConfig as any, prisma as any);

    expect(authSvc.isCustomerLocalAuthDisabled()).toBe(true);
    expect(authSvc.isStaffLocalAuthDisabled()).toBe(false);

    await expect(authSvc.login('customer@example.com', 'SomePassword123!')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(authSvc.requestMagicLink('customer@example.com', true)).rejects.toThrow(
      ForbiddenException,
    );

    const staffDisabledConfig = makeConfig({
      PLATFORM_SSOT_MODE: 'true',
      STAFF_LOCAL_AUTH_POLICY: 'disabled',
    });
    const authSvcStrict = new AuthService(staffDisabledConfig as any, prisma as any);
    expect(authSvcStrict.isStaffLocalAuthDisabled()).toBe(true);
  });
});

