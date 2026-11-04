/**
 * Generic Deployment Provider Contract for Orchestrating Tenant Workloads.
 * Defines the strategy interface for PaaS container lifecycle management (Dokploy, etc.).
 */

export type WorkloadBuildType = 'dockerfile' | 'git' | 'compose' | 'image';

export type WorkloadStatusType =
  | 'PENDING'
  | 'PROVISIONING'
  | 'BUILDING'
  | 'RUNNING'
  | 'STOPPED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'DECOMMISSIONED';

export interface DeploymentResourceLimits {
  cpus?: number;
  memoryLimitMb?: number;
  memoryReservationMb?: number;
  memoryMb?: number;
}

export interface WorkloadConfig {
  name: string;
  projectName?: string;
  domain: string;
  clientId?: string;
  hostingId?: string;
  dockerImage?: string;
  buildPath?: string;
  repositoryUrl?: string;
  branch?: string;
  buildType?: WorkloadBuildType;
  env?: Record<string, string>;
  limits?: DeploymentResourceLimits;
  resourceLimits?: DeploymentResourceLimits;
  port?: number;
}

export type DeploymentConfig = WorkloadConfig;

export interface ProvisionResult {
  workloadId: string;
  applicationId?: string;
  projectId?: string;
  providerId?: string;
  domain: string;
  status: 'PENDING' | 'PROVISIONING' | 'RUNNING' | 'FAILED';
  url: string;
  externalUrl?: string;
  adminUrl?: string;
  metadata?: Record<string, any>;
  rawResponse?: Record<string, any>;
}

export interface WorkloadStatus {
  workloadId: string;
  applicationId?: string;
  status: WorkloadStatusType;
  health?: 'HEALTHY' | 'UNHEALTHY' | 'STARTING' | 'UNKNOWN';
  cpuUsagePercent?: number;
  memoryUsageMb?: number;
  uptimeSeconds?: number;
  lastDeploymentAt?: Date;
  updatedAt?: Date;
  details?: string;
}

export type DeploymentStatusResult = WorkloadStatus;

export interface DeploymentResult {
  deploymentId: string;
  applicationId?: string;
  workloadId?: string;
  status: 'QUEUED' | 'BUILDING' | 'SUCCESS' | 'FAILED' | string;
  startedAt?: Date;
}

export interface DomainBindingConfig {
  applicationId?: string;
  workloadId?: string;
  domain: string;
  port?: number;
  https?: boolean;
  certificateType?: 'letsencrypt' | 'custom' | 'none';
  pathPrefix?: string;
}

export interface DomainBindingResult {
  domainId: string;
  domain: string;
  sslActive: boolean;
  verified: boolean;
}

/**
 * Extensible Abstract Provider Class (usable directly as NestJS injection token).
 */
export abstract class DeploymentProvider {
  abstract readonly providerName: string;

  get name(): string {
    return this.providerName;
  }

  abstract isConfigured(): boolean;
  abstract createWorkload(config: WorkloadConfig): Promise<ProvisionResult>;
  abstract triggerDeployment(workloadId: string): Promise<DeploymentResult>;
  abstract setEnvironmentVariables(workloadId: string, env: Record<string, string>): Promise<boolean | void>;
  abstract bindDomain(
    workloadIdOrConfig: string | DomainBindingConfig,
    domain?: string,
    pathPrefix?: string,
  ): Promise<DomainBindingResult | boolean>;
  abstract getWorkloadStatus(workloadId: string): Promise<WorkloadStatus>;
  abstract getWorkloadLogs(workloadId: string, tailLines?: number): Promise<string[]>;
  abstract stopWorkload(workloadId: string): Promise<boolean | void>;
  abstract restartWorkload(workloadId: string): Promise<boolean | void>;
  abstract destroyWorkload(workloadId: string): Promise<boolean | void>;

  // Convenience aliases matching various consumer conventions
  async getStatus(workloadId: string): Promise<WorkloadStatus> {
    return this.getWorkloadStatus(workloadId);
  }

  async getLogs(workloadId: string, lines?: number): Promise<string[]> {
    return this.getWorkloadLogs(workloadId, lines);
  }
}
