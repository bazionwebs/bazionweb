import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { VaultService } from '../vault.service';
import { AuthService } from '../../auth/auth.service';
import { AuthMailService } from '../../auth/auth-mail.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('Empirical Adversarial Challenge: Milestone 1 Cryptographic Key Separation', () => {
  describe('VaultService Cryptographic Key Separation & Integrity Stress Tests', () => {
    let prismaMock: any;
    let storedSecretRow: any;
    const clientUser = { id: 'client-user-1', roles: ['CLIENT'] };
    const adminUser = { id: 'admin-user-1', roles: ['ADMIN'] };
    const reqMeta = { ipAddress: '10.0.0.1', userAgent: 'adversarial-tester' };

    beforeEach(() => {
      storedSecretRow = null;
      prismaMock = {
        client: {
          findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
            if (where.userId === 'client-user-1') return { id: 'client-tenant-1', businessName: 'Tenant 1' };
            if (where.userId === 'client-user-2') return { id: 'client-tenant-2', businessName: 'Tenant 2' };
            return null;
          }),
        },
        vaultSecret: {
          create: jest.fn().mockImplementation(async ({ data }: any) => {
            storedSecretRow = {
              id: 'sec-challenge-1',
              ...data,
              lastRevealedAt: null,
              deletedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return storedSecretRow;
          }),
          findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
            if (storedSecretRow && storedSecretRow.id === where.id) return storedSecretRow;
            return null;
          }),
          update: jest.fn().mockImplementation(async ({ data }: any) => {
            storedSecretRow = { ...storedSecretRow, ...data };
            return storedSecretRow;
          }),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
        },
      };
    });

    const createVaultServiceWithConfig = async (configValues: Record<string, string | undefined>) => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VaultService,
          { provide: PrismaService, useValue: prismaMock },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => configValues[key]),
            },
          },
        ],
      }).compile();
      return module.get<VaultService>(VaultService);
    };

    it('Scenario V1: Throws InternalServerErrorException when VAULT_MASTER_KEY is undefined even if JWT_SECRET is present', async () => {
      const vault = await createVaultServiceWithConfig({
        VAULT_MASTER_KEY: undefined,
        JWT_SECRET: 'super-long-jwt-secret-minimum-32-chars-legacy-fallback-attack',
      });

      await expect(
        vault.create(
          { label: 'Cloudflare API', category: 'API_KEY', value: 'secret-api-token-value' },
          clientUser,
          reqMeta,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('Scenario V2: Throws InternalServerErrorException when VAULT_MASTER_KEY is empty string or only whitespace', async () => {
      const vaultEmpty = await createVaultServiceWithConfig({
        VAULT_MASTER_KEY: '',
        JWT_SECRET: 'super-long-jwt-secret-minimum-32-chars-legacy-fallback-attack',
      });
      await expect(
        vaultEmpty.create({ label: 'Test', value: 'secret' }, clientUser, reqMeta),
      ).rejects.toThrow(InternalServerErrorException);

      const vaultWhitespace = await createVaultServiceWithConfig({
        VAULT_MASTER_KEY: '                       ',
        JWT_SECRET: 'super-long-jwt-secret-minimum-32-chars-legacy-fallback-attack',
      });
      await expect(
        vaultWhitespace.create({ label: 'Test', value: 'secret' }, clientUser, reqMeta),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('Scenario V3: Boundary test - 31 chars key is rejected, 32 chars key is accepted', async () => {
      // 31 characters: off-by-one boundary
      const key31 = '1234567890123456789012345678901';
      expect(key31.length).toBe(31);
      const vault31 = await createVaultServiceWithConfig({ VAULT_MASTER_KEY: key31 });
      await expect(
        vault31.create({ label: 'Boundary 31', value: 'secret' }, clientUser, reqMeta),
      ).rejects.toThrow(InternalServerErrorException);

      // 32 characters: exact threshold
      const key32 = '12345678901234567890123456789012';
      expect(key32.length).toBe(32);
      const vault32 = await createVaultServiceWithConfig({ VAULT_MASTER_KEY: key32 });
      const created = await vault32.create({ label: 'Boundary 32', value: 'my-secret-val' }, clientUser, reqMeta);
      expect(created.data.label).toBe('Boundary 32');
    });

    it('Scenario V4: Bit-flip / ciphertext corruption triggers GCM tag mismatch', async () => {
      const validKey = 'valid-32-byte-master-key-for-gcm-encryption-2026';
      const vault = await createVaultServiceWithConfig({ VAULT_MASTER_KEY: validKey });

      await vault.create({ label: 'Production DB', value: 'PostgresSecret123!' }, clientUser, reqMeta);

      // Verify normal decryption works
      const revealed = await vault.reveal('sec-challenge-1', clientUser, reqMeta);
      expect(revealed.data.value).toBe('PostgresSecret123!');

      // Adversarial tampering: flip a bit in the encryptedValue ciphertext
      const buf = Buffer.from(storedSecretRow.encryptedValue, 'base64');
      buf[0] ^= 0x01; // flip first bit
      storedSecretRow.encryptedValue = buf.toString('base64');

      // Must reject with integrity verification failure
      await expect(
        vault.reveal('sec-challenge-1', clientUser, reqMeta),
      ).rejects.toThrow('Credential integrity verification failed.');
    });

    it('Scenario V5: AuthTag corruption triggers GCM tag mismatch', async () => {
      const validKey = 'valid-32-byte-master-key-for-gcm-encryption-2026';
      const vault = await createVaultServiceWithConfig({ VAULT_MASTER_KEY: validKey });

      await vault.create({ label: 'Stripe Secret', value: 'sk_live_stripe_987654' }, clientUser, reqMeta);

      // Tamper with the authTag
      const tagBuf = Buffer.from(storedSecretRow.authTag, 'base64');
      tagBuf[tagBuf.length - 1] ^= 0xff;
      storedSecretRow.authTag = tagBuf.toString('base64');

      await expect(
        vault.reveal('sec-challenge-1', clientUser, reqMeta),
      ).rejects.toThrow('Credential integrity verification failed.');
    });

    it('Scenario V6: Cross-tenant isolation via AAD (Client B cannot decrypt Client A secret even with DB IDOR)', async () => {
      const validKey = 'valid-32-byte-master-key-for-gcm-encryption-2026';
      const vault = await createVaultServiceWithConfig({ VAULT_MASTER_KEY: validKey });

      // Created for client-tenant-1
      await vault.create({ label: 'Client 1 Secret', value: 'Tenant1PrivateData' }, clientUser, reqMeta);

      // Client 2 attempts to reveal via API -> ForbiddenException at resolution layer
      const client2User = { id: 'client-user-2', roles: ['CLIENT'] };
      await expect(
        vault.reveal('sec-challenge-1', client2User, reqMeta),
      ).rejects.toThrow(ForbiddenException);

      // Even if attacker tampers the DB record clientId to client-tenant-2 (simulating staff bypass or DB leak)
      storedSecretRow.clientId = 'client-tenant-2';
      // Staff reveal attempts decryption with AAD client:client-tenant-2 -> GCM authTag fails!
      await expect(
        vault.reveal('sec-challenge-1', adminUser, reqMeta),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('Scenario V7: Masked hint verification for short (<=6) and long (>6) secrets', async () => {
      const validKey = 'valid-32-byte-master-key-for-gcm-encryption-2026';
      const vault = await createVaultServiceWithConfig({ VAULT_MASTER_KEY: validKey });

      const shortSecret = await vault.create({ label: 'Short', value: '123456' }, clientUser, reqMeta);
      expect(shortSecret.data.maskedHint).toBe('••••••••');

      const longSecret = await vault.create({ label: 'Long', value: 'abcdefgh' }, clientUser, reqMeta);
      expect(longSecret.data.maskedHint).toBe('ab••••••gh');
    });
  });

  describe('AuthService canDispatchTokens & Secret Separation Stress Tests', () => {
    let authService: AuthService;

    const makeAuthWithSecrets = async (secrets: {
      INTERNAL_DISPATCH_SECRET?: string;
      PAYSTACK_SECRET_KEY?: string;
      JWT_SECRET?: string;
    }) => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          AuthMailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, fallback?: any) => {
                if (key in secrets) return (secrets as any)[key];
                if (key === 'AUTH_PROVIDER') return 'local';
                return fallback;
              }),
            },
          },
          { provide: PrismaService, useValue: {} },
        ],
      }).compile();
      return module.get<AuthService>(AuthService);
    };

    it('Scenario A1: Rejects undefined, null, empty string, and whitespace candidates', async () => {
      authService = await makeAuthWithSecrets({
        INTERNAL_DISPATCH_SECRET: 'super-secret-dispatch-key-2026',
      });

      expect(authService.canDispatchTokens(undefined)).toBe(false);
      expect(authService.canDispatchTokens('')).toBe(false);
      expect(authService.canDispatchTokens('   ')).toBe(false);
      expect(authService.canDispatchTokens('\t\n')).toBe(false);
    });

    it('Scenario A2: Strictly rejects PAYSTACK_SECRET_KEY when provided as dispatch token', async () => {
      const paystackKey = 'sk_live_paystack_secret_key_1234567890';
      authService = await makeAuthWithSecrets({
        INTERNAL_DISPATCH_SECRET: 'dedicated-dispatch-secret-2026',
        PAYSTACK_SECRET_KEY: paystackKey,
        JWT_SECRET: 'jwt-session-secret-key-minimum-32-bytes-long',
      });

      // Attacker attempts to use PAYSTACK_SECRET_KEY
      expect(authService.canDispatchTokens(paystackKey)).toBe(false);
    });

    it('Scenario A3: Strictly rejects JWT_SECRET when provided as dispatch token', async () => {
      const jwtKey = 'jwt-session-secret-key-minimum-32-bytes-long';
      authService = await makeAuthWithSecrets({
        INTERNAL_DISPATCH_SECRET: 'dedicated-dispatch-secret-2026',
        PAYSTACK_SECRET_KEY: 'sk_live_paystack_secret_key_1234567890',
        JWT_SECRET: jwtKey,
      });

      // Attacker attempts to use JWT_SECRET
      expect(authService.canDispatchTokens(jwtKey)).toBe(false);
    });

    it('Scenario A4: Rejects requests when INTERNAL_DISPATCH_SECRET is not configured or placeholder', async () => {
      // Missing
      const authMissing = await makeAuthWithSecrets({
        INTERNAL_DISPATCH_SECRET: undefined,
        PAYSTACK_SECRET_KEY: 'sk_live_123456',
        JWT_SECRET: 'jwt_secret_123456789012345678901234567890',
      });
      expect(authMissing.canDispatchTokens('sk_live_123456')).toBe(false);
      expect(authMissing.canDispatchTokens('any-token')).toBe(false);

      // CHANGE_ME placeholder
      const authPlaceholder = await makeAuthWithSecrets({
        INTERNAL_DISPATCH_SECRET: 'CHANGE_ME_DISPATCH_SECRET_LOCAL',
      });
      expect(authPlaceholder.canDispatchTokens('CHANGE_ME_DISPATCH_SECRET_LOCAL')).toBe(false);

      // Too short (< 12 chars)
      const authShort = await makeAuthWithSecrets({
        INTERNAL_DISPATCH_SECRET: 'short_key',
      });
      expect(authShort.canDispatchTokens('short_key')).toBe(false);
    });

    it('Scenario A5: Successfully validates dedicated INTERNAL_DISPATCH_SECRET and handles timing attacks cleanly', async () => {
      const validSecret = 'dedicated-bff-dispatch-secret-998877';
      authService = await makeAuthWithSecrets({
        INTERNAL_DISPATCH_SECRET: validSecret,
      });

      // Exact match passes
      expect(authService.canDispatchTokens(validSecret)).toBe(true);

      // Case mismatch fails
      expect(authService.canDispatchTokens('DEDICATED-bff-dispatch-secret-998877')).toBe(false);

      // Length mismatch does not throw TypeError in timingSafeEqual and fails safely
      expect(authService.canDispatchTokens('dedicated-bff-dispatch-secret-99887')).toBe(false);
      expect(authService.canDispatchTokens('dedicated-bff-dispatch-secret-99887711')).toBe(false);
      expect(authService.canDispatchTokens('X'.repeat(5000))).toBe(false);
    });
  });
});
