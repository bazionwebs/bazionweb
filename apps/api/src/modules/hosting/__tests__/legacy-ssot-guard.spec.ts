import { ConflictException, ForbiddenException } from '@nestjs/common';
import { HostingService } from '../hosting.service';
import { DokployProvider } from '../providers/dokploy.provider';
import { AdminDiagnosticsService } from '../../diagnostics/diagnostics.service';
import {
  assertLegacyProvisioningPermitted,
  clearLegacyProvisioningRollbackAuditTrail,
  getLegacyProvisioningRollbackAuditTrail,
} from '../../platform-provisioning/platform-ssot-guard';

function makeConfig(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string, def?: any) => (key in values ? values[key] : def)),
  };
}

describe('Legacy Hosting, Diagnostics & Dokploy isolation under PLATFORM_SSOT_MODE', () => {
  beforeEach(() => {
    clearLegacyProvisioningRollbackAuditTrail();
  });

  it('blocks HostingService.create and HostingService.updateAccount (including unmapped rows) when PLATFORM_SSOT_MODE=true', async () => {
    const config = makeConfig({ PLATFORM_SSOT_MODE: 'true' });
    const prisma = {
      hostingAccount: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'host-unmapped-1',
          domain: 'legacy.example',
          status: 'ACTIVE',
          deletedAt: null,
          platformDeploymentId: null,
        }),
        update: jest.fn(),
      },
    };
    const svc = new HostingService(prisma as any, { emit: jest.fn() } as any, undefined, config as any);

    await expect(
      svc.create({
        clientId: 'client-1',
        domain: 'example.com',
        server: 'srv-1',
        plan: 'host-essential',
      }),
    ).rejects.toThrow(ConflictException);

    await expect(svc.updateAccount('host-unmapped-1', { status: 'SUSPENDED' })).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.hostingAccount.update).not.toHaveBeenCalled();
  });

  it('blocks EVERY DokployProvider mutation when PLATFORM_SSOT_MODE=true', async () => {
    const config = makeConfig({
      PLATFORM_SSOT_MODE: 'true',
      DOKPLOY_API_URL: 'http://127.0.0.1:3000',
      DOKPLOY_API_KEY: 'dokploy-test-key',
    });
    const provider = new DokployProvider(config as any);

    await expect(
      provider.createWorkload({
        clientId: 'client-1',
        domain: 'example.com',
        name: 'tenant-1',
      } as any),
    ).rejects.toThrow(ConflictException);

    await expect(provider.triggerDeployment('wl-1')).rejects.toThrow(ConflictException);
    await expect(provider.setEnvironmentVariables('wl-1', { A: '1' })).rejects.toThrow(
      ConflictException,
    );
    await expect(provider.bindDomain({ applicationId: 'wl-1', domain: 'example.com' })).rejects.toThrow(
      ConflictException,
    );
    await expect(provider.stopWorkload('wl-1')).rejects.toThrow(ConflictException);
    await expect(provider.restartWorkload('wl-1')).rejects.toThrow(ConflictException);
    await expect(provider.destroyWorkload('wl-1')).rejects.toThrow(ConflictException);
  });

  it('blocks AdminDiagnosticsService REISSUE_SSL, UNSUSPEND, and NORMALIZE_STATUS on unmapped legacy rows when PLATFORM_SSOT_MODE=true', async () => {
    const config = makeConfig({ PLATFORM_SSOT_MODE: 'true' });
    const unmappedAccount = {
      id: 'host-legacy-unmapped',
      domain: 'unmapped-legacy.example',
      deploymentProvider: 'dokploy',
      providerWorkloadId: 'wl-legacy-1',
      platformDeploymentId: null,
      status: 'SUSPENDED',
    };
    const prisma = {
      hostingAccount: {
        findFirst: jest.fn().mockResolvedValue(unmappedAccount),
        findUnique: jest.fn().mockResolvedValue(unmappedAccount),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const dokployMock = {
      providerName: 'DokployProvider',
      bindDomain: jest.fn(),
      restartWorkload: jest.fn(),
    };
    const diagnostics = new AdminDiagnosticsService(
      prisma as any,
      config as any,
      {} as any,
      {} as any,
      {} as any,
      dokployMock as any,
    );

    await expect(
      diagnostics.remediateDnsSsl({
        hostingAccountId: 'host-legacy-unmapped',
        domain: 'unmapped-legacy.example',
        action: 'REISSUE_SSL',
      } as any),
    ).rejects.toThrow(ConflictException);

    await expect(
      diagnostics.remediateDomainState({
        hostingAccountId: 'host-legacy-unmapped',
        action: 'UNSUSPEND',
      } as any),
    ).rejects.toThrow(ConflictException);

    await expect(
      diagnostics.remediateDomainState({
        hostingAccountId: 'host-legacy-unmapped',
        action: 'NORMALIZE_STATUS',
      } as any),
    ).rejects.toThrow(ConflictException);

    expect(dokployMock.bindDomain).not.toHaveBeenCalled();
    expect(dokployMock.restartWorkload).not.toHaveBeenCalled();
    expect(prisma.hostingAccount.update).not.toHaveBeenCalled();
  });

  it('rejects blanket ALLOW_LEGACY_PROVISIONING=true, wildcard operations, and expired windows, and audits valid scoped rollback windows', () => {
    // 1. Blanket override without ticket/actor/expiry/operations
    const blanketConfig = makeConfig({
      PLATFORM_SSOT_MODE: 'true',
      ALLOW_LEGACY_PROVISIONING: 'true',
    });
    expect(() =>
      assertLegacyProvisioningPermitted('DokployProvider.bindDomain', blanketConfig as any),
    ).toThrow(ForbiddenException);

    // 2. Wildcard operation list rejected
    const future2h = new Date(Date.now() + 2 * 3600_000).toISOString();
    const wildcardConfig = makeConfig({
      PLATFORM_SSOT_MODE: 'true',
      ALLOW_LEGACY_PROVISIONING: 'true',
      LEGACY_PROVISIONING_ROLLBACK_TICKET: 'CHG-2026-001',
      LEGACY_PROVISIONING_ROLLBACK_ACTOR: 'ops-alice',
      LEGACY_PROVISIONING_ROLLBACK_UNTIL: future2h,
      LEGACY_PROVISIONING_ROLLBACK_OPERATIONS: '*',
    });
    expect(() =>
      assertLegacyProvisioningPermitted('DokployProvider.bindDomain', wildcardConfig as any),
    ).toThrow(ForbiddenException);

    // 3. Expired rollback window rejected
    const expiredConfig = makeConfig({
      PLATFORM_SSOT_MODE: 'true',
      ALLOW_LEGACY_PROVISIONING: 'true',
      LEGACY_PROVISIONING_ROLLBACK_TICKET: 'CHG-2026-001',
      LEGACY_PROVISIONING_ROLLBACK_ACTOR: 'ops-alice',
      LEGACY_PROVISIONING_ROLLBACK_UNTIL: new Date(Date.now() - 60_000).toISOString(),
      LEGACY_PROVISIONING_ROLLBACK_OPERATIONS: 'DokployProvider.bindDomain',
    });
    expect(() =>
      assertLegacyProvisioningPermitted('DokployProvider.bindDomain', expiredConfig as any),
    ).toThrow(ForbiddenException);

    // 4. Valid ticket-backed, time-limited, operation-scoped window permits only the named operation and records audit entry
    const scopedConfig = makeConfig({
      PLATFORM_SSOT_MODE: 'true',
      ALLOW_LEGACY_PROVISIONING: 'true',
      LEGACY_PROVISIONING_ROLLBACK_TICKET: 'ROLLBACK-2026-42',
      LEGACY_PROVISIONING_ROLLBACK_ACTOR: 'ops-alice@bazionweb.com',
      LEGACY_PROVISIONING_ROLLBACK_UNTIL: future2h,
      LEGACY_PROVISIONING_ROLLBACK_OPERATIONS: 'DokployProvider.bindDomain',
    });
    expect(() =>
      assertLegacyProvisioningPermitted('DokployProvider.bindDomain', scopedConfig as any),
    ).not.toThrow();

    expect(() =>
      assertLegacyProvisioningPermitted('DokployProvider.destroyWorkload', scopedConfig as any),
    ).toThrow(ForbiddenException);

    const trail = getLegacyProvisioningRollbackAuditTrail();
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({
      operation: 'DokployProvider.bindDomain',
      ticket: 'ROLLBACK-2026-42',
      actor: 'ops-alice@bazionweb.com',
    });
  });

  it('blocks HostingService.unlinkPlatformDeployment when PLATFORM_SSOT_MODE=true without rollback approval', async () => {
    const service = new HostingService(
      {} as any,
      { emit: jest.fn() } as any,
      undefined,
      makeConfig({ PLATFORM_SSOT_MODE: 'true' }) as any,
    );

    await expect(
      service.unlinkPlatformDeployment('host-1', 'ROLLBACK-2026-99', { id: 'admin-1' }),
    ).rejects.toThrow(ConflictException);
  });
});
