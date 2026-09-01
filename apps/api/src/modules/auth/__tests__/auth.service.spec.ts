import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockConfig = {
  get: (key: string) => ({
    KEYCLOAK_URL:           'http://localhost:8080',
    KEYCLOAK_REALM:         'bazionweb',
    KEYCLOAK_CLIENT_ID:     'bazionweb-api',
    KEYCLOAK_CLIENT_SECRET: 'test-secret',
  }[key] ?? ''),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mockFetch.mockReset();
  });

  describe('login()', () => {
    it('returns tokens on valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token:  'eyJhbGciOiJSUzI1NiJ9.test.sig',
          refresh_token: 'refresh-token-value',
          expires_in:    900,
          refresh_expires_in: 604800,
          token_type: 'Bearer',
        }),
      });

      const result = await service.login('client@example.com', 'Password123!');

      expect(result.data.accessToken).toBe('eyJhbGciOiJSUzI1NiJ9.test.sig');
      expect(result.data.refreshToken).toBe('refresh-token-value');
      expect(result.data.expiresIn).toBe(900);
    });

    it('throws UnauthorizedException on invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'invalid_grant',
      });

      await expect(service.login('wrong@email.com', 'badpass'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('calls Keycloak token endpoint with correct params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token', refresh_token: 'refresh',
          expires_in: 900, refresh_expires_in: 604800, token_type: 'Bearer',
        }),
      });

      await service.login('client@example.com', 'Password123!');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/protocol/openid-connect/token');
      expect(options.method).toBe('POST');
      expect(options.body).toContain('grant_type=password');
      expect(options.body).toContain('client_id=bazionweb-api');
    });
  });

  describe('logout()', () => {
    it('calls Keycloak logout endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await service.logout('access-token-value');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/protocol/openid-connect/logout');
    });

    it('does not throw even if Keycloak logout fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));

      // Should NOT throw
      await expect(service.logout('token')).resolves.toBeUndefined();
    });
  });

  describe('refresh()', () => {
    it('returns new tokens on valid refresh token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token:  'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in:    900,
          refresh_expires_in: 604800,
          token_type: 'Bearer',
        }),
      });

      const result = await service.refresh('valid-refresh-token');

      expect(result.data.accessToken).toBe('new-access-token');
      expect(result.data.refreshToken).toBe('new-refresh-token');
    });

    it('throws UnauthorizedException on expired refresh token', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(service.refresh('expired-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('uses refresh_token grant type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token', refresh_token: 'refresh',
          expires_in: 900, refresh_expires_in: 604800, token_type: 'Bearer',
        }),
      });

      await service.refresh('my-refresh-token');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toContain('grant_type=refresh_token');
      expect(options.body).toContain('refresh_token=my-refresh-token');
    });
  });
});
