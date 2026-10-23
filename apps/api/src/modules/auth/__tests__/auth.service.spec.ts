import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService, hashPassword } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';

const JWT_SECRET = 'test-jwt-secret-minimum-32-characters';

function localConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    AUTH_PROVIDER: 'local',
    JWT_SECRET,
    JWT_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    ...overrides,
  };
  return { get: (key: string) => values[key] ?? '' };
}

function keycloakConfig() {
  return {
    get: (key: string) => ({
      AUTH_PROVIDER:          'keycloak',
      KEYCLOAK_URL:           'http://localhost:8080',
      KEYCLOAK_REALM:         'bazionweb',
      KEYCLOAK_CLIENT_ID:     'bazionweb-api',
      KEYCLOAK_CLIENT_SECRET: 'test-secret',
      JWT_SECRET,
    }[key] ?? ''),
  };
}

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AuthService (local provider)', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };

  const mockUser = {
    id: 'user-uuid-1',
    email: 'client@example.com',
    firstName: 'Sarah',
    lastName: 'Kamau',
    role: 'CLIENT' as const,
    deletedAt: null,
    passwordHash: '',
  };

  beforeEach(async () => {
    mockUser.passwordHash = await hashPassword('Password123!');
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      refreshToken: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'rt-uuid', ...data })),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: localConfig() },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mockFetch.mockReset();
  });

  describe('login()', () => {
    it('returns a Keycloak-compatible token pair on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login('client@example.com', 'Password123!');

      expect(result.data.accessToken).toBeTruthy();
      expect(result.data.refreshToken).toMatch(/^[0-9a-f]{96}$/);
      expect(result.data.expiresIn).toBe(900);

      const decoded = jwt.verify(result.data.accessToken, JWT_SECRET) as any;
      expect(decoded.sub).toBe('user-uuid-1');
      expect(decoded.iss).toBe('bazionweb');
      expect(decoded.realm_access.roles).toEqual(['CLIENT']);
      expect(decoded.given_name).toBe('Sarah');
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-uuid-1' } }),
      );
    });

    it('expands staff roles hierarchically', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'SUPER_ADMIN' });

      const result = await service.login('client@example.com', 'Password123!');
      const decoded = jwt.verify(result.data.accessToken, JWT_SECRET) as any;
      expect(decoded.realm_access.roles).toEqual(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CLIENT']);
    });

    it('throws on unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('nobody@example.com', 'Password123!')).rejects.toThrow(UnauthorizedException);
    });

    it('throws on wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(service.login('client@example.com', 'WrongPass123!')).rejects.toThrow(UnauthorizedException);
    });

    it('throws for users without a local password (Keycloak-only)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: null });
      await expect(service.login('client@example.com', 'Password123!')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh()', () => {
    it('rotates the refresh token and returns a new pair', async () => {
      const future = new Date(Date.now() + 86_400_000);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old', tokenHash: 'hash', userId: 'user-uuid-1',
        expiresAt: future, revokedAt: null, user: mockUser,
      });

      const result = await service.refresh('a'.repeat(96));

      expect(result.data.accessToken).toBeTruthy();
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-old' } }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('throws on unknown, revoked, or expired tokens', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('b'.repeat(96))).rejects.toThrow(UnauthorizedException);

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old', userId: 'user-uuid-1',
        expiresAt: new Date(Date.now() + 86_400_000), revokedAt: new Date(), user: mockUser,
      });
      await expect(service.refresh('b'.repeat(96))).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout()', () => {
    it('revokes all sessions for the token owner', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const { data } = await service.login('client@example.com', 'Password123!');

      await service.logout(data.accessToken);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-uuid-1', revokedAt: null } }),
      );
    });

    it('never throws on garbage tokens', async () => {
      await expect(service.logout('not-a-token')).resolves.toBeUndefined();
    });
  });
});

describe('AuthService (keycloak provider)', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: keycloakConfig() },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mockFetch.mockReset();
  });

  it('delegates login to the Keycloak token endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'kc-access', refresh_token: 'kc-refresh',
        expires_in: 900, refresh_expires_in: 604800, token_type: 'Bearer',
      }),
    });

    const result = await service.login('client@example.com', 'Password123!');

    expect(result.data.accessToken).toBe('kc-access');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/protocol/openid-connect/token');
    expect(options.body).toContain('grant_type=password');
  });

  it('throws on invalid Keycloak credentials', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'invalid_grant' });
    await expect(service.login('wrong@email.com', 'badpass')).rejects.toThrow(UnauthorizedException);
  });

  it('delegates refresh via the refresh_token grant', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'kc-new', refresh_token: 'kc-new-refresh',
        expires_in: 900, refresh_expires_in: 604800, token_type: 'Bearer',
      }),
    });

    const result = await service.refresh('valid-refresh-token');

    expect(result.data.accessToken).toBe('kc-new');
    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toContain('grant_type=refresh_token');
  });

  it('logout does not throw even if Keycloak is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    await expect(service.logout('token')).resolves.toBeUndefined();
  });
});

