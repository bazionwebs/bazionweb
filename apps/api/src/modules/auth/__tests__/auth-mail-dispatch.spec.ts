import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuthMailService, sanitizeRedirectPath } from '../auth-mail.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AuthService + AuthMailService Production Magic-Link Dispatch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const makeConfig = (overrides: Record<string, unknown> = {}) => {
    const values: Record<string, unknown> = {
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'local',
      JWT_SECRET: 'prod-jwt-secret-minimum-32-characters-long',
      PAYSTACK_SECRET_KEY: 'sk_live_prod_paystack_secret_key',
      FRONTEND_URL: 'https://bazionweb.com',
      ...overrides,
    };
    return {
      get: jest.fn((key: string, fallback?: unknown) =>
        key in values ? values[key] : fallback,
      ),
    };
  };

  const makePrisma = () => ({
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-claimed-1',
        email: 'bazion001@gmail.com',
        firstName: 'Bazion',
        lastName: 'Client',
        role: 'CLIENT',
        passwordHash: 'scrypt$16384$8$1$aa$bb',
        keycloakId: null,
        deletedAt: null,
      }),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'rt-magic-1' }),
    },
  });

  it('canDispatchTokens accepts INTERNAL_DISPATCH_SECRET, PAYSTACK_SECRET_KEY, or JWT_SECRET in production and rejects placeholders', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        AuthMailService,
        {
          provide: ConfigService,
          useValue: makeConfig({
            INTERNAL_DISPATCH_SECRET: 'CHANGE_ME_PLACEHOLDER_SECRET_VALUE',
          }),
        },
        { provide: PrismaService, useValue: makePrisma() },
      ],
    }).compile();

    const auth = module.get<AuthService>(AuthService);

    expect(auth.canDispatchTokens('CHANGE_ME_PLACEHOLDER_SECRET_VALUE')).toBe(false);
    expect(auth.canDispatchTokens('wrong-secret-value')).toBe(false);
    expect(auth.canDispatchTokens('')).toBe(false);
    expect(auth.canDispatchTokens('sk_live_prod_paystack_secret_key')).toBe(true);
    expect(auth.canDispatchTokens('prod-jwt-secret-minimum-32-characters-long')).toBe(true);
  });

  it('self-dispatches magic-link email directly from API via Resend without requiring x-internal-dispatch and never leaks raw token', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 're_msg_12345' }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        AuthMailService,
        {
          provide: ConfigService,
          useValue: makeConfig({ RESEND_API_KEY: 'test-resend-dummy-key-999' }),
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    const auth = module.get<AuthService>(AuthService);

    const res = await auth.requestMagicLink(
      'bazion001@gmail.com',
      false, // unauthenticated public / browser call without x-internal-dispatch
      '/checkout?plan=care-essential&cycle=MONTHLY&cart=1',
    );

    // Raw token MUST NOT be exposed to anonymous callers
    expect(res.magicToken).toBe('');
    expect(res.expiresIn).toBe(0);
    expect(res.emailDispatched).toBe(true);
    expect(res.delivered).toBe(true);
    expect(res.provider).toBe('resend');

    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('https://api.resend.com/emails');
    const body = JSON.parse(calledInit.body);
    expect(body.to).toEqual(['bazion001@gmail.com']);
    expect(body.html).toContain('https://bazionweb.com/portal/login/verify?token=magic_');
    expect(body.html).toContain('redirect=%2Fcheckout%3Fplan%3Dcare-essential%26cycle%3DMONTHLY%26cart%3D1');
  });

  it('sanitizeRedirectPath blocks open redirects and login loops on API side', () => {
    expect(sanitizeRedirectPath('/checkout?cart=1')).toBe('/checkout?cart=1');
    expect(sanitizeRedirectPath('https://evil.example/phish')).toBeNull();
    expect(sanitizeRedirectPath('//evil.example')).toBeNull();
    expect(sanitizeRedirectPath('/portal/login')).toBeNull();
  });
});

