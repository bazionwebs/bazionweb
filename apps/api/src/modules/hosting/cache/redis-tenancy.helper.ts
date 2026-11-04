import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';

export interface TenantRedisConfig {
  host: string;
  port: number;
  keyPrefix: string;
  username?: string;
  password?: string;
  connectionString: string;
  aclUserCommand?: string;
  aclTeardownCommand?: string;
  isDedicated: boolean;
  dockerComposeService?: Record<string, any>;
}

export interface ProvisionRedisOptions {
  domain: string;
  clientId: string;
  hostingId?: string;
  plan?: string;
  host?: string;
  port?: number;
  isDedicated?: boolean;
}

export class RedisTenancyHelper {
  /**
   * Generates an isolated tenant key prefix formatted as `app:<slug>:`.
   */
  static generateTenantKeyPrefix(rawDomain: string): string {
    if (!rawDomain || typeof rawDomain !== 'string') {
      throw new BadRequestException('A valid domain is required to generate Redis tenant key prefix.');
    }
    let slug = rawDomain.trim().toLowerCase();
    slug = slug.replace(/^[a-z]+:\/\//i, '');
    slug = slug.split('/')[0].split(':')[0];
    slug = slug.replace(/\.(co|com|net|org|edu|gov|ac|mil)\.[a-z]{2,}$/i, '');
    slug = slug.replace(/\.[a-z0-9-]+$/i, ''); // strip TLD
    slug = slug.replace(/[^a-z0-9_]/g, '_');
    slug = slug.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    if (!slug) slug = 'tenant';
    return `app:${slug.slice(0, 20)}:`;
  }

  /**
   * Generates a 28-character alphanumeric secure password.
   */
  static generateSecurePassword(length = 28): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    return result;
  }

  /**
   * Generates Redis 6+ ACL command constraining user to their tenant key prefix
   * and revoking dangerous and administrative commands.
   */
  static generateAclCommand(username: string, password: string, keyPrefix: string): string {
    return `ACL SETUSER ${username} on >${password} ~${keyPrefix}* +@all -@dangerous -@admin +ping +select`;
  }

  /**
   * Generates ACL teardown command for cleanup.
   */
  static generateAclTeardownCommand(username: string): string {
    return `ACL DELUSER ${username}`;
  }

  /**
   * Generates Redis connection string.
   */
  static generateRedisConnectionString(params: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    keyPrefix?: string;
    isDedicated?: boolean;
  }): string {
    const { host, port, username, password, keyPrefix, isDedicated } = params;
    const authPart =
      username && password
        ? `${username}:${password}@`
        : password
          ? `:${password}@`
          : '';
    const queryPart = keyPrefix && !isDedicated ? `?keyPrefix=${encodeURIComponent(keyPrefix)}` : '';
    return `redis://${authPart}${host}:${port}/0${queryPart}`;
  }

  /**
   * Master provisioning method: Assembles tenant Redis configuration for shared or dedicated tiers.
   */
  static provisionTenantRedis(options: ProvisionRedisOptions): TenantRedisConfig {
    const plan = (options.plan || '').toLowerCase();
    const isDedicated = options.isDedicated ?? (plan.includes('cloud') || plan === 'host-cloud');

    const keyPrefix = this.generateTenantKeyPrefix(options.domain);
    const password = this.generateSecurePassword(28);
    const defaultPort = 6379;
    const defaultSharedHost = 'shared-redis';

    let host = options.host || defaultSharedHost;
    let port = options.port || defaultPort;
    let username: string | undefined;
    let aclUserCommand: string | undefined;
    let aclTeardownCommand: string | undefined;
    let dockerComposeService: Record<string, any> | undefined;

    if (isDedicated) {
      const containerName = `redis-dedicated-${keyPrefix.replace(/[^a-z0-9]/g, '')}`;
      host = options.host || containerName;
      port = options.port || defaultPort;

      dockerComposeService = {
        image: 'redis:7-alpine',
        container_name: containerName,
        command: `redis-server --requirepass ${password} --maxmemory 384mb --maxmemory-policy allkeys-lru`,
        deploy: {
          resources: {
            limits: { cpus: '0.5', memory: '512M' },
            reservations: { memory: '128M' },
          },
        },
        restart: 'unless-stopped',
      };
    } else {
      // Shared Redis: Generate ACL user scoped to keyPrefix
      const hex = crypto.randomBytes(3).toString('hex');
      const slug = keyPrefix.replace(/^app:|:$/g, '');
      username = `usr_${slug.slice(0, 16)}_${hex}`;
      aclUserCommand = this.generateAclCommand(username, password, keyPrefix);
      aclTeardownCommand = this.generateAclTeardownCommand(username);
    }

    const connectionString = this.generateRedisConnectionString({
      host,
      port,
      username,
      password,
      keyPrefix,
      isDedicated,
    });

    return {
      host,
      port,
      keyPrefix,
      username,
      password,
      connectionString,
      aclUserCommand,
      aclTeardownCommand,
      isDedicated,
      dockerComposeService,
    };
  }
}
