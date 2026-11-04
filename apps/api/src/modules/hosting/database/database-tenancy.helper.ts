import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';

export type DatabaseEngineType = 'mariadb' | 'postgresql';

export interface TenantDatabaseConfig {
  databaseName: string;
  databaseUser: string;
  password: string;
  host: string;
  port: number;
  type: DatabaseEngineType;
  connectionString: string;
  provisioningSql: string;
  deprovisioningSql: string;
  isDedicated: boolean;
  dockerComposeService?: Record<string, any>;
}

export interface ProvisionDatabaseOptions {
  domain: string;
  clientId: string;
  hostingId?: string;
  plan?: string;
  type?: DatabaseEngineType;
  host?: string;
  port?: number;
  isDedicated?: boolean;
}

export class DatabaseTenancyHelper {
  /**
   * Sanitizes a raw domain or identifier into a safe SQL identifier compliant with
   * PostgreSQL (63 bytes) and MariaDB (64 characters).
   * Format: <prefix>_<slug>_<hex>
   */
  static sanitizeIdentifier(rawName: string, prefix: 'db' | 'usr', maxLen = 63): string {
    if (!rawName || typeof rawName !== 'string') {
      throw new BadRequestException('Cannot generate SQL identifier from empty input.');
    }

    // Extract core domain name before TLD
    let base = rawName.trim().toLowerCase();
    base = base.replace(/^[a-z]+:\/\//i, '');
    base = base.split('/')[0].split(':')[0];
    base = base.replace(/\.(co|com|net|org|edu|gov|ac|mil)\.[a-z]{2,}$/i, '');
    base = base.replace(/\.[a-z0-9-]+$/i, ''); // strip TLD
    base = base.replace(/[^a-z0-9_]/g, '_'); // convert hyphens, dots to underscore
    base = base.replace(/_+/g, '_'); // collapse consecutive underscores
    base = base.replace(/^_+|_+$/g, ''); // strip leading/trailing underscores

    if (!base) {
      base = 'tenant';
    }

    // Truncate base to ensure total length with prefix and hex suffix fits in maxLen
    // Prefix: 3-4 chars ("db_" or "usr_"), Hex: 7 chars ("_a1b2c3")
    const maxBaseLen = maxLen - (prefix.length + 1) - 7;
    const truncatedBase = base.slice(0, Math.max(4, maxBaseLen));

    const hexSuffix = crypto.randomBytes(3).toString('hex'); // 6 hex characters
    const identifier = `${prefix}_${truncatedBase}_${hexSuffix}`;

    return identifier;
  }

  /**
   * Generates a 28-character high-entropy cryptographic password composed of
   * URL-safe alphanumeric characters. Avoids URI-reserved characters (: @ / ? #).
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
   * Generates standard connection string for tenant database.
   */
  static generateConnectionString(params: {
    type: DatabaseEngineType;
    user: string;
    password: string;
    host: string;
    port: number;
    databaseName: string;
    isDedicated?: boolean;
  }): string {
    const { type, user, password, host, port, databaseName, isDedicated } = params;
    if (type === 'mariadb') {
      const ssl = isDedicated ? 'required' : 'preferred';
      return `mysql://${user}:${password}@${host}:${port}/${databaseName}?sslmode=${ssl}`;
    }
    // PostgreSQL
    const ssl = isDedicated ? 'require' : 'prefer';
    return `postgresql://${user}:${password}@${host}:${port}/${databaseName}?schema=public&sslmode=${ssl}`;
  }

  /**
   * Generates idempotent SQL provisioning script for shared multi-tenant database.
   */
  static generateProvisioningSql(params: {
    type: DatabaseEngineType;
    databaseName: string;
    databaseUser: string;
    password: string;
  }): string {
    const { type, databaseName, databaseUser, password } = params;

    if (type === 'mariadb') {
      return [
        `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
        `CREATE USER IF NOT EXISTS '${databaseUser}'@'%' IDENTIFIED BY '${password}';`,
        `GRANT ALL PRIVILEGES ON \`${databaseName}\`.* TO '${databaseUser}'@'%';`,
        `FLUSH PRIVILEGES;`,
      ].join('\n');
    }

    // PostgreSQL
    return [
      `CREATE DATABASE "${databaseName}" ENCODING 'UTF8';`,
      `CREATE USER "${databaseUser}" WITH ENCRYPTED PASSWORD '${password}';`,
      `GRANT ALL PRIVILEGES ON DATABASE "${databaseName}" TO "${databaseUser}";`,
      `REVOKE ALL ON DATABASE "${databaseName}" FROM PUBLIC;`,
    ].join('\n');
  }

  /**
   * Generates SQL deprovisioning script for tenant teardown.
   */
  static generateDeprovisioningSql(params: {
    type: DatabaseEngineType;
    databaseName: string;
    databaseUser: string;
  }): string {
    const { type, databaseName, databaseUser } = params;

    if (type === 'mariadb') {
      return [
        `REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${databaseUser}'@'%';`,
        `DROP USER IF EXISTS '${databaseUser}'@'%';`,
        `DROP DATABASE IF EXISTS \`${databaseName}\`;`,
        `FLUSH PRIVILEGES;`,
      ].join('\n');
    }

    // PostgreSQL
    return [
      `REVOKE ALL PRIVILEGES ON DATABASE "${databaseName}" FROM "${databaseUser}";`,
      `DROP DATABASE IF EXISTS "${databaseName}";`,
      `DROP USER IF EXISTS "${databaseUser}";`,
    ].join('\n');
  }

  /**
   * Master provisioning method: Assembles tenant database configuration for shared or dedicated tiers.
   */
  static provisionTenantDatabase(options: ProvisionDatabaseOptions): TenantDatabaseConfig {
    const type = options.type || 'postgresql';
    const plan = (options.plan || '').toLowerCase();
    const isDedicated = options.isDedicated ?? (plan.includes('cloud') || plan === 'host-cloud');

    const databaseName = this.sanitizeIdentifier(options.domain, 'db');
    const databaseUser = this.sanitizeIdentifier(options.domain, 'usr');
    const password = this.generateSecurePassword(28);

    const defaultPort = type === 'mariadb' ? 3306 : 5432;
    const defaultSharedHost = type === 'mariadb' ? 'shared-mariadb' : 'shared-postgres';

    let host = options.host || defaultSharedHost;
    let port = options.port || defaultPort;
    let dockerComposeService: Record<string, any> | undefined;

    if (isDedicated) {
      const containerName = `db-dedicated-${databaseName.replace(/^db_/, '')}`;
      host = options.host || containerName;
      port = options.port || defaultPort;

      dockerComposeService = {
        image: type === 'mariadb' ? 'mariadb:11-jammy' : 'postgres:16-alpine',
        container_name: containerName,
        environment:
          type === 'mariadb'
            ? {
                MARIADB_DATABASE: databaseName,
                MARIADB_USER: databaseUser,
                MARIADB_PASSWORD: password,
                MARIADB_ROOT_PASSWORD: this.generateSecurePassword(32),
              }
            : {
                POSTGRES_DB: databaseName,
                POSTGRES_USER: databaseUser,
                POSTGRES_PASSWORD: password,
                POSTGRES_INITDB_ARGS: '--encoding=UTF-8',
              },
        deploy: {
          resources: {
            limits: { cpus: '1.0', memory: '2048M' },
            reservations: { memory: '512M' },
          },
        },
        volumes: [`data_${databaseName}:/var/lib/${type === 'mariadb' ? 'mysql' : 'postgresql/data'}`],
        restart: 'unless-stopped',
      };
    }

    const connectionString = this.generateConnectionString({
      type,
      user: databaseUser,
      password,
      host,
      port,
      databaseName,
      isDedicated,
    });

    const provisioningSql = this.generateProvisioningSql({
      type,
      databaseName,
      databaseUser,
      password,
    });

    const deprovisioningSql = this.generateDeprovisioningSql({
      type,
      databaseName,
      databaseUser,
    });

    return {
      databaseName,
      databaseUser,
      password,
      host,
      port,
      type,
      connectionString,
      provisioningSql,
      deprovisioningSql,
      isDedicated,
      dockerComposeService,
    };
  }
}
