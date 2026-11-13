import {
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  randomBytes,
  createHash,
  scrypt as _scrypt,
  timingSafeEqual,
} from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthMailService, sanitizeRedirectPath } from './auth-mail.service';
import { isPlatformSsotAuthoritative } from '../platform-provisioning/platform-ssot-guard';

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

// Token purpose prefixes keep claim, sign-in, and reset links from being interchangeable.
const MAGIC_TOKEN_PREFIX = 'magic_';
const CLAIM_TOKEN_PREFIX = 'claim_';
const RESET_TOKEN_PREFIX = 'reset_';

// Constant-cost dummy scrypt hash to prevent timing-based email enumeration on login.
const DUMMY_PASSWORD_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${'00'.repeat(16)}$${'00'.repeat(KEY_LEN)}`;

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
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user?: Record<string, unknown>;
  };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly mailService?: AuthMailService,
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

  /**
   * Customer portal accounts migrate exclusively to Platform OIDC once
   * Platform SSoT is authoritative (or AUTH_PROVIDER=oidc / explicit disable).
   * Staff accounts remain governed separately by STAFF_LOCAL_AUTH_POLICY.
   */
  isCustomerLocalAuthDisabled(): boolean {
    const explicitDisabled = (this.config.get<string>('CUSTOMER_LOCAL_AUTH_DISABLED') ?? '')
      .trim()
      .toLowerCase();
    if (explicitDisabled === 'true' || explicitDisabled === '1') return true;
    if (explicitDisabled === 'false' || explicitDisabled === '0') return false;

    const provider = (this.config.get<string>('AUTH_PROVIDER') ?? 'local').trim().toLowerCase();
    if (provider === 'oidc') return true;

    const allowLegacy = (this.config.get<string>('ALLOW_LEGACY_CUSTOMER_LOCAL_AUTH') ?? '')
      .trim()
      .toLowerCase();
    if (allowLegacy === 'true' || allowLegacy === '1') return false;

    return isPlatformSsotAuthoritative(this.config);
  }

  isStaffLocalAuthDisabled(): boolean {
    const policy = (this.config.get<string>('STAFF_LOCAL_AUTH_POLICY') ?? 'allow_staff_only')
      .trim()
      .toLowerCase();
    return policy === 'disabled' || policy === 'oidc_only';
  }

  /**
   * Raw claim/magic tokens are only returned to the Next.js mailer BFF,
   * never to anonymous API callers. The BFF proves itself strictly with the dedicated
   * shared dispatch secret (INTERNAL_DISPATCH_SECRET).
   * Cross-purpose reuse of payment provider or session signing secrets is strictly forbidden.
   */
  canDispatchTokens(header?: string): boolean {
    const candidate = (header || '').trim();
    if (!candidate) return false;

    const dispatchSecret = (this.config.get<string>('INTERNAL_DISPATCH_SECRET', '') || '').trim();
    if (dispatchSecret.length < 12 || dispatchSecret.includes('CHANGE_ME')) {
      return false;
    }

    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(dispatchSecret, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
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
    if (user && !user.deletedAt) {
      if (user.role === 'CLIENT' && this.isCustomerLocalAuthDisabled()) {
        throw new ForbiddenException({
          code: 'CUSTOMER_LOCAL_LOGIN_DISABLED',
          message: 'Customer password sign-in is disabled. Please sign in with Platform OIDC.',
        });
      }
      if (user.role !== 'CLIENT' && this.isStaffLocalAuthDisabled()) {
        throw new ForbiddenException({
          code: 'STAFF_LOCAL_LOGIN_DISABLED',
          message: 'Staff local password sign-in is disabled by policy.',
        });
      }
    }
    if (!user || user.deletedAt || !user.passwordHash) {
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
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

    if (
      !refreshToken ||
      refreshToken.startsWith(MAGIC_TOKEN_PREFIX) ||
      refreshToken.startsWith(CLAIM_TOKEN_PREFIX) ||
      refreshToken.startsWith(RESET_TOKEN_PREFIX)
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

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

    // Rotate atomically: only the first concurrent caller consumes the refresh token.
    const consumed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueTokenPair(stored.user);
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async logout(accessToken: string): Promise<void> {
    if (!this.isLocalProvider()) return this.keycloakLogout(accessToken);

    // Local logout = revoke all refresh tokens for the token owner.
    // Never throws — logout should succeed even if revocation fails.
    try {
      let decoded: { sub?: string } | null = null;
      try {
        decoded = jwt.verify(accessToken, this.jwtSecret(), {
          algorithms: ['HS256'],
          issuer: 'bazionweb',
        }) as { sub?: string };
      } catch (verifyErr: unknown) {
        // An EXPIRED access token must still revoke the (still-valid) refresh
        // session — otherwise a user leaving a tab open for >15m cannot log
        // out. jwt.verify with ignoreExpiration returns the payload for
        // well-formed tokens signed with the right key; everything else is a
        // genuine failure (bad key/algorithm) and stays rejected.
        if (
          verifyErr instanceof jwt.TokenExpiredError ||
          (verifyErr instanceof Error && verifyErr.name === 'TokenExpiredError')
        ) {
          decoded = jwt.verify(accessToken, this.jwtSecret(), {
            algorithms: ['HS256'],
            issuer: 'bazionweb',
            ignoreExpiration: true,
          }) as { sub?: string };
        } else {
          throw verifyErr;
        }
      }
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
   * Self-service password rotation for the signed-in user.
   * Verifies currentPassword when a local passwordHash already exists,
   * revokes all previous refresh tokens, and issues a fresh token pair.
   */
  async changeOwnPassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account not found');
    }
    if (user.role === 'CLIENT' && this.isCustomerLocalAuthDisabled()) {
      throw new ForbiddenException({
        code: 'CUSTOMER_LOCAL_LOGIN_DISABLED',
        message: 'Customer password management is handled by Platform OIDC.',
      });
    }

    if (user.passwordHash) {
      if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
        throw new UnauthorizedException('Your current password is incorrect.');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user);
  }

  /**
   * Staff provisioning: set (or rotate) a user's local password.
   * Returns null when the user does not exist or is soft-deleted.
   */
  async setUserPassword(
    userId: string,
    newPassword: string,
    actorRoles?: string[],
  ): Promise<{ id: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return null;
    if (
      actorRoles &&
      ['SUPER_ADMIN', 'ADMIN'].includes(String(user.role)) &&
      !actorRoles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only a SUPER_ADMIN may reset an administrator password.');
    }
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

  // ── Self-service password reset ("forgot password") ────────────────────────
  /** Returns true when local password accounts are the active login method. */
  private canUseLocalReset(): boolean {
    return this.isLocalProvider();
  }

  /**
   * Step 1 of self-service password recovery: mint a single-use reset token
   * for a claimed (password-bearing) account. Raw tokens are only returned
   * to the Next.js mailer BFF (x-internal-dispatch), never to anonymous
   * callers. Unknown emails, soft-deleted users, unclaimed guest identities,
   * and non-local providers all return the same empty shape (no enumeration).
   */
  async requestPasswordReset(
    email: string,
    dispatchAuthorized = false,
  ): Promise<{
    resetToken: string;
    expiresIn: number;
    emailDispatched?: boolean;
    delivered?: boolean;
    provider?: string;
    message?: string;
  }> {
    const apiMailReady = Boolean(this.mailService?.isConfigured());
    if ((!dispatchAuthorized && !apiMailReady) || !this.canUseLocalReset()) {
      return { resetToken: '', expiresIn: 0 };
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
    if (user && !user.deletedAt && user.role === 'CLIENT' && this.isCustomerLocalAuthDisabled()) {
      return apiMailReady
        ? { resetToken: '', expiresIn: 0, emailDispatched: true, delivered: true }
        : { resetToken: '', expiresIn: 0 };
    }
    if (!user || user.deletedAt || !user.passwordHash) {
      return apiMailReady
        ? { resetToken: '', expiresIn: 0, emailDispatched: true, delivered: true }
        : { resetToken: '', expiresIn: 0 };
    }

    const rawToken = `${RESET_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });

    if (apiMailReady && this.mailService) {
      const origin = this.mailService.resolveFrontendOrigin();
      const resetLinkUrl = `${origin}/portal/reset-password?token=${encodeURIComponent(rawToken)}`;
      const sendResult = await this.mailService.sendPasswordResetEmail(cleanEmail, resetLinkUrl);
      return {
        resetToken: dispatchAuthorized ? rawToken : '',
        expiresIn: dispatchAuthorized ? 900 : 0,
        emailDispatched: true,
        delivered: sendResult.delivered,
        provider: sendResult.provider,
        message: sendResult.message,
      };
    }

    return { resetToken: rawToken, expiresIn: 900 };
  }

  /**
   * Step 2 of self-service password recovery: consume the emailed single-use
   * reset token and set a new password. The token is consumed atomically
   * (two open tabs cannot both use it) and every active refresh token for the
   * user is revoked so old sessions die with the password change.
   */
  async resetPassword(dto: { resetToken: string; newPassword: string }): Promise<void> {
    if (!dto.resetToken?.startsWith(RESET_TOKEN_PREFIX)) {
      throw new UnauthorizedException('This reset link is invalid or has expired.');
    }
    if (!this.canUseLocalReset()) {
      throw new UnauthorizedException('Password reset is handled by the identity provider. Contact support.');
    }

    const tokenHash = createHash('sha256').update(dto.resetToken).digest('hex');
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
      throw new UnauthorizedException('This reset link is invalid or has expired.');
    }

    if (stored.user.role === 'CLIENT' && this.isCustomerLocalAuthDisabled()) {
      throw new ForbiddenException({
        code: 'CUSTOMER_LOCAL_LOGIN_DISABLED',
        message: 'Customer password reset is disabled; sign in with Platform OIDC.',
      });
    }

    // Unclaimed checkout guests must complete the pay-first claim flow instead.
    if (!stored.user.passwordHash) {
      throw new ForbiddenException(
        'This account has not been activated yet. Use the claim link from your payment confirmation.',
      );
    }

    // Consume the token atomically so concurrent requests cannot both reset.
    const consumed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException('This reset link has already been used or expired.');
    }

    await this.prisma.user.update({
      where: { id: stored.user.id },
      data: { passwordHash: await hashPassword(dto.newPassword) },
    });

    // Invalidate every session — stolen tokens become useless after a reset.
    await this.prisma.refreshToken.updateMany({
      where: { userId: stored.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Password reset completed for user ${stored.user.id}`);
  }

  // ── Token issuance (Keycloak-claim-compatible for the existing frontend) ──
  private async issueTokenPair(user: {
    id: string; email: string; firstName: string | null;
    lastName: string | null; role: string;
 }): Promise<TokenPair> {
    const roles = expandRoles(user.role);
    const subscriptionStatus = await this.resolveSubscriptionStatus(user.id);
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        given_name: user.firstName ?? '',
        family_name: user.lastName ?? '',
        realm_access: { roles },
        subscriptionStatus,
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

  /**
   * Derives the client's subscription state for gating the web portal.
   * ACTIVE only when client.status is ACTIVE (set by paid activation) or an
   * active subscription exists. Falls back gracefully (undefined → the web
   * gate re-checks via GET /clients/me).
   */
  private async resolveSubscriptionStatus(userId: string): Promise<string | undefined> {
    try {
      const client = await this.prisma.client.findUnique({
        where: { userId },
        select: { status: true, subscriptions: { select: { status: true }, take: 5, orderBy: { createdAt: 'desc' } } },
      });
      if (!client) return undefined;
      if (client.status === 'ACTIVE') return 'ACTIVE';
      const sub = client.subscriptions.find(s => s.status === 'ACTIVE');
      return sub ? 'ACTIVE' : 'PENDING';
    } catch {
      return undefined;
    }
  }

  // ── Post-purchase account claiming (pay-first flow) ────────────────────────
  /**
   * Paid evidence lookup. A client is "paid" only if it has an ACTIVE
   * subscription or a recent PAID invoice. Guest checkouts create a TRIAL
   * client with no subscription, so they never pass this check before the
   * payment webhook settles.
   */
  private async loadPaidEvidence(email: string) {
    const client = await this.prisma.client.findUnique({
      where: { email },
      include: {
        subscriptions: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' }, take: 5 },
        invoices: {
          where: { status: 'PAID' },
          select: { id: true, paidAt: true },
          orderBy: { paidAt: 'desc' },
          take: 1,
        },
      },
    });

    const hasActiveStatus = client?.status === 'ACTIVE';
    const hasActiveSub = client?.subscriptions?.some(s => s.status === 'ACTIVE') ?? false;
    const hasPaidInvoice = (client?.invoices?.length ?? 0) > 0;
    const recentPaidInvoice =
      !!client?.invoices?.[0]?.paidAt &&
      Date.now() - client.invoices[0].paidAt.getTime() < 90 * 86_400_000;

    return { client, paid: !!client && (hasActiveStatus || hasActiveSub || hasPaidInvoice || recentPaidInvoice) };
  }

  /**
   * Step 1 of account claim: email a single-use claim link.
   *
   * Account claim is pay-first, but the billing email alone is not proof of
   * inbox ownership. Issuing a link to that address proves the claimant
   * controls it before any password is set. Unknown, unpaid, or already
   * claimed emails return the same empty shape (no enumeration).
   */
  async requestClaimLink(
    email: string,
    dispatchAuthorized = false,
  ): Promise<{
    claimToken: string;
    expiresIn: number;
    emailDispatched?: boolean;
    delivered?: boolean;
    provider?: string;
    message?: string;
  }> {
    const apiMailReady = Boolean(this.mailService?.isConfigured());
    if (!dispatchAuthorized && !apiMailReady) {
      return { claimToken: '', expiresIn: 0 };
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user || user.deletedAt) {
      return apiMailReady
        ? { claimToken: '', expiresIn: 0, emailDispatched: true, delivered: true }
        : { claimToken: '', expiresIn: 0 };
    }
    if (user.passwordHash) {
      if (!dispatchAuthorized && apiMailReady) {
        const magicRes = await this.requestMagicLink(cleanEmail, false);
        return {
          claimToken: '',
          expiresIn: 0,
          emailDispatched: true,
          delivered: magicRes.delivered,
          provider: magicRes.provider,
          message: magicRes.message,
        };
      }
      return { claimToken: '', expiresIn: 0 };
    }

    const { paid } = await this.loadPaidEvidence(cleanEmail);
    if (!paid) {
      return apiMailReady
        ? { claimToken: '', expiresIn: 0, emailDispatched: true, delivered: true }
        : { claimToken: '', expiresIn: 0 };
    }

    const rawToken = `${CLAIM_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });

    if (apiMailReady && this.mailService) {
      const origin = this.mailService.resolveFrontendOrigin();
      const claimLinkUrl = `${origin}/portal/claim?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(cleanEmail)}`;
      const sendResult = await this.mailService.sendClaimLinkEmail(cleanEmail, claimLinkUrl);
      return {
        claimToken: dispatchAuthorized ? rawToken : '',
        expiresIn: dispatchAuthorized ? 900 : 0,
        emailDispatched: true,
        delivered: sendResult.delivered,
        provider: sendResult.provider,
        message: sendResult.message,
      };
    }

    return { claimToken: rawToken, expiresIn: 900 };
  }

  /**
   * Step 2 of account claim: consume the emailed claim token, set the
   * password, and issue a real session. The token is single-use and bound to
   * the paid user; the password is never sent over email.
   */
  async claimAccount(dto: {
    email: string; password: string; claimToken: string;
    firstName?: string; lastName?: string; company?: string;
  }): Promise<TokenPair & { user: Record<string, unknown> }> {
    const email = dto.email.trim().toLowerCase();

    if (!dto.claimToken?.startsWith(CLAIM_TOKEN_PREFIX)) {
      throw new ForbiddenException(
        'Verify your email first. Open the claim link we sent to your billing address.',
      );
    }

    const tokenHash = createHash('sha256').update(dto.claimToken).digest('hex');
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
      throw new ForbiddenException('This claim link is invalid or has expired. Request a new one.');
    }
    if (stored.user.email !== email) {
      throw new ForbiddenException('This claim link was issued for a different email address.');
    }
    if (stored.user.passwordHash) {
      throw new ForbiddenException('This email already has an account. Please sign in instead.');
    }

    const { client, paid } = await this.loadPaidEvidence(email);
    if (!client || !paid) {
      throw new ForbiddenException(
        'No paid subscription found for this email yet. Your payment may still be settling — try again in a few minutes.',
      );
    }
    if (client.userId && client.userId !== stored.user.id) {
      throw new ForbiddenException('This client account is already linked to another user. Contact support.');
    }

    // Consume the token atomically so two tabs cannot both claim.
    const consumed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new ForbiddenException('This claim link has already been used. Request a new one.');
    }

    const existing = stored.user;
    const firstName = dto.firstName ?? existing.firstName;
    const lastName = dto.lastName ?? existing.lastName;

    await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await hashPassword(dto.password),
        firstName,
        lastName,
        role: existing.role === 'CLIENT' ? 'CLIENT' : existing.role,
      },
    });

    await this.prisma.client.update({
      where: { id: client.id },
      data: { userId: existing.id, status: 'ACTIVE' },
    });

    const tokens = await this.issueTokenPair({ ...existing, firstName, lastName });
    const userPayload = {
      id: existing.id,
      email,
      firstName,
      lastName,
      roles: expandRoles(existing.role),
      keycloakId: existing.keycloakId,
      subscriptionStatus: 'ACTIVE',
    };
    return {
      data: {
        ...tokens.data,
        user: userPayload,
      },
      user: userPayload,
    };
  }

  // ── Magic link (single-use DB-backed tokens reused from RefreshToken) ──────
  /**
   * Magic links are for accounts that have already been claimed. Passwordless
   * guest identities created at checkout must complete the email-verified
   * claim flow first — otherwise the billing email alone would be enough to
   * open a portal session.
   */
  private canUseMagicLink(user: {
    passwordHash: string | null;
    keycloakId: string | null;
    role: string;
  }): boolean {
    const isStaff = ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);
    const hasLocalPassword = !!user.passwordHash;
    const hasKeycloakIdentity =
      !!user.keycloakId && !user.keycloakId.startsWith('pending-');
    return isStaff || hasLocalPassword || hasKeycloakIdentity;
  }

  /** Issues a one-time, 15-minute login token ONLY for claimed accounts. */
  async requestMagicLink(
    email: string,
    dispatchAuthorized = false,
    redirect?: string,
  ): Promise<{
    magicToken: string;
    expiresIn: number;
    emailDispatched?: boolean;
    delivered?: boolean;
    provider?: string;
    message?: string;
  }> {
    if (this.isCustomerLocalAuthDisabled()) {
      throw new ForbiddenException({
        code: 'CUSTOMER_LOCAL_LOGIN_DISABLED',
        message: 'Customer magic-link sign-in is disabled. Sign in with Platform OIDC.',
      });
    }
    const apiMailReady = Boolean(this.mailService?.isConfigured());
    if (!dispatchAuthorized && !apiMailReady) {
      return { magicToken: '', expiresIn: 0 };
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
    // Silently no-op for unknown/unclaimed emails — the response shape stays
    // identical so the caller cannot distinguish "sent" from "not eligible".
    if (!user || user.deletedAt || !this.canUseMagicLink(user)) {
      return apiMailReady
        ? { magicToken: '', expiresIn: 0, emailDispatched: true, delivered: true }
        : { magicToken: '', expiresIn: 0 };
    }

    const rawToken = `${MAGIC_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });

    if (apiMailReady && this.mailService) {
      const origin = this.mailService.resolveFrontendOrigin();
      const safeRedirect = sanitizeRedirectPath(redirect);
      const params = new URLSearchParams({ token: rawToken });
      if (safeRedirect) {
        params.set('redirect', safeRedirect);
      }
      const magicLinkUrl = `${origin}/portal/login/verify?${params.toString()}`;
      const sendResult = await this.mailService.sendMagicLinkEmail(cleanEmail, magicLinkUrl);
      return {
        magicToken: dispatchAuthorized ? rawToken : '',
        expiresIn: dispatchAuthorized ? 900 : 0,
        emailDispatched: true,
        delivered: sendResult.delivered,
        provider: sendResult.provider,
        message: sendResult.message,
      };
    }

    return { magicToken: rawToken, expiresIn: 900 };
  }

  /** Consumes a single-use magic token and returns a real session. */
  async verifyMagicLink(magicToken: string): Promise<TokenPair & { user: Record<string, unknown> }> {
    if (!magicToken?.startsWith(MAGIC_TOKEN_PREFIX)) {
      throw new UnauthorizedException('This sign-in link is invalid or has expired.');
    }

    const tokenHash = createHash('sha256').update(magicToken).digest('hex');
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
      throw new UnauthorizedException('This sign-in link is invalid or has expired.');
    }

    // Defense in depth: revoke and reject tokens belonging to unclaimed guests.
    if (!this.canUseMagicLink(stored.user)) {
      await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ForbiddenException(
        'This sign-in link is only available after your account is claimed. Use the claim link from your payment confirmation.',
      );
    }

    const consumed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException('This sign-in link has already been used or expired.');
    }

    const user = stored.user;
    if (user.role === 'CLIENT' && this.isCustomerLocalAuthDisabled()) {
      throw new ForbiddenException({
        code: 'CUSTOMER_LOCAL_LOGIN_DISABLED',
        message: 'Customer local authentication is disabled; use Platform OIDC.',
      });
    }
    const subStatus = await this.resolveSubscriptionStatus(user.id);

    const tokens = await this.issueTokenPair({
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role,
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);

    const userPayload = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: expandRoles(user.role),
      keycloakId: user.keycloakId,
      subscriptionStatus: subStatus ?? 'PENDING',
    };

    return {
      data: {
        ...tokens.data,
        user: userPayload,
      },
      user: userPayload,
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

  // ── Audited 1-to-1 Platform OIDC (issuer, subject) Identity Bridge ───────

  private normalizeOidcIssuer(issuer: string): string {
    return (issuer || '').trim().replace(/\/+$/, '');
  }

  async resolveOidcIdentity(params: { issuer: string; subject: string }): Promise<
    | {
        linked: false;
        claimRequired: true;
        issuer: string;
        subject: string;
      }
    | {
        linked: true;
        claimRequired: false;
        issuer: string;
        subject: string;
        userId: string;
        clientId: string | null;
        role: string;
        roles: string[];
        email: string;
      }
  > {
    const cleanIssuer = this.normalizeOidcIssuer(params.issuer);
    const cleanSubject = (params.subject || '').trim();
    if (!cleanIssuer || !cleanSubject) {
      throw new BadRequestException('OIDC issuer and subject are required.');
    }

    const link = await (this.prisma as any).oidcIdentityLink.findUnique({
      where: {
        issuer_subject: { issuer: cleanIssuer, subject: cleanSubject },
      },
      include: {
        user: { include: { client: true } },
        client: true,
      },
    });

    if (!link || link.revokedAt || !link.user || link.user.deletedAt) {
      return {
        linked: false,
        claimRequired: true,
        issuer: cleanIssuer,
        subject: cleanSubject,
      };
    }

    return {
      linked: true,
      claimRequired: false,
      issuer: cleanIssuer,
      subject: cleanSubject,
      userId: link.userId,
      clientId: link.clientId ?? link.client?.id ?? link.user.client?.id ?? null,
      role: link.user.role,
      roles: expandRoles(link.user.role),
      email: link.user.email,
    };
  }

  async exchangeOidcCallback(dto: { issuer: string; subject: string; email?: string }) {
    const resolved = await this.resolveOidcIdentity({
      issuer: dto.issuer,
      subject: dto.subject,
    });

    await (this.prisma as any).auditLog
      ?.create?.({
        data: {
          userId: resolved.linked ? resolved.userId : null,
          action: resolved.linked
            ? 'auth.oidc_identity.exchanged'
            : 'auth.oidc_identity.claim_required',
          resourceType: 'OidcIdentityLink',
          resourceId: `${resolved.issuer}:${resolved.subject}`,
          newValue: {
            linked: resolved.linked,
            issuer: resolved.issuer,
            subject: resolved.subject,
            userId: resolved.linked ? resolved.userId : null,
            clientId: resolved.linked ? resolved.clientId : null,
          },
        },
      })
      ?.catch(() => undefined);

    return resolved;
  }

  async claimOidcAccount(
    dto: {
      issuer: string;
      subject: string;
      email: string;
      claimToken: string;
      firstName?: string;
      lastName?: string;
    },
    ipAddress?: string,
  ) {
    const cleanIssuer = this.normalizeOidcIssuer(dto.issuer);
    const cleanSubject = (dto.subject || '').trim();
    const cleanEmail = (dto.email || '').trim().toLowerCase();
    if (!cleanIssuer || !cleanSubject || !cleanEmail) {
      throw new BadRequestException('OIDC issuer, subject, and billing email are required.');
    }
    if (!dto.claimToken?.startsWith(CLAIM_TOKEN_PREFIX)) {
      throw new ForbiddenException(
        'Verify your billing inbox first with the claim link sent to your email.',
      );
    }

    const tokenHash = createHash('sha256').update(dto.claimToken).digest('hex');
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
      throw new ForbiddenException('This claim link is invalid or has expired. Request a new one.');
    }
    if (stored.user.email !== cleanEmail) {
      throw new ForbiddenException('This claim link was issued for a different email address.');
    }

    const { client, paid } = await this.loadPaidEvidence(cleanEmail);
    if (!client || !paid) {
      throw new ForbiddenException(
        'No paid subscription found for this email yet. Wait for payment settlement and retry.',
      );
    }
    if (client.userId && client.userId !== stored.user.id) {
      throw new ForbiddenException('This client account is already linked to another user.');
    }

    const linkResult = await this.prisma.$transaction(async (tx: any) => {
      const existingConflict = await tx.oidcIdentityLink.findFirst({
        where: {
          revokedAt: null,
          OR: [
            { issuer: cleanIssuer, subject: cleanSubject },
            { userId: stored.user.id },
            { clientId: client.id },
          ],
        },
      });
      if (existingConflict) {
        throw new ConflictException({
          code: 'OIDC_IDENTITY_ALREADY_LINKED',
          message:
            'This OIDC identity, user account, or client record is already linked 1-to-1.',
        });
      }

      const consumed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (consumed.count === 0) {
        throw new ForbiddenException('This claim link has already been used. Request a new one.');
      }

      const firstName = dto.firstName ?? stored.user.firstName;
      const lastName = dto.lastName ?? stored.user.lastName;
      await tx.user.update({
        where: { id: stored.user.id },
        data: {
          firstName,
          lastName,
          lastLoginAt: new Date(),
        },
      });

      await tx.client.update({
        where: { id: client.id },
        data: { userId: stored.user.id, status: 'ACTIVE' },
      });

      const createdLink = await tx.oidcIdentityLink.create({
        data: {
          issuer: cleanIssuer,
          subject: cleanSubject,
          userId: stored.user.id,
          clientId: client.id,
          email: cleanEmail,
          claimMethod: 'EXPLICIT_CLAIM_TOKEN',
          linkedBy: stored.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: stored.user.id,
          action: 'auth.oidc_identity.linked',
          resourceType: 'OidcIdentityLink',
          resourceId: createdLink.id,
          newValue: {
            issuer: cleanIssuer,
            subject: cleanSubject,
            userId: stored.user.id,
            clientId: client.id,
            email: cleanEmail,
            claimMethod: 'EXPLICIT_CLAIM_TOKEN',
          },
          ipAddress: ipAddress ?? null,
        },
      });

      return createdLink;
    });

    return {
      linked: true,
      claimRequired: false,
      linkId: linkResult.id,
      issuer: cleanIssuer,
      subject: cleanSubject,
      userId: stored.user.id,
      clientId: client.id,
      email: stored.user.email,
      role: stored.user.role,
      roles: expandRoles(stored.user.role),
    };
  }
}
