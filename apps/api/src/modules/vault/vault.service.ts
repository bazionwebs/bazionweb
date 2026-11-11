import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVaultSecretDto } from './dto/vault.dto';

const PUBLIC_SECRET_SELECT = {
  id: true,
  clientId: true,
  label: true,
  category: true,
  username: true,
  serviceUrl: true,
  maskedHint: true,
  notes: true,
  lastRevealedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function buildMaskedHint(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 6) {
    return '••••••••';
  }
  return `${trimmed.slice(0, 2)}••••••${trimmed.slice(-2)}`;
}

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);
  private derivedKey: Buffer | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getKey(): Buffer {
    if (this.derivedKey) return this.derivedKey;
    // Strictly require dedicated VAULT_MASTER_KEY. Eliminates JWT_SECRET fallback to enforce
    // cryptographic key separation between session signing and AES data-at-rest encryption.
    const masterKey = (this.config.get<string>('VAULT_MASTER_KEY') || '').trim();
    if (!masterKey || masterKey.length < 32) {
      throw new InternalServerErrorException(
        'VAULT_MASTER_KEY is not configured or insufficient (minimum 32 characters required). Dedicated vault key is strictly required.',
      );
    }
    this.derivedKey = scryptSync(masterKey, 'bazionweb-vault-aes256gcm-v1', 32);
    return this.derivedKey;
  }

  private encryptForClient(plaintext: string, clientId: string) {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(`client:${clientId}`, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      encryptedValue: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  private decryptForClient(encryptedValue: string, iv: string, authTag: string, clientId: string): string {
    const key = this.getKey();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(`client:${clientId}`, 'utf8'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private isStaff(user: any): boolean {
    return ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].some((r) => user?.roles?.includes(r));
  }

  private async resolveClient(user: any) {
    const client = await this.prisma.client.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true, businessName: true },
    });
    if (!client) {
      throw new ForbiddenException('No active client workspace found for this account.');
    }
    return client;
  }

  private async recordAudit(args: {
    userId?: string;
    action: string;
    resourceId: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.prisma.auditLog
      .create({
        data: {
          userId: args.userId ?? null,
          action: args.action,
          resourceType: 'VaultSecret',
          resourceId: args.resourceId,
          newValue: (args.metadata as any) ?? undefined,
          ipAddress: args.ipAddress ?? null,
          userAgent: args.userAgent ?? null,
        },
      })
      .catch((err: Error) => this.logger.warn(`Vault audit log write skipped: ${err.message}`));
  }

  async findAll(user: any, clientIdFilter?: string) {
    let targetClientId: string;
    if (this.isStaff(user) && clientIdFilter) {
      targetClientId = clientIdFilter;
    } else {
      const client = await this.resolveClient(user);
      targetClientId = client.id;
    }

    const secrets = await this.prisma.vaultSecret.findMany({
      where: { clientId: targetClientId, deletedAt: null },
      select: PUBLIC_SECRET_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return { data: secrets };
  }

  async create(
    dto: CreateVaultSecretDto,
    user: any,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const client = await this.resolveClient(user);
    const { encryptedValue, iv, authTag } = this.encryptForClient(dto.value, client.id);

    const created = await this.prisma.vaultSecret.create({
      data: {
        clientId: client.id,
        createdById: user.id,
        label: dto.label.trim(),
        category: (dto.category ?? 'OTHER') as any,
        username: dto.username?.trim() || null,
        serviceUrl: dto.serviceUrl?.trim() || null,
        encryptedValue,
        iv,
        authTag,
        maskedHint: buildMaskedHint(dto.value),
        notes: dto.notes?.trim() || null,
      },
      select: PUBLIC_SECRET_SELECT,
    });

    await this.recordAudit({
      userId: user.id,
      action: 'vault.secret_created',
      resourceId: created.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { clientId: client.id, label: created.label, category: created.category },
    });

    return { data: created };
  }

  async reveal(
    id: string,
    user: any,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const secret = await this.prisma.vaultSecret.findUnique({ where: { id } });
    if (!secret || secret.deletedAt) {
      throw new NotFoundException('Credential not found in vault.');
    }

    if (!this.isStaff(user)) {
      const client = await this.resolveClient(user);
      if (secret.clientId !== client.id) {
        throw new ForbiddenException('Access denied to this vault credential.');
      }
    }

    let plaintext: string;
    try {
      plaintext = this.decryptForClient(
        secret.encryptedValue,
        secret.iv,
        secret.authTag,
        secret.clientId,
      );
    } catch (err) {
      this.logger.error(`Vault GCM authentication failed for secret ${id}: ${err}`);
      throw new InternalServerErrorException('Credential integrity verification failed.');
    }

    const revealedAt = new Date();
    await this.prisma.vaultSecret.update({
      where: { id },
      data: { lastRevealedAt: revealedAt },
    });

    await this.recordAudit({
      userId: user.id,
      action: 'vault.secret_revealed',
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { clientId: secret.clientId, label: secret.label },
    });

    return {
      data: {
        id: secret.id,
        label: secret.label,
        value: plaintext,
        revealedAt: revealedAt.toISOString(),
      },
    };
  }

  async remove(
    id: string,
    user: any,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const secret = await this.prisma.vaultSecret.findUnique({ where: { id } });
    if (!secret || secret.deletedAt) {
      throw new NotFoundException('Credential not found in vault.');
    }

    if (!this.isStaff(user)) {
      const client = await this.resolveClient(user);
      if (secret.clientId !== client.id) {
        throw new ForbiddenException('Access denied to this vault credential.');
      }
    }

    await this.prisma.vaultSecret.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.recordAudit({
      userId: user.id,
      action: 'vault.secret_deleted',
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { clientId: secret.clientId, label: secret.label },
    });

    return { data: { id, deleted: true } };
  }
}

