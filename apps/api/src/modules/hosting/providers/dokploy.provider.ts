import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  DeploymentProvider,
  WorkloadConfig,
  ProvisionResult,
  DeploymentResult,
  WorkloadStatus,
  WorkloadStatusType,
  DomainBindingConfig,
  DomainBindingResult,
} from './deployment-provider.interface';

/**
 * Formats an environment variable value for Dokploy / dotenv compliance.
 * Values containing newlines, carriage returns, hash symbols (#), double quotes,
 * or spaces/tabs are safely double-quoted with internal characters escaped.
 */
export function formatEnvValue(val: string): string {
  const str = String(val ?? '');
  if (
    str.includes('\n') ||
    str.includes('\r') ||
    str.includes('#') ||
    str.includes('"') ||
    str.includes(' ') ||
    str.includes('\t')
  ) {
    const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
    return `"${escaped}"`;
  }
  return str;
}

/**
 * Normalizes an application name into an RFC 1123 compliant slug for Docker containers
 * matching /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/ with safe length truncation.
 */
export function slugifyAppName(identifier: string): string {
  const rawIdentifier = String(identifier || Date.now());
  const sanitizedSlug = rawIdentifier
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '');
  return `bazion-${sanitizedSlug || Date.now()}`;
}

export const BUILD_TYPE_MAP: Record<string, string> = {
  git: 'dockerfile',
  dockerfile: 'dockerfile',
  compose: 'compose',
  image: 'docker',
  docker: 'docker',
};

@Injectable()
export class DokployProvider extends DeploymentProvider {
  readonly providerName = 'DokployProvider';
  private readonly logger = new Logger(DokployProvider.name);
  private readonly http: AxiosInstance;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    super();
    const baseURL = this.config.get<string>('DOKPLOY_API_URL', 'http://127.0.0.1:3000');
    const apiKey = this.config.get<string>('DOKPLOY_API_KEY', '');

    this.configured = Boolean(baseURL && apiKey);

