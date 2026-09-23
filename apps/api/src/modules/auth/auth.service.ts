import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  randomBytes,
  createHash,
  scrypt as _scrypt,
  timingSafeEqual,
} from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';

// Promise wrapper with an explicit signature (avoids promisify overload issues)
function scryptAsync(
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    _scrypt(password, salt, keylen, opts, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}

// ─── Password hashing (Node scrypt, no native deps) ─────────────────────────
// Stored format: scrypt$N$r$p$saltHex$keyHex (params embedded → future-proof)
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })) as Buffer;
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, N, r, p, saltHex, keyHex] = parts;
    const key = (await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEY_LEN, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    })) as Buffer;
    const expected = Buffer.from(keyHex, 'hex');
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// ─── Role hierarchy (local provider) ────────────────────────────────────────
// Higher roles inherit lower ones so @Roles('ADMIN') also admits SUPER_ADMIN.
const ROLE_HIERARCHY: Record<string, string[]> = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CLIENT'],
  ADMIN:       ['ADMIN', 'SUPPORT', 'CLIENT'],
  SUPPORT:     ['SUPPORT', 'CLIENT'],
  CLIENT:      ['CLIENT'],
};

export function expandRoles(role: string): string[] {
  return ROLE_HIERARCHY[role] ?? [role];
}

function parseDurationToMs(input: string | undefined, fallbackMs: number): number {
  const m = /^(\d+)([smhd])$/.exec((input ?? '').trim());
  if (!m) return fallbackMs;
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(m[1]) * mult[m[2]];
}

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
}

type TokenPair = {
  data: { accessToken: string; refreshToken: string; expiresIn: number };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Local provider is the default. Keycloak is used only when explicitly
   * selected AND configured (AUTH_PROVIDER=keycloak + KEYCLOAK_URL set).
   */
  private isLocalProvider(): boolean {
    const provider = (this.config.get<string>('AUTH_PROVIDER') ?? 'local').toLowerCase();
    if (provider !== 'keycloak') return true;
    return !this.config.get<string>('KEYCLOAK_URL');
  }

  private jwtSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET') ?? '';
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters for local auth');
    }
    return secret;
  }

  private accessExpiry(): string {
    return this.config.get<string>('JWT_EXPIRY') ?? '15m';
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<TokenPair> {
    if (!this.isLocalProvider()) return this.keycloakLogin(email, password);
    return this.localLogin(email.toLowerCase().trim(), password);
  }

  private async localLogin(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(err => this.logger.warn(`lastLoginAt update failed: ${err}`));

    return this.issueTokenPair(user);
  }

  // ── Refresh (rotating) ────────────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<TokenPair> {
    if (!this.isLocalProvider()) return this.keycloakRefresh(refreshToken);

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() <= Date.now() ||
      !stored.user ||
      stored.user.deletedAt
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke the presented token, issue a fresh pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(stored.user);
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async logout(accessToken: string): Promise<void> {
    if (!this.isLocalProvider()) return this.keycloakLogout(accessToken);

    // Local logout = revoke all refresh tokens for the token owner.
    // Never throws — logout should succeed even if revocation fails.
    try {
      const decoded = jwt.verify(accessToken, this.jwtSecret()) as { sub?: string };
      if (decoded?.sub) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: decoded.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch (err) {
      this.logger.warn(`Local logout revocation failed: ${err}`);
    }
  }

  /**
   * Staff provisioning: set (or rotate) a user's local password.
   * Returns null when the user does not exist or is soft-deleted.
   */
  async setUserPassword(userId: string, newPassword: string): Promise<{ id: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return null;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
      select: { id: true },
    });
    // Invalidate existing sessions so the new password takes effect cleanly
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return updated;
  }

  // ── Token issuance (Keycloak-claim-compatible for the existing frontend) ──
  private async issueTokenPair(user: {
    id: string; email: string; firstName: string | null;
    lastName: string | null; role: string;
  }): Promise<TokenPair> {
    const roles = expandRoles(user.role);
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        given_name: user.firstName ?? '',
        family_name: user.lastName ?? '',
        realm_access: { roles },
        iss: 'bazionweb',
        type: 'access',
      },
      this.jwtSecret(),
      { algorithm: 'HS256', expiresIn: this.accessExpiry() as any },
    );

    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshMs = parseDurationToMs(
      this.config.get<string>('JWT_REFRESH_EXPIRY'),
      7 * 86_400_000,
    );
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: createHash('sha256').update(rawRefreshToken).digest('hex'),
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshMs),
      },
    });

    const accessMs = parseDurationToMs(this.accessExpiry(), 15 * 60_000);
    return {
      data: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: Math.floor(accessMs / 1000),
      },
    };
  }

  // ── Keycloak provider (used when AUTH_PROVIDER=keycloak + KEYCLOAK_URL) ────

  private async keycloakLogin(email: string, password: string): Promise<TokenPair> {
    const url = `${this.config.get('KEYCLOAK_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/token`;

    const params = new URLSearchParams({
      grant_type:    'password',
      client_id:     this.config.get('KEYCLOAK_CLIENT_ID') ?? '',
      client_secret: this.config.get('KEYCLOAK_CLIENT_SECRET') ?? '',
      username:      email,
      password:      password,
      scope:         'openid profile email',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.warn(`Keycloak login failed for ${email}: ${error}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens: KeycloakTokenResponse = await response.json();

    return {
      data: {
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn:    tokens.expires_in,
      },
    };
  }

  private async keycloakLogout(accessToken: string): Promise<void> {
    try {
      const url = `${this.config.get('KEYCLOAK_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/logout`;

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: new URLSearchParams({
          client_id:     this.config.get('KEYCLOAK_CLIENT_ID') ?? '',
          client_secret: this.config.get('KEYCLOAK_CLIENT_SECRET') ?? '',
        }).toString(),
      });
    } catch (err) {
      this.logger.warn(`Logout token revocation failed: ${err}`);
      // Don't throw — logout should succeed even if revocation fails
    }
  }

  private async keycloakRefresh(refreshToken: string): Promise<TokenPair> {
    const url = `${this.config.get('KEYCLOAK_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/token`;

    const params = new URLSearchParams({
      grant_type:     'refresh_token',
      client_id:      this.config.get('KEYCLOAK_CLIENT_ID') ?? '',
      client_secret:  this.config.get('KEYCLOAK_CLIENT_SECRET') ?? '',
      refresh_token:  refreshToken,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokens: KeycloakTokenResponse = await response.json();

    return {
      data: {
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn:    tokens.expires_in,
      },
    };
  }
}
