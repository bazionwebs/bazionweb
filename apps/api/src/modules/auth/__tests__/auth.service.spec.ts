import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
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