    this.http = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // Transform raw axios errors into domain HttpExceptions
    this.http.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const data = error.response?.data as any;
        const msg = data?.message || data?.error || error.message;
        this.logger.error(`Dokploy API request failed [HTTP ${status}]: ${msg}`);
        return Promise.reject(new HttpException(`Dokploy Error: ${msg}`, status));
      },
    );
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Asserts that Dokploy provider has been initialized with valid credentials.
   * Throws HTTP 503 SERVICE_UNAVAILABLE if unconfigured.
   */
  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new HttpException('Dokploy provider is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Executes an operation with exponential backoff retry on transient errors
   * (HTTP 429, 502, 503, 504, or network timeouts).
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 2,
    baseDelayMs = 50,
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const status =
          err instanceof HttpException
            ? err.getStatus()
            : err?.response?.status || err?.status;

        const isTransient =
          status === HttpStatus.TOO_MANY_REQUESTS ||
          status === HttpStatus.BAD_GATEWAY ||
          status === HttpStatus.SERVICE_UNAVAILABLE ||
          status === HttpStatus.GATEWAY_TIMEOUT ||
          err?.code === 'ECONNABORTED' ||
          err?.code === 'ECONNRESET' ||
          err?.code === 'ETIMEDOUT' ||
          (err?.message && /timeout|network|econnrefused|503|502|504|429/i.test(err.message));

        if (!isTransient || attempt > maxRetries) {
          throw err;
        }

        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Transient error encountered (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${err.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Provisions a complete customer workload on Dokploy:
   * 1. Creates/verifies tenant project namespace.
   * 2. Registers application workload.
   * 3. Injects environment variables.
   * 4. Binds primary domain with Let's Encrypt SSL.
   * 5. Triggers first deployment.
   */
  async createWorkload(config: WorkloadConfig): Promise<ProvisionResult> {
    this.assertConfigured();

    let applicationId: string | undefined;

    try {
      const projectName =
        config.projectName ||
        (config.clientId ? `client-${config.clientId}` : `project-${config.name || 'default'}`);

      // 1. Ensure project namespace exists
      const projectId = await this.ensureProject(projectName);

      // PAYLOAD-04: Docker RFC 1123 / container name sanitization for appName
      const appName = slugifyAppName(config.hostingId || config.name || '');

      // PAYLOAD-05: Dynamic buildType mapping
      const resolvedBuildType =
        (config.buildType && BUILD_TYPE_MAP[config.buildType]) ||
        (config.dockerImage ? 'docker' : 'dockerfile');

      const resolvedSourceType =
        config.repositoryUrl
          ? 'git'
          : resolvedBuildType === 'docker' || config.dockerImage
            ? 'docker'
            : 'drop';

      // 2. Create the application entity
      const appPayload: Record<string, any> = {
        projectId,
        name: config.name || `app-${config.hostingId || Date.now()}`,
        appName,
        buildType: resolvedBuildType,
        sourceType: resolvedSourceType,
        repository: config.repositoryUrl,
        branch: config.branch || 'main',
        dockerfile: 'Dockerfile',
        autoDeploy: false,
      };

      if (config.dockerImage) {
        appPayload.dockerImage = config.dockerImage;
      }

      // PAYLOAD-06: Resource limits forwarding
      const limits = config.resourceLimits || config.limits;
      if (limits) {
        if (limits.cpus) {
          appPayload.cpuLimit = String(limits.cpus);
        }
        const memLimit = limits.memoryLimitMb || limits.memoryMb;
        if (memLimit) {
          appPayload.memoryLimit = `${memLimit}M`;
        }
        if (limits.memoryReservationMb) {
          appPayload.memoryReservation = `${limits.memoryReservationMb}M`;
        }
      }

      const createRes = await this.http.post('/api/application.create', appPayload);
      applicationId = createRes.data?.applicationId || createRes.data?.id;

      if (!applicationId) {
        throw new Error('Dokploy failed to return application ID');
      }

      // 3. Inject Environment Variables if specified
      if (config.env && Object.keys(config.env).length > 0) {
        await this.setEnvironmentVariables(applicationId, config.env);
      }

      // 4. Bind Primary Domain if specified
      if (config.domain) {
        await this.bindDomain({
          applicationId,
          domain: config.domain,
          port: config.port || 3000,
          https: true,
          certificateType: 'letsencrypt',
        });
      }

      // 5. Trigger First Deployment
      await this.triggerDeployment(applicationId);

      return {
        providerId: 'dokploy',
        workloadId: applicationId,
        applicationId,
        projectId,
        domain: config.domain,
        status: 'PENDING',
        url: `https://${config.domain}`,
        externalUrl: `https://${config.domain}`,
        rawResponse: createRes.data,
        metadata: {
          projectId,
          applicationId,
          projectName,
        },
      };
    } catch (err: any) {
      this.logger.error(`Failed to provision workload for domain ${config.domain}: ${err.message}`);
      // LIFECYCLE-02: Compensating rollback cleanup upon partial provisioning failure
      if (applicationId) {
        this.logger.warn(
          `Provisioning aborted for domain ${config.domain}. Cleaning up orphaned workload ${applicationId}`,
        );
        try {
          await this.destroyWorkload(applicationId);
        } catch (cleanupErr: any) {
          this.logger.error(
            `Compensating rollback failed for orphaned workload ${applicationId}: ${cleanupErr.message}`,
          );
        }
      }
      throw err;
    }
  }

  /**
   * Triggers an asynchronous build and deployment of the application.
   */
  async triggerDeployment(workloadId: string): Promise<DeploymentResult> {
    this.assertConfigured();
    const res = await this.withRetry(() =>
      this.http.post('/api/application.deploy', { applicationId: workloadId }),
    );
    return {
      deploymentId: res.data?.deploymentId || res.data?.id || 'unknown',
      applicationId: workloadId,
      workloadId,
      status: 'QUEUED',
      startedAt: new Date(),
    };
  }

  /**
   * Sets environment variables in Dokploy format (KEY=VALUE newline-delimited block).
   */
  async setEnvironmentVariables(workloadId: string, env: Record<string, string>): Promise<boolean> {
    this.assertConfigured();
    const envBlock = Object.entries(env)
      .map(([k, v]) => `${k}=${formatEnvValue(v)}`)
      .join('\n');

    await this.withRetry(() =>
      this.http.post('/api/application.saveEnvironment', {
        applicationId: workloadId,
        env: envBlock,
      }),
    );
    return true;
  }

  /**
   * Binds custom domain and configures Traefik router + Let's Encrypt SSL.
   */
  async bindDomain(
    workloadIdOrConfig: string | DomainBindingConfig,
    domain?: string,
    pathPrefix?: string,
  ): Promise<DomainBindingResult> {
    this.assertConfigured();

    const conf: DomainBindingConfig =
      typeof workloadIdOrConfig === 'string'
        ? {
            applicationId: workloadIdOrConfig,
            domain: domain!,
            pathPrefix: pathPrefix || '/',
            https: true,
            certificateType: 'letsencrypt',
          }
        : workloadIdOrConfig;

    const rawDomain = conf.domain || '';
    const cleanHost = rawDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .split(':')[0];

    const isHttps = conf.https ?? true;
    const certType = conf.certificateType || 'letsencrypt';
    const sslActive = Boolean(isHttps) && certType !== 'none';

    const payload = {
      applicationId: conf.applicationId || conf.workloadId,
      host: cleanHost,
      port: conf.port || 3000,
      https: isHttps,
      certificateType: certType,
      path: conf.pathPrefix || '/',
    };

    const res = await this.withRetry(() => this.http.post('/api/domain.create', payload));
    return {
      domainId: res.data?.domainId || res.data?.id || cleanHost,
      domain: cleanHost,
      sslActive,
      verified: true,
    };
  }

  /**
   * Polls Dokploy application status and translates into unified WorkloadStatus.
   */
  async getWorkloadStatus(workloadId: string): Promise<WorkloadStatus> {
    this.assertConfigured();

    const res = await this.withRetry(() =>
      this.http.get(`/api/application.one?applicationId=${workloadId}`),
    );
    const rawStatus = (res.data?.applicationStatus || res.data?.status || 'unknown').toLowerCase();

    let status: WorkloadStatusType = 'PENDING';
    let health: 'HEALTHY' | 'UNHEALTHY' | 'STARTING' | 'UNKNOWN' = 'UNKNOWN';

    switch (rawStatus) {
      case 'done':
      case 'running':
      case 'active':
        status = 'RUNNING';
        health = 'HEALTHY';
        break;
      case 'building':
      case 'deploying':
        status = 'BUILDING';
        health = 'STARTING';
        break;
      case 'error':
      case 'failed':
        status = 'FAILED';
        health = 'UNHEALTHY';
        break;
      case 'stopped':
      case 'idle':
        status = 'STOPPED';
        health = 'UNHEALTHY';
        break;
      default:
        status = 'PENDING';
        health = 'UNKNOWN';
    }

    return {
      workloadId,
      applicationId: workloadId,
      status,
      health,
      updatedAt: new Date(),
      details: res.data?.errorMessage || undefined,
      cpuUsagePercent: typeof res.data?.cpuUsage === 'number' ? res.data.cpuUsage : undefined,
      memoryUsageMb: typeof res.data?.memoryUsage === 'number' ? res.data.memoryUsage : undefined,
      uptimeSeconds: typeof res.data?.uptime === 'number' ? res.data.uptime : undefined,
    };
  }

  /**
   * Streams or fetches container deployment logs.
   */
  async getWorkloadLogs(workloadId: string, lines = 100): Promise<string[]> {
    this.assertConfigured();
    const res = await this.withRetry(() =>
      this.http.get(
        `/api/application.readLogs?applicationId=${workloadId}&lines=${lines}`,
      ),
    );
    if (Array.isArray(res.data?.logs)) {
      return res.data.logs;
    }
    if (typeof res.data?.logs === 'string') {
      return res.data.logs.split('\n');
    }
    return [];
  }

  /**
   * Stops container execution.
   */
  async stopWorkload(workloadId: string): Promise<boolean> {
    this.assertConfigured();
    await this.withRetry(() =>
      this.http.post('/api/application.stop', { applicationId: workloadId }),
    );
    return true;
  }

  /**
   * Restarts container execution.
   */
  async restartWorkload(workloadId: string): Promise<boolean> {
    this.assertConfigured();
    await this.withRetry(() =>
      this.http.post('/api/application.deploy', { applicationId: workloadId }),
    );
    return true;
  }

  /**
   * Permanently destroys the application container and Traefik routers.
   */
  async destroyWorkload(workloadId: string): Promise<boolean> {
    this.assertConfigured();
    await this.withRetry(() =>
      this.http.post('/api/application.delete', { applicationId: workloadId }),
    );
    return true;
  }

  /**
   * Internal helper: Verifies or creates a project namespace.
   */
  private async ensureProject(projectName: string): Promise<string> {
    try {
      const listRes = await this.withRetry(() => this.http.get('/api/project.all'));
      const existing = (listRes.data || []).find((p: any) => p.name === projectName);
      if (existing) {
        return existing.projectId || existing.id;
      }

      const createRes = await this.withRetry(() =>
        this.http.post('/api/project.create', {
          name: projectName,
          description: `Automated tenant namespace for ${projectName}`,
        }),
      );
      return createRes.data?.projectId || createRes.data?.id;
    } catch (err: any) {
      this.logger.warn(`Failed in ensureProject, attempting direct create: ${err.message}`);
      const fallback = await this.http.post('/api/project.create', { name: projectName });
      return fallback.data?.projectId || fallback.data?.id;
    }
  }
}