describe('AuthService.setUserPassword()', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: { updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: localConfig() },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('hashes the new password, updates the user, and revokes sessions', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', deletedAt: null });
    prisma.user.update.mockImplementation(() => Promise.resolve({ id: 'u-1' }));

    const result = await service.setUserPassword('u-1', 'NewStrongPass123!');

    expect(result).toEqual({ id: 'u-1' });
    const hash = prisma.user.update.mock.calls[0][0].data.passwordHash as string;
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hash).not.toContain('NewStrongPass123!');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u-1', revokedAt: null } }),
    );

    // The stored hash must verify against the new password
    const { verifyPassword } = jest.requireActual('../auth.service') as typeof import('../auth.service');
    await expect(verifyPassword('NewStrongPass123!', hash)).resolves.toBe(true);
    await expect(verifyPassword('WrongPass123!', hash)).resolves.toBe(false);
  });

  it('returns null for unknown or deleted users', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.setUserPassword('ghost', 'NewStrongPass123!')).resolves.toBeNull();

    prisma.user.findUnique.mockResolvedValue({ id: 'u-2', deletedAt: new Date() });
    await expect(service.setUserPassword('u-2', 'NewStrongPass123!')).resolves.toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.pay-first flows (claim + magic link)', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    client: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };

  const paidClient = {
    email: 'guest@example.com',
    contactName: 'Jane Wanjiku',
    phone: '+254700000000',
    status: 'ACTIVE',
    userId: 'user-guest-1',
    invoices: [{ id: 'inv-1', paidAt: new Date(Date.now() - 86_400_000) }],
    subscriptions: [{ id: 'sub-1', status: 'ACTIVE' }],
  };

  const unclaimedUser = {
    id: 'user-guest-1',
    email: 'guest@example.com',
    firstName: 'Jane',
    lastName: 'Wanjiku',
    role: 'CLIENT' as const,
    keycloakId: null,
    deletedAt: null,
    passwordHash: null, // passwordless — created at checkout
  };

  const claimedUser = {
    ...unclaimedUser,
    passwordHash: 'scrypt$16384$8$1$aa$bb',
  };

  const validTokenRow = (user: typeof unclaimedUser | typeof claimedUser) => ({
    id: 'rt-1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user,
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(unclaimedUser),
        update: jest.fn().mockResolvedValue({ id: 'user-guest-1' }),
        create: jest.fn(),
      },
      client: {
        findUnique: jest.fn().mockResolvedValue(paidClient),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'rt-1', ...data })),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: localConfig() },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('claimAccount consumes the emailed token, sets a password, and returns a session', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(validTokenRow(unclaimedUser));

    const result = await service.claimAccount({
      email: 'Guest@example.com',
      password: 'Claimed123!',
      claimToken: 'claim_valid-token',
      firstName: 'Jane',
      lastName: 'Wanjiku',
    });

    const hash = prisma.user.update.mock.calls[0][0].data.passwordHash as string;
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(result.user.email).toBe('guest@example.com');
    expect(result.user.subscriptionStatus).toBe('ACTIVE');
    expect(result.data.accessToken).toBeTruthy();

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1', revokedAt: null } }),
    );
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', userId: 'user-guest-1' }),
      }),
    );

    const decoded = jwt.verify(result.data.accessToken, JWT_SECRET) as any;
    expect(decoded.subscriptionStatus).toBe('ACTIVE');
  });

  it('claimAccount refuses to run without an emailed claim token', async () => {
    await expect(service.claimAccount({
      email: 'guest@example.com',
      password: 'Claimed123!',
      claimToken: '',
    })).rejects.toThrow(/Verify your email first/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('claimAccount refuses an invalid, expired, or reused token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.claimAccount({
      email: 'guest@example.com',
      password: 'Claimed123!',
      claimToken: 'claim_expired',
    })).rejects.toThrow(/invalid or has expired/);

    prisma.refreshToken.findUnique.mockResolvedValue({
      ...validTokenRow(unclaimedUser),
      revokedAt: new Date(),
    });
    await expect(service.claimAccount({
      email: 'guest@example.com',
      password: 'Claimed123!',
      claimToken: 'claim_reused',
    })).rejects.toThrow(/invalid or has expired/);
  });

  it('claimAccount refuses a token issued for a different email', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(validTokenRow(unclaimedUser));
    await expect(service.claimAccount({
      email: 'attacker@example.com',
      password: 'Claimed123!',
      claimToken: 'claim_valid-token',
    })).rejects.toThrow(/different email address/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('claimAccount refuses emails without paid evidence', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(validTokenRow(unclaimedUser));
    prisma.client.findUnique.mockResolvedValue({
      ...paidClient,
      status: 'TRIAL',
      subscriptions: [{ status: 'PENDING' }],
      invoices: [],
    });
    await expect(service.claimAccount({
      email: 'guest@example.com',
      password: 'Claimed123!',
      claimToken: 'claim_valid-token',
    })).rejects.toThrow(ForbiddenException);
  });

  it('claimAccount refuses an email that already has a password', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(validTokenRow(claimedUser));
    await expect(service.claimAccount({
      email: 'guest@example.com',
      password: 'Claimed123!',
      claimToken: 'claim_valid-token',
    })).rejects.toThrow(/sign in instead/);
  });

  it('claimAccount refuses when another tab already consumed the token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(validTokenRow(unclaimedUser));
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.claimAccount({
      email: 'guest@example.com',
      password: 'Claimed123!',
      claimToken: 'claim_valid-token',
    })).rejects.toThrow(/already been used/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('requestClaimLink only emails paid, unclaimed accounts', async () => {
    prisma.user.findUnique.mockResolvedValue(unclaimedUser);
    const { claimToken, expiresIn } = await service.requestClaimLink('Guest@example.com');
    expect(claimToken).toMatch(/^claim_[A-Za-z0-9_-]{20,}$/);
    expect(expiresIn).toBe(900);
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-guest-1', expiresAt: expect.any(Date) }) }),
    );

    prisma.user.findUnique.mockResolvedValue(claimedUser);
    expect((await service.requestClaimLink('guest@example.com')).claimToken).toBe('');

    prisma.user.findUnique.mockResolvedValue(unclaimedUser);
    prisma.client.findUnique.mockResolvedValue({
      ...paidClient,
      status: 'TRIAL',
      subscriptions: [],
      invoices: [],
    });
    expect((await service.requestClaimLink('guest@example.com')).claimToken).toBe('');

    prisma.user.findUnique.mockResolvedValue(null);
    expect((await service.requestClaimLink('nobody@example.com')).claimToken).toBe('');
  });

  it('requestMagicLink only mints a token for claimed accounts', async () => {
    prisma.user.findUnique.mockResolvedValue(claimedUser);
    const { magicToken } = await service.requestMagicLink('guest@example.com');
    expect(magicToken).toMatch(/^magic_[A-Za-z0-9_-]{20,}$/);
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-guest-1', expiresAt: expect.any(Date) }) }),
    );

    // Passwordless checkout guest (unclaimed) must use the claim flow instead.
    prisma.user.findUnique.mockResolvedValue(unclaimedUser);
    expect((await service.requestMagicLink('guest@example.com')).magicToken).toBe('');

    prisma.user.findUnique.mockResolvedValue(null);
    expect((await service.requestMagicLink('nobody@example.com')).magicToken).toBe('');
  });

  it('verifyMagicLink consumes the token and returns a real session', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(validTokenRow(claimedUser));

    const result = await service.verifyMagicLink('magic_single-use-token');

    expect(result.data.accessToken).toBeTruthy();
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
    const decoded = jwt.verify(result.data.accessToken, JWT_SECRET) as any;
    expect(decoded.sub).toBe('user-guest-1');
  });

  it('verifyMagicLink revokes and rejects a token for an unclaimed guest', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(validTokenRow(unclaimedUser));
    await expect(service.verifyMagicLink('magic_unclaimed-token')).rejects.toThrow(
      /only available after your account is claimed/,
    );
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1' } }),
    );
  });

  it('verifyMagicLink rejects unknown, revoked, expired, or claim-purpose tokens', async () => {
    await expect(service.verifyMagicLink('garbage')).rejects.toThrow(UnauthorizedException);

    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.verifyMagicLink('magic_unknown')).rejects.toThrow(UnauthorizedException);

    prisma.refreshToken.findUnique.mockResolvedValue({
      ...validTokenRow(claimedUser),
      revokedAt: new Date(),
    });
    await expect(service.verifyMagicLink('magic_revoked')).rejects.toThrow(UnauthorizedException);

    prisma.refreshToken.findUnique.mockResolvedValue({
      ...validTokenRow(claimedUser),
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(service.verifyMagicLink('magic_expired')).rejects.toThrow(UnauthorizedException);

    // A claim token must not be usable as a sign-in token.
    await expect(service.verifyMagicLink('claim_valid-token')).rejects.toThrow(UnauthorizedException);
  });

  it('login embeds the subscriptionStatus claim', async () => {
    prisma.client.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      subscriptions: [{ status: 'ACTIVE' }],
    });
    prisma.user.findUnique.mockResolvedValue({ ...claimedUser, passwordHash: await hashPassword('Password123!') });

    const result = await service.login('guest@example.com', 'Password123!');
    const decoded = jwt.verify(result.data.accessToken, JWT_SECRET) as any;
    expect(decoded.subscriptionStatus).toBe('ACTIVE');
  });
});