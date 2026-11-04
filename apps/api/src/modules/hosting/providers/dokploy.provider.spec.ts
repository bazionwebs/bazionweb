import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { DokployProvider, formatEnvValue, slugifyAppName } from './dokploy.provider';
import { WorkloadConfig } from './deployment-provider.interface';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DokployProvider — Comprehensive Unit Test Suite', () => {
  let provider: DokployProvider;
  let mockHttpClient: {
    post: jest.Mock;
    get: jest.Mock;
    interceptors: { response: { use: jest.Mock } };
  };
  let responseInterceptorErrorHandler: (err: any) => Promise<never>;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'DOKPLOY_API_URL') return 'http://127.0.0.1:3000';
      if (key === 'DOKPLOY_API_KEY') return 'test-dokploy-secret-token-xyz';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockHttpClient = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn((successFn, errorFn) => {
            if (errorFn) responseInterceptorErrorHandler = errorFn;
          }),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockHttpClient as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DokployProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<DokployProvider>(DokployProvider);
  });

  describe('Initialization & Configuration Verification', () => {
    it('initializes axios client with correct baseURL and Authorization Bearer header', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://127.0.0.1:3000',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-dokploy-secret-token-xyz',
        },
      });
      expect(provider.isConfigured()).toBe(true);
      expect(provider.providerName).toBe('DokployProvider');
      expect(provider.name).toBe('DokployProvider');
    });

    it('reports isConfigured() = false when credentials are absent', async () => {
      const emptyConfig = { get: jest.fn().mockReturnValue('') };
      const module = await Test.createTestingModule({
        providers: [
          DokployProvider,
          { provide: ConfigService, useValue: emptyConfig },
        ],
      }).compile();
      const unconfigured = module.get<DokployProvider>(DokployProvider);
      expect(unconfigured.isConfigured()).toBe(false);
    });
  });

  describe('Workload Creation & Provisioning Workflow', () => {
    const validConfig: WorkloadConfig = {
      clientId: 'cli-12345',
      hostingId: 'hst-67890',
      name: 'Acacia Portal',
      domain: 'acacia.co.ke',
      repositoryUrl: 'https://github.com/bazionweb-clients/acacia',
      branch: 'main',
      buildType: 'git',
      port: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      resourceLimits: {
        cpus: 1.5,
        memoryLimitMb: 1024,
        memoryReservationMb: 512,
        memorySwapMb: 1024,
        pidsLimit: 150,
        restartPolicy: 'unless-stopped',
      },
    };

    it('executes full sequential provisioning: project -> app -> env -> domain -> deploy', async () => {
      // 1. Project listing & creation mock
      mockHttpClient.get.mockImplementation((url: string) => {
        if (url === '/api/project.all') {
          return Promise.resolve({ data: [] }); // None exists initially
        }
        return Promise.resolve({ data: {} });
      });

      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/project.create') {
          return Promise.resolve({ data: { projectId: 'proj-new-001' } });
        }
        if (url === '/api/application.create') {
          expect(payload.projectId).toBe('proj-new-001');
          expect(payload.repository).toBe(validConfig.repositoryUrl);
          expect(payload.branch).toBe('main');
          return Promise.resolve({ data: { applicationId: 'app-new-002' } });
        }
        if (url === '/api/application.saveEnvironment') {
          expect(payload.applicationId).toBe('app-new-002');
          expect(payload.env).toContain('NODE_ENV=production');
          expect(payload.env).toContain('PORT=3000');
          return Promise.resolve({ data: { success: true } });
        }
        if (url === '/api/domain.create') {
          expect(payload.applicationId).toBe('app-new-002');
          expect(payload.host).toBe('acacia.co.ke');
          expect(payload.https).toBe(true);
          expect(payload.certificateType).toBe('letsencrypt');
          return Promise.resolve({ data: { domainId: 'dom-003' } });
        }
        if (url === '/api/application.deploy') {
          expect(payload.applicationId).toBe('app-new-002');
          return Promise.resolve({ data: { deploymentId: 'dep-004' } });
        }
        return Promise.resolve({ data: {} });
      });

      const result = await provider.createWorkload(validConfig);

      expect(result).toEqual({
        providerId: 'dokploy',
        workloadId: 'app-new-002',
        applicationId: 'app-new-002',
        projectId: 'proj-new-001',
        domain: 'acacia.co.ke',
        status: 'PENDING',
        url: 'https://acacia.co.ke',
        externalUrl: 'https://acacia.co.ke',
        rawResponse: { applicationId: 'app-new-002' },
        metadata: {
          projectId: 'proj-new-001',
          applicationId: 'app-new-002',
          projectName: 'client-cli-12345',
        },
      });

      expect(mockHttpClient.post).toHaveBeenCalledTimes(5);
    });

    it('reuses existing project namespace if already present', async () => {
      mockHttpClient.get.mockImplementation((url: string) => {
        if (url === '/api/project.all') {
          return Promise.resolve({
            data: [{ name: 'client-cli-12345', projectId: 'proj-existing-999' }],
          });
        }
        return Promise.resolve({ data: {} });
      });

      mockHttpClient.post.mockResolvedValue({
        data: { applicationId: 'app-001', deploymentId: 'dep-001' },
      });

      await provider.createWorkload(validConfig);

      // Verify project.create was NOT called
      const calls = mockHttpClient.post.mock.calls.map((c) => c[0]);
      expect(calls).not.toContain('/api/project.create');
    });

    it('throws SERVICE_UNAVAILABLE error if provider is not configured', async () => {
      jest.spyOn(provider, 'isConfigured').mockReturnValue(false);
      await expect(provider.createWorkload(validConfig)).rejects.toThrow(HttpException);
    });

    it('throws error if Dokploy does not return an applicationId', async () => {
      mockHttpClient.get.mockResolvedValue({ data: [] });
      mockHttpClient.post.mockImplementation((url: string) => {
        if (url === '/api/project.create') {
          return Promise.resolve({ data: { projectId: 'proj-1' } });
        }
        if (url === '/api/application.create') {
          return Promise.resolve({ data: {} }); // Missing applicationId/id
        }
        return Promise.resolve({ data: {} });
      });

      await expect(provider.createWorkload(validConfig)).rejects.toThrow(
        'Dokploy failed to return application ID',
      );
    });
  });

  describe('Environment Variables & Domain Binding', () => {
    it('sets environment variables with newline-delimited formatting', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { success: true } });

      const success = await provider.setEnvironmentVariables('app-123', {
        NODE_ENV: 'production',
        PORT: '4000',
        DB_HOST: 'postgres',
      });

      expect(success).toBe(true);
      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/application.saveEnvironment', {
        applicationId: 'app-123',
        env: 'NODE_ENV=production\nPORT=4000\nDB_HOST=postgres',
      });
    });

    it('binds domain with configuration object', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { domainId: 'dom-999' } });

      const res = await provider.bindDomain({
        applicationId: 'app-123',
        domain: 'example.co.ke',
        port: 8080,
        https: true,
        certificateType: 'letsencrypt',
        pathPrefix: '/portal',
      });

      expect(res).toEqual({
        domainId: 'dom-999',
        domain: 'example.co.ke',
        sslActive: true,
        verified: true,
      });
      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/domain.create', {
        applicationId: 'app-123',
        host: 'example.co.ke',
        port: 8080,
        https: true,
        certificateType: 'letsencrypt',
        path: '/portal',
      });
    });

    it('binds domain with string parameters overload', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { domainId: 'dom-888' } });

      const res = await provider.bindDomain('app-456', 'sub.domain.ke', '/api');

      expect(res).toEqual({
        domainId: 'dom-888',
        domain: 'sub.domain.ke',
        sslActive: true,
        verified: true,
      });
      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/domain.create', {
        applicationId: 'app-456',
        host: 'sub.domain.ke',
        port: 3000,
        https: true,
        certificateType: 'letsencrypt',
        path: '/api',
      });
    });
  });

  describe('Status Translation & Health Mapping', () => {
    it('correctly maps Dokploy "done" or "running" status to RUNNING / HEALTHY', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { applicationStatus: 'done', cpuUsage: 12.5, memoryUsage: 256 },
      });

      const status = await provider.getWorkloadStatus('app-123');
      expect(status.status).toBe('RUNNING');
      expect(status.health).toBe('HEALTHY');
      expect(status.cpuUsagePercent).toBe(12.5);
      expect(status.memoryUsageMb).toBe(256);
    });

    it('correctly maps Dokploy "building" to BUILDING / STARTING', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { applicationStatus: 'building' },
      });

      const status = await provider.getStatus('app-123');
      expect(status.status).toBe('BUILDING');
      expect(status.health).toBe('STARTING');
    });

    it('correctly maps Dokploy "error" to FAILED / UNHEALTHY', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: {
          applicationStatus: 'error',
          errorMessage: 'Container exited with code 137 (OOMKilled)',
        },
      });

      const status = await provider.getStatus('app-123');
      expect(status.status).toBe('FAILED');
      expect(status.health).toBe('UNHEALTHY');
      expect(status.details).toContain('OOMKilled');
    });

    it('correctly maps Dokploy "stopped" to STOPPED / UNHEALTHY', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { applicationStatus: 'stopped' },
      });

      const status = await provider.getWorkloadStatus('app-123');
      expect(status.status).toBe('STOPPED');
      expect(status.health).toBe('UNHEALTHY');
    });

    it('maps unknown status to PENDING / UNKNOWN', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { applicationStatus: 'unrecognized_state' },
      });

      const status = await provider.getWorkloadStatus('app-123');
      expect(status.status).toBe('PENDING');
      expect(status.health).toBe('UNKNOWN');
    });
  });

  describe('Log Retrieval & Lifecycle Controls', () => {
    it('fetches and splits log lines properly when received as string', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { logs: 'Server listening on :3000\nDatabase connected\nReady.' },
      });

      const lines = await provider.getLogs('app-123', 50);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Server listening on :3000');
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/api/application.readLogs?applicationId=app-123&lines=50',
      );
    });

    it('returns logs as array directly when returned as array', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { logs: ['Log line 1', 'Log line 2'] },
      });

      const lines = await provider.getWorkloadLogs('app-123');
      expect(lines).toEqual(['Log line 1', 'Log line 2']);
    });

    it('returns empty array when logs are null or unexpected type', async () => {
      mockHttpClient.get.mockResolvedValue({ data: {} });
      const lines = await provider.getWorkloadLogs('app-123');
      expect(lines).toEqual([]);
    });

    it('stops, restarts and destroys workloads cleanly', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { success: true } });

      await provider.stopWorkload('app-123');
      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/application.stop', {
        applicationId: 'app-123',
      });

      await provider.restartWorkload('app-123');
      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/application.deploy', {
        applicationId: 'app-123',
      });

      await provider.destroyWorkload('app-123');
      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/application.delete', {
        applicationId: 'app-123',
      });
    });
  });

  describe('Axios Response Interceptor Error Handling', () => {
    it('transforms axios error into HttpException with status and message', async () => {
      expect(responseInterceptorErrorHandler).toBeDefined();

      const axiosError: any = {
        message: 'Request failed',
        response: {
          status: HttpStatus.BAD_REQUEST,
          data: { message: 'Invalid domain specification' },
        },
      };

      await expect(responseInterceptorErrorHandler(axiosError)).rejects.toThrow(HttpException);
      try {
        await responseInterceptorErrorHandler(axiosError);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.message).toContain('Invalid domain specification');
      }
    });

    it('defaults to 500 when response status is missing', async () => {
      const networkError: any = {
        message: 'Network error ECONNREFUSED',
      };

      try {
        await responseInterceptorErrorHandler(networkError);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(err.message).toContain('ECONNREFUSED');
      }
    });
  });

  describe('PAYLOAD-01 & PAYLOAD-02: Multiline & Special Character Environment Variable Formatting', () => {
    it('safely quotes and escapes multiline strings (RSA keys, PEM certificates)', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { success: true } });

      const rsaKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
      const success = await provider.setEnvironmentVariables('app-123', {
        PRIVATE_KEY: rsaKey,
        PORT: '3000',
      });

      expect(success).toBe(true);
      const callArgs = mockHttpClient.post.mock.calls.find(
        (c) => c[0] === '/api/application.saveEnvironment',
      );
      expect(callArgs).toBeDefined();
      const calledEnv = callArgs[1].env;

      expect(calledEnv).toContain(
        'PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA...\\n-----END RSA PRIVATE KEY-----"',
      );
      expect(calledEnv).toContain('PORT=3000');

      // Verify no unkeyed raw lines exist
      const lines = calledEnv.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines.every((l: string) => l.includes('='))).toBe(true);
    });

    it('encloses secrets containing hash symbols (#) in double quotes to prevent comment truncation', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { success: true } });

      await provider.setEnvironmentVariables('app-123', {
        DB_PASSWORD: 'secret#123@hash_val',
        SAFE_VAL: 'no_hash_here',
      });

      const callArgs = mockHttpClient.post.mock.calls.find(
        (c) => c[0] === '/api/application.saveEnvironment',
      );
      const calledEnv = callArgs[1].env;
      expect(calledEnv).toContain('DB_PASSWORD="secret#123@hash_val"');
      expect(calledEnv).toContain('SAFE_VAL=no_hash_here');
    });

    it('quotes strings containing spaces, tabs, double quotes, and backslashes', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { success: true } });

      await provider.setEnvironmentVariables('app-123', {
        APP_NAME: 'Acacia Health Portal',
        JSON_CONFIG: '{"key":"value with space and \\"quotes\\""}',
        TABBED: 'first\tsecond',
      });

      const callArgs = mockHttpClient.post.mock.calls.find(
        (c) => c[0] === '/api/application.saveEnvironment',
      );
      const calledEnv = callArgs[1].env;
      expect(calledEnv).toContain('APP_NAME="Acacia Health Portal"');
      expect(calledEnv).toContain(
        'JSON_CONFIG="{\\"key\\":\\"value with space and \\\\\\"quotes\\\\\\"\\"}"',
      );
      expect(calledEnv).toContain('TABBED="first\tsecond"');
    });

    it('preserves URLs and Base64 tokens with equals signs intact without unnecessary quotes', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { success: true } });

      await provider.setEnvironmentVariables('app-123', {
        DATABASE_URL: 'postgresql://user:p=assword@host:5432/db?sslmode=require&pool=5',
        BASE64_TOKEN: 'eyJhbGciOiJIUzI1NiJ9==',
      });

      const callArgs = mockHttpClient.post.mock.calls.find(
        (c) => c[0] === '/api/application.saveEnvironment',
      );
      const calledEnv = callArgs[1].env;
      expect(calledEnv).toContain(
        'DATABASE_URL=postgresql://user:p=assword@host:5432/db?sslmode=require&pool=5',
      );
      expect(calledEnv).toContain('BASE64_TOKEN=eyJhbGciOiJIUzI1NiJ9==');
    });

    it('injects properly escaped multiline and hashed environment variables during createWorkload workflow', async () => {
      mockHttpClient.get.mockResolvedValue({ data: [{ name: 'project-default', id: 'proj-1' }] });
      mockHttpClient.post.mockResolvedValue({
        data: { applicationId: 'app-env-1', domainId: 'dom-1', deploymentId: 'dep-1' },
      });

      const rsaKey = '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAP...\n-----END CERTIFICATE-----';
      await provider.createWorkload({
        name: 'env-test-workload',
        domain: 'env.acacia.co.ke',
        env: {
          TLS_CERT: rsaKey,
          API_SECRET: 'alpha#beta$123',
          PORT: '8080',
        },
        resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
      });

      const envCall = mockHttpClient.post.mock.calls.find(
        (call) => call[0] === '/api/application.saveEnvironment',
      );
      expect(envCall).toBeDefined();
      expect(envCall[1].env).toContain(
        'TLS_CERT="-----BEGIN CERTIFICATE-----\\nMIIDXTCCAkWgAwIBAgIJAP...\\n-----END CERTIFICATE-----"',
      );
      expect(envCall[1].env).toContain('API_SECRET="alpha#beta$123"');
      expect(envCall[1].env).toContain('PORT=8080');
    });

    it('formatEnvValue helper directly formats correctly across edge cases', () => {
      expect(formatEnvValue('clean')).toBe('clean');
      expect(formatEnvValue('with space')).toBe('"with space"');
      expect(formatEnvValue('with#hash')).toBe('"with#hash"');
      expect(formatEnvValue('line1\nline2')).toBe('"line1\\nline2"');
      expect(formatEnvValue('quote"inside')).toBe('"quote\\"inside"');
    });
  });

  describe('PAYLOAD-04: appName RFC 1123 & Container Name Sanitization', () => {
    beforeEach(() => {
      mockHttpClient.get.mockResolvedValue({ data: [{ name: 'project-default', projectId: 'p1' }] });
      mockHttpClient.post.mockResolvedValue({
        data: { applicationId: 'app-clean-01', domainId: 'dom-1', deploymentId: 'dep-1' },
      });
    });

    it('sanitizes appName to RFC 1123 compliant slug when name contains spaces, uppercase, and special chars', async () => {
      let capturedPayload: any = null;
      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/application.create') {
          capturedPayload = payload;
          return Promise.resolve({ data: { applicationId: 'app-clean-01' } });
        }
        return Promise.resolve({ data: {} });
      });

      await provider.createWorkload({
        name: 'Acacia Health & Diagnostic Center (HQ)!',
        domain: 'acacia.co.ke',
        resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
      });

      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.appName).toBe('bazion-acacia-health-diagnostic-center-hq');
      expect(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(capturedPayload.appName)).toBe(true);
    });

    it('strips leading/trailing hyphens and collapses repetitive special characters', async () => {
      let capturedPayload: any = null;
      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/application.create') {
          capturedPayload = payload;
          return Promise.resolve({ data: { applicationId: 'app-clean-02' } });
        }
        return Promise.resolve({ data: {} });
      });

      await provider.createWorkload({
        name: '---###Super___App$$$---',
        domain: 'superapp.co.ke',
        resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
      });

      expect(capturedPayload.appName).toBe('bazion-super-app');
      expect(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(capturedPayload.appName)).toBe(true);
    });

    it('falls back to numeric timestamp when name contains only non-alphanumeric characters', async () => {
      let capturedPayload: any = null;
      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/application.create') {
          capturedPayload = payload;
          return Promise.resolve({ data: { applicationId: 'app-clean-03' } });
        }
        return Promise.resolve({ data: {} });
      });

      await provider.createWorkload({
        name: '@@@$$$%%%^^^',
        domain: 'fallback.co.ke',
        resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
      });

      expect(capturedPayload.appName).toMatch(/^bazion-\d+$/);
      expect(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(capturedPayload.appName)).toBe(true);
    });

    it('slugifyAppName helper produces valid RFC 1123 names directly', () => {
      expect(slugifyAppName('My Cool App!')).toBe('bazion-my-cool-app');
      expect(slugifyAppName('user_123-service')).toBe('bazion-user-123-service');
      expect(slugifyAppName('---')).toMatch(/^bazion-\d+$/);
    });
  });

  describe('PAYLOAD-05: Workload buildType Mapping in createWorkload()', () => {
    beforeEach(() => {
      mockHttpClient.get.mockResolvedValue({ data: [{ name: 'project-default', id: 'proj-1' }] });
      mockHttpClient.post.mockResolvedValue({
        data: { applicationId: 'app-test', domainId: 'dom-1', deploymentId: 'dep-1' },
      });
    });

    it('supports "compose" buildType for Docker Compose workloads', async () => {
      await provider.createWorkload({
        name: 'compose-service',
        domain: 'compose.bazion.ke',
        buildType: 'compose',
        resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
      });

      const appCreateCall = mockHttpClient.post.mock.calls.find(
        (call) => call[0] === '/api/application.create',
      );
      expect(appCreateCall).toBeDefined();
      expect(appCreateCall[1].buildType).toBe('compose');
    });

    it('supports "image" buildType and forwards dockerImage in payload', async () => {
      await provider.createWorkload({
        name: 'image-service',
        domain: 'image.bazion.ke',
        buildType: 'image',
        dockerImage: 'redis:7-alpine',
        resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
      });

      const appCreateCall = mockHttpClient.post.mock.calls.find(
        (call) => call[0] === '/api/application.create',
      );
      expect(appCreateCall).toBeDefined();
      expect(appCreateCall[1].buildType).toBe('docker');
      expect(appCreateCall[1].dockerImage).toBe('redis:7-alpine');
      expect(appCreateCall[1].sourceType).toBe('docker');
    });

    it('supports explicit "dockerfile" buildType', async () => {
      await provider.createWorkload({
        name: 'dockerfile-service',
        domain: 'dockerfile.bazion.ke',
        buildType: 'dockerfile',
        repositoryUrl: 'https://github.com/bazionweb/custom-app',
        resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
      });

      const appCreateCall = mockHttpClient.post.mock.calls.find(
        (call) => call[0] === '/api/application.create',
      );
      expect(appCreateCall).toBeDefined();
      expect(appCreateCall[1].buildType).toBe('dockerfile');
    });

    it('maps legacy "git" buildType to "dockerfile"', async () => {
      await provider.createWorkload({
        name: 'git-service',
        domain: 'git.bazion.ke',
        buildType: 'git',
        repositoryUrl: 'https://github.com/bazionweb/custom-app',
        resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
      });

      const appCreateCall = mockHttpClient.post.mock.calls.find(
        (call) => call[0] === '/api/application.create',
      );
      expect(appCreateCall).toBeDefined();
      expect(appCreateCall[1].buildType).toBe('dockerfile');
    });

    it('infers "docker" buildType when dockerImage is provided without buildType', async () => {
      await provider.createWorkload({
        name: 'inferred-image-service',
        domain: 'inferred.bazion.ke',
        dockerImage: 'postgres:16-alpine',
        resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
      });

      const appCreateCall = mockHttpClient.post.mock.calls.find(
        (call) => call[0] === '/api/application.create',
      );
      expect(appCreateCall).toBeDefined();
      expect(appCreateCall[1].buildType).toBe('docker');
      expect(appCreateCall[1].dockerImage).toBe('postgres:16-alpine');
      expect(appCreateCall[1].sourceType).toBe('docker');
    });
  });

  describe('PAYLOAD-06: Resource Limits Forwarding', () => {
    beforeEach(() => {
      mockHttpClient.get.mockResolvedValue({ data: [{ name: 'project-default', projectId: 'p1' }] });
      mockHttpClient.post.mockResolvedValue({
        data: { applicationId: 'app-limits', domainId: 'dom-1', deploymentId: 'dep-1' },
      });
    });

    it('forwards resourceLimits (cpus, memoryLimitMb, memoryReservationMb) into appPayload', async () => {
      let capturedPayload: any = null;
      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/application.create') {
          capturedPayload = payload;
          return Promise.resolve({ data: { applicationId: 'app-limits-01' } });
        }
        return Promise.resolve({ data: {} });
      });

      await provider.createWorkload({
        name: 'app-with-quotas',
        domain: 'quotas.co.ke',
        resourceLimits: {
          cpus: 1.5,
          memoryLimitMb: 1024,
          memoryReservationMb: 512,
        },
      });

      expect(capturedPayload.cpuLimit).toBe('1.5');
      expect(capturedPayload.memoryLimit).toBe('1024M');
      expect(capturedPayload.memoryReservation).toBe('512M');
    });

    it('supports limits alias and memoryMb fallback correctly', async () => {
      let capturedPayload: any = null;
      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/application.create') {
          capturedPayload = payload;
          return Promise.resolve({ data: { applicationId: 'app-limits-02' } });
        }
        return Promise.resolve({ data: {} });
      });

      await provider.createWorkload({
        name: 'app-with-alias',
        domain: 'alias.co.ke',
        limits: {
          cpus: 0.5,
          memoryMb: 256,
        },
      });

      expect(capturedPayload.cpuLimit).toBe('0.5');
      expect(capturedPayload.memoryLimit).toBe('256M');
      expect(capturedPayload.memoryReservation).toBeUndefined();
    });

    it('rejects unconstrained container allocations when resource limits are undefined', async () => {
      // 1. Missing entirely
      await expect(
        provider.createWorkload({
          name: 'app-no-limits',
          domain: 'nolimits.co.ke',
        }),
      ).rejects.toThrow(BadRequestException);

      // 2. Explicitly undefined resourceLimits
      await expect(
        provider.createWorkload({
          name: 'app-undef-resource-limits',
          domain: 'undef-rl.co.ke',
          resourceLimits: undefined,
        }),
      ).rejects.toThrow(BadRequestException);

      // 3. Explicitly undefined limits alias
      await expect(
        provider.createWorkload({
          name: 'app-undef-limits',
          domain: 'undef-l.co.ke',
          limits: undefined,
        }),
      ).rejects.toThrow(BadRequestException);

      // 4. Empty limits object
      await expect(
        provider.createWorkload({
          name: 'app-empty-limits',
          domain: 'empty-limits.co.ke',
          resourceLimits: {} as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unconstrained container allocations when only cpus is provided (missing memory)', async () => {
      // With resourceLimits
      await expect(
        provider.createWorkload({
          name: 'app-only-cpus-rl',
          domain: 'onlycpus-rl.co.ke',
          resourceLimits: {
            cpus: 1.5,
          } as any,
        }),
      ).rejects.toThrow(BadRequestException);

      // With limits alias
      await expect(
        provider.createWorkload({
          name: 'app-only-cpus-alias',
          domain: 'onlycpus-alias.co.ke',
          limits: {
            cpus: 2.0,
          } as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unconstrained container allocations when only memory is provided (missing cpus)', async () => {
      // With memoryLimitMb
      await expect(
        provider.createWorkload({
          name: 'app-only-mem-limit',
          domain: 'onlymem-limit.co.ke',
          resourceLimits: {
            memoryLimitMb: 1024,
          } as any,
        }),
      ).rejects.toThrow(BadRequestException);

      // With memoryMb fallback alias
      await expect(
        provider.createWorkload({
          name: 'app-only-mem-alias',
          domain: 'onlymem-alias.co.ke',
          limits: {
            memoryMb: 512,
          } as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects allocation when cpus <= 0 or memory <= 0', async () => {
      // cpus = 0
      await expect(
        provider.createWorkload({
          name: 'app-zero-cpu',
          domain: 'zerocpu.co.ke',
          resourceLimits: {
            cpus: 0,
            memoryLimitMb: 1024,
          },
        }),
      ).rejects.toThrow(BadRequestException);

      // cpus < 0
      await expect(
        provider.createWorkload({
          name: 'app-negative-cpu',
          domain: 'negcpu.co.ke',
          resourceLimits: {
            cpus: -1,
            memoryLimitMb: 1024,
          },
        }),
      ).rejects.toThrow(BadRequestException);

      // memoryLimitMb = 0
      await expect(
        provider.createWorkload({
          name: 'app-zero-mem',
          domain: 'zeromem.co.ke',
          resourceLimits: {
            cpus: 1.0,
            memoryLimitMb: 0,
          },
        }),
      ).rejects.toThrow(BadRequestException);

      // memoryLimitMb < 0
      await expect(
        provider.createWorkload({
          name: 'app-negative-mem',
          domain: 'negmem.co.ke',
          resourceLimits: {
            cpus: 1.0,
            memoryLimitMb: -512,
          },
        }),
      ).rejects.toThrow(BadRequestException);

      // memoryMb alias <= 0
      await expect(
        provider.createWorkload({
          name: 'app-negative-mem-alias',
          domain: 'negmem-alias.co.ke',
          limits: {
            cpus: 1.0,
            memoryMb: -256,
          },
        }),
      ).rejects.toThrow(BadRequestException);

      // Both cpus and memory <= 0
      await expect(
        provider.createWorkload({
          name: 'app-both-negative',
          domain: 'bothneg.co.ke',
          resourceLimits: {
            cpus: -1,
            memoryLimitMb: -512,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects allocation when cpus or memory are NaN or non-numeric', async () => {
      // NaN cpus
      await expect(
        provider.createWorkload({
          name: 'app-nan-cpu',
          domain: 'nancpu.co.ke',
          resourceLimits: {
            cpus: NaN,
            memoryLimitMb: 1024,
          } as any,
        }),
      ).rejects.toThrow(BadRequestException);

      // NaN memory
      await expect(
        provider.createWorkload({
          name: 'app-nan-mem',
          domain: 'nanmem.co.ke',
          resourceLimits: {
            cpus: 1.0,
            memoryLimitMb: NaN,
          } as any,
        }),
      ).rejects.toThrow(BadRequestException);

      // String limits
      await expect(
        provider.createWorkload({
          name: 'app-string-limits',
          domain: 'stringlimits.co.ke',
          resourceLimits: {
            cpus: '1.5' as any,
            memoryLimitMb: '1024' as any,
          } as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('forwards memorySwapMb, pidsLimit, and restartPolicy into appPayload', async () => {
      let capturedPayload: any = null;
      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/application.create') {
          capturedPayload = payload;
          return Promise.resolve({ data: { applicationId: 'app-limits-04' } });
        }
        return Promise.resolve({ data: {} });
      });

      await provider.createWorkload({
        name: 'app-with-full-cgroups',
        domain: 'cgroups.co.ke',
        resourceLimits: {
          cpus: 2.0,
          memoryLimitMb: 2048,
          memoryReservationMb: 1024,
          memorySwapMb: 2048,
          pidsLimit: 250,
          restartPolicy: 'unless-stopped',
        },
      });

      expect(capturedPayload.cpuLimit).toBe('2');
      expect(capturedPayload.memoryLimit).toBe('2048M');
      expect(capturedPayload.memoryReservation).toBe('1024M');
      expect(capturedPayload.memorySwap).toBe('2048M');
      expect(capturedPayload.pidsLimit).toBe(250);
      expect(capturedPayload.restartPolicy).toBe('unless-stopped');
    });
  });

  describe('GUARD-01..08: Defensive Guards Across All Lifecycle Methods', () => {
    it('defends against unconfigured state across all public lifecycle methods', async () => {
      const emptyConfig = { get: jest.fn().mockReturnValue('') };
      const module = await Test.createTestingModule({
        providers: [
          DokployProvider,
          { provide: ConfigService, useValue: emptyConfig },
        ],
      }).compile();
      const unconfigured = module.get<DokployProvider>(DokployProvider);

      const calls: Array<{ name: string; run: () => Promise<any> }> = [
        { name: 'createWorkload', run: () => unconfigured.createWorkload({ name: 'test', domain: 'test.co.ke' }) },
        { name: 'triggerDeployment', run: () => unconfigured.triggerDeployment('app-1') },
        { name: 'setEnvironmentVariables', run: () => unconfigured.setEnvironmentVariables('app-1', { K: 'V' }) },
        { name: 'bindDomain', run: () => unconfigured.bindDomain('app-1', 'test.co.ke') },
        { name: 'getWorkloadStatus', run: () => unconfigured.getWorkloadStatus('app-1') },
        { name: 'getWorkloadLogs', run: () => unconfigured.getWorkloadLogs('app-1') },
        { name: 'stopWorkload', run: () => unconfigured.stopWorkload('app-1') },
        { name: 'restartWorkload', run: () => unconfigured.restartWorkload('app-1') },
        { name: 'destroyWorkload', run: () => unconfigured.destroyWorkload('app-1') },
      ];

      for (const call of calls) {
        await expect(call.run()).rejects.toThrow(HttpException);
        try {
          await call.run();
        } catch (err: any) {
          expect(err.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
          expect(err.message).toContain('Dokploy provider is not configured');
        }
      }
    });
  });

  describe('DOMAIN-02 & DOMAIN-03: Domain Sanitization & sslActive Accuracy', () => {
    it('sanitizes domain hostnames by stripping protocol schemes, ports, and trailing paths (DOMAIN-02)', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { domainId: 'dom-clean-01' } });

      const testInputs = [
        { input: 'https://portal.acacia.co.ke:443/app', expectedHost: 'portal.acacia.co.ke' },
        { input: 'http://SUB.DOMAIN.KE:8080/', expectedHost: 'sub.domain.ke' },
        { input: '  acacia.co.ke  ', expectedHost: 'acacia.co.ke' },
        { input: 'http://demo.domain.com:3000', expectedHost: 'demo.domain.com' },
      ];

      for (const t of testInputs) {
        mockHttpClient.post.mockClear();
        const res = await provider.bindDomain({
          applicationId: 'app-999',
          domain: t.input,
        });

        expect(res.domain).toBe(t.expectedHost);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          '/api/domain.create',
          expect.objectContaining({
            applicationId: 'app-999',
            host: t.expectedHost,
          }),
        );
      }
    });

    it('accurately evaluates sslActive based on https flag and certificateType (DOMAIN-03)', async () => {
      mockHttpClient.post.mockResolvedValue({ data: { domainId: 'dom-ssl-01' } });

      // Scenario 1: HTTPS explicitly disabled
      const resHttpOnly = await provider.bindDomain({
        applicationId: 'app-1',
        domain: 'internal.local',
        https: false,
        certificateType: 'none',
      });
      expect(resHttpOnly.sslActive).toBe(false);

      // Scenario 2: HTTPS true but certificateType 'none'
      const resNoCert = await provider.bindDomain({
        applicationId: 'app-1',
        domain: 'internal.local',
        https: true,
        certificateType: 'none',
      });
      expect(resNoCert.sslActive).toBe(false);

      // Scenario 3: HTTPS true with Let's Encrypt
      const resSsl = await provider.bindDomain({
        applicationId: 'app-1',
        domain: 'secure.acacia.co.ke',
        https: true,
        certificateType: 'letsencrypt',
      });
      expect(resSsl.sslActive).toBe(true);

      // Scenario 4: HTTPS true with custom certificate
      const resCustom = await provider.bindDomain({
        applicationId: 'app-1',
        domain: 'custom.acacia.co.ke',
        https: true,
        certificateType: 'custom' as any,
      });
      expect(resCustom.sslActive).toBe(true);
    });
  });

  describe('STATUS-02: Numeric Zero Preservation & Status Normalization', () => {
    it('preserves numeric zero values for cpuUsage, memoryUsage, and uptime without falsiness erasure (STATUS-02)', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: {
          applicationStatus: 'running',
          cpuUsage: 0,
          memoryUsage: 0,
          uptime: 0,
        },
      });

      const status = await provider.getWorkloadStatus('app-123');
      expect(status.status).toBe('RUNNING');
      expect(status.health).toBe('HEALTHY');
      expect(status.cpuUsagePercent).toBe(0);
      expect(status.memoryUsageMb).toBe(0);
      expect(status.uptimeSeconds).toBe(0);
    });

    it('returns undefined for missing or null metrics in getWorkloadStatus', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: {
          applicationStatus: 'running',
          cpuUsage: null,
          memoryUsage: undefined,
        },
      });

      const status = await provider.getWorkloadStatus('app-123');
      expect(status.cpuUsagePercent).toBeUndefined();
      expect(status.memoryUsageMb).toBeUndefined();
      expect(status.uptimeSeconds).toBeUndefined();
    });

    it('correctly maps Dokploy "idle" status to STOPPED / UNHEALTHY', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { applicationStatus: 'idle' },
      });

      const status = await provider.getWorkloadStatus('app-123');
      expect(status.status).toBe('STOPPED');
      expect(status.health).toBe('UNHEALTHY');
    });
  });

  describe('LIFECYCLE-02: Compensating Rollback Cleanup upon Partial Failure', () => {
    beforeEach(() => {
      mockHttpClient.get.mockResolvedValue({ data: [{ name: 'project-default', projectId: 'p1' }] });
    });

    it('invokes destroyWorkload when domain binding fails after application creation', async () => {
      let deletedAppId: string | null = null;
      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/application.create') {
          return Promise.resolve({ data: { applicationId: 'app-rollback-domain' } });
        }
        if (url === '/api/domain.create') {
          return Promise.reject(new HttpException('Domain conflict', HttpStatus.CONFLICT));
        }
        if (url === '/api/application.delete') {
          deletedAppId = payload.applicationId;
          return Promise.resolve({ data: { success: true } });
        }
        return Promise.resolve({ data: {} });
      });

      await expect(
        provider.createWorkload({
          name: 'failed-domain-workload',
          domain: 'conflict.co.ke',
          resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
        }),
      ).rejects.toThrow('Domain conflict');

      expect(deletedAppId).toBe('app-rollback-domain');
    });

    it('invokes destroyWorkload when setEnvironmentVariables fails after application creation', async () => {
      let deletedAppId: string | null = null;
      mockHttpClient.post.mockImplementation((url: string, payload: any) => {
        if (url === '/api/application.create') {
          return Promise.resolve({ data: { applicationId: 'app-rollback-env' } });
        }
        if (url === '/api/application.saveEnvironment') {
          return Promise.reject(new HttpException('Invalid env syntax', HttpStatus.BAD_REQUEST));
        }
        if (url === '/api/application.delete') {
          deletedAppId = payload.applicationId;
          return Promise.resolve({ data: { success: true } });
        }
        return Promise.resolve({ data: {} });
      });

      await expect(
        provider.createWorkload({
          name: 'failed-env-workload',
          domain: 'envfail.co.ke',
          env: { BAD_ENV: 'value' },
          resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
        }),
      ).rejects.toThrow('Invalid env syntax');

      expect(deletedAppId).toBe('app-rollback-env');
    });

    it('does not invoke destroyWorkload if application creation itself fails', async () => {
      let deleteCalled = false;
      mockHttpClient.post.mockImplementation((url: string) => {
        if (url === '/api/application.create') {
          return Promise.reject(new HttpException('Docker daemon out of space', HttpStatus.INTERNAL_SERVER_ERROR));
        }
        if (url === '/api/application.delete') {
          deleteCalled = true;
          return Promise.resolve({ data: { success: true } });
        }
        return Promise.resolve({ data: {} });
      });

      await expect(
        provider.createWorkload({
          name: 'failed-create-workload',
          domain: 'createfail.co.ke',
          resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
        }),
      ).rejects.toThrow('Docker daemon out of space');

      expect(deleteCalled).toBe(false);
    });

    it('preserves the original error even if compensating cleanup itself encounters an error', async () => {
      mockHttpClient.post.mockImplementation((url: string) => {
        if (url === '/api/application.create') {
          return Promise.resolve({ data: { applicationId: 'app-double-fault' } });
        }
        if (url === '/api/domain.create') {
          return Promise.reject(new HttpException('Original domain failure', HttpStatus.BAD_REQUEST));
        }
        if (url === '/api/application.delete') {
          return Promise.reject(new Error('Cleanup network timeout'));
        }
        return Promise.resolve({ data: {} });
      });

      await expect(
        provider.createWorkload({
          name: 'double-fault-workload',
          domain: 'doublefault.co.ke',
          resourceLimits: { cpus: 1.0, memoryLimitMb: 512 },
        }),
      ).rejects.toThrow('Original domain failure');
    });
  });

  describe('RETRY-01: Transient Error Retry & Resilience', () => {
    it('retries on transient 503 Service Unavailable and succeeds', async () => {
      let attempts = 0;
      mockHttpClient.post.mockImplementation((url: string) => {
        if (url === '/api/application.deploy') {
          attempts++;
          if (attempts === 1) {
            return Promise.reject(new HttpException('Dokploy rebooting', HttpStatus.SERVICE_UNAVAILABLE));
          }
          return Promise.resolve({ data: { deploymentId: 'dep-retry-ok' } });
        }
        return Promise.resolve({ data: {} });
      });

      const res = await provider.triggerDeployment('app-1');
      expect(attempts).toBe(2);
      expect(res.deploymentId).toBe('dep-retry-ok');
    });

    it('throws non-transient errors immediately without retry', async () => {
      let attempts = 0;
      mockHttpClient.post.mockImplementation((url: string) => {
        if (url === '/api/application.deploy') {
          attempts++;
          return Promise.reject(new HttpException('Invalid app', HttpStatus.BAD_REQUEST));
        }
        return Promise.resolve({ data: {} });
      });

      await expect(provider.triggerDeployment('app-1')).rejects.toThrow(HttpException);
      expect(attempts).toBe(1);
    });

    it('aborts after exceeding maximum retries for persistent 503', async () => {
      let attempts = 0;
      mockHttpClient.post.mockImplementation((url: string) => {
        if (url === '/api/application.deploy') {
          attempts++;
          return Promise.reject(new HttpException('Persistent 503', HttpStatus.SERVICE_UNAVAILABLE));
        }
        return Promise.resolve({ data: {} });
      });

      await expect(provider.triggerDeployment('app-1')).rejects.toThrow(HttpException);
      expect(attempts).toBe(3); // 1 initial + 2 retries
    });
  });
});
