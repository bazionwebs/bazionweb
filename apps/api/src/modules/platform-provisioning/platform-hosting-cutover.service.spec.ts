import { PlatformHostingCutoverService } from './platform-hosting-cutover.service';
import { PlatformProvisioningAdminController } from './platform-provisioning-admin.controller';
import { PlatformProvisioningReconciliationService } from './platform-provisioning-reconciliation.service';

describe('PlatformHostingCutoverService', () => {
  it('returns paginated domain reconciliation candidates without mutating hosting or provider state', async () => {
    const query = jest.fn().mockResolvedValue([{
      activeHostingAccounts: 4n,
      linked: 1,
      readyToMap: 1,
      ambiguousPlatformClaims: 1,
      domainClaimedByOtherClient: 0,
      platformClaimNotReady: 0,
      linkedConflicts: 0,
      legacyOnly: 1,
      items: [{
        hostingAccountId: 'hosting-1',
        clientId: 'client-1',
        domain: 'example.org',
        hostingStatus: 'ACTIVE',
        platformDeploymentId: null,
        platformProjectionStatus: null,
        domainClaimCount: 1,
        clientDomainClaimCount: 1,
        domainClaimConflict: false,
        candidatePlatformDeploymentId: 'deployment-1',
        platformClaimStatuses: ['ready'],
        classification: 'ready_to_map',
      }],
    }]);
    const service = new PlatformHostingCutoverService({ $queryRaw: query } as any);

    const result = await service.getReport(-3, 500);

    expect(result).toMatchObject({
      page: 1,
      pageSize: 100,
      totalPages: 1,
      summary: {
        activeHostingAccounts: 4,
        linked: 1,
        readyToMap: 1,
        ambiguousPlatformClaims: 1,
        legacyOnly: 1,
      },
      items: [{
        hostingAccountId: 'hosting-1',
        candidatePlatformDeploymentId: 'deployment-1',
        platformClaimStatuses: ['ready'],
        classification: 'ready_to_map',
      }],
    });
    expect(typeof result.generatedAt).toBe('string');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toBe(0);
    expect(query.mock.calls[0][2]).toBe(100);

    const sql = query.mock.calls[0][0].join('');
    expect(sql).toContain('platform_provisioning_projections');
    expect(sql).toContain('platform_provisioning_outbox');
    expect(sql).toContain('domain_claimed_by_other_client');
    expect(sql).not.toContain('provider_workload_id');
    expect(sql).not.toContain('deployment_provider');
  });

  it('returns an empty report when no query row is supplied by a test adapter', async () => {
    const service = new PlatformHostingCutoverService({ $queryRaw: jest.fn().mockResolvedValue([]) } as any);

    await expect(service.getReport(2, 25)).resolves.toMatchObject({
      page: 2,
      pageSize: 25,
      totalPages: 0,
      summary: { activeHostingAccounts: 0 },
      items: [],
    });
  });

  it('compares hosting account and platform projection via dual-read and records audited rollback drills', async () => {
    const auditCreates: any[] = [];
    const service = new PlatformHostingCutoverService({
      hostingAccount: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'hosting-1',
          clientId: 'client-1',
          domain: 'example.org',
          status: 'ACTIVE',
          platformDeploymentId: 'dep-1',
        }),
      },
      platformProvisioningProjection: {
        findFirst: jest.fn().mockResolvedValue({
          clientId: 'client-1',
          status: 'ready',
          requestedDomain: 'example.org',
          platformDeploymentId: 'dep-1',
        }),
      },
      auditLog: {
        create: jest.fn(async (args) => {
          auditCreates.push(args.data);
          return args.data;
        }),
      },
    } as any);

    const dualRead = await service.compareHostingProjectionDualRead('hosting-1');
    expect(dualRead.status).toBe('matched');
    expect(dualRead.drifts).toEqual([]);

    const drill = await service.executeAuditedRollbackDrill({
      accountId: 'hosting-1',
      actorId: '11111111-1111-4111-8111-111111111111',
      ticketId: 'INC-2026-991',
      reason: 'Scheduled cutover rollback verification',
    });
    expect(drill.drillRecorded).toBe(true);
    expect(auditCreates).toHaveLength(1);
    expect(auditCreates[0].action).toBe('PLATFORM_HOSTING_ROLLBACK_DRILL_VERIFIED');
  });

  it('pushes scheduled cross-entity reconciliation snapshot and writes an audit alert on drift', async () => {
    const auditCreates: any[] = [];
    const prismaMock = {
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      platformProvisioningOutbox: {
        findMany: jest.fn().mockResolvedValue([
          {
            externalOrderId: 'INV-100:line:0',
            externalCustomerId: 'cust-1',
            clientId: 'cust-1',
            payload: { order: { offerId: 'website-launch', offerVersion: '1.0.0' } },
            platformOperationId: '22222222-2222-4222-8222-222222222222',
            createdAt: new Date('2026-11-12T00:00:00.000Z'),
            invoice: { status: 'PAID', paidAt: new Date('2026-11-12T00:00:00.000Z') },
            projection: { platformTenantId: '33333333-3333-4333-8333-333333333333', installationId: '44444444-4444-4444-8444-444444444444', status: 'ready' },
          },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      platformProvisioningProjection: { count: jest.fn().mockResolvedValue(0) },
      auditLog: {
        create: jest.fn(async (args) => {
          auditCreates.push(args.data);
          return args.data;
        }),
      },
    };
    const reconService = new PlatformProvisioningReconciliationService(prismaMock as any, {} as any);

    const fetchMock = jest.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({ summary: { unresolvedDriftCount: 2, criticalExceptions: 1 } }),
    }));

    const summary = await reconService.pushCrossEntityReconciliationSnapshot({
      platformApiBaseUrl: 'http://127.0.0.1:4100',
      commandSecret: 'test-command-signing-secret-minimum-32c',
      fetchImpl: fetchMock as any,
    });

    expect(summary.ordersSubmitted).toBe(1);
    expect(summary.remoteUnresolvedDriftCount).toBe(2);
    expect(summary.alertTriggered).toBe(true);
    expect(auditCreates).toHaveLength(1);
    expect(auditCreates[0].action).toBe('PLATFORM_RECONCILIATION_DRIFT_ALERT');
  });

  it('exposes admin controller endpoints for reconciliation push, dual-read check, and rollback drill', async () => {
    const pushMock = jest.fn().mockResolvedValue({ alertTriggered: false, ordersSubmitted: 0 });
    const dualReadMock = jest.fn().mockResolvedValue({ status: 'matched', drifts: [] });
    const rollbackDrillMock = jest.fn().mockResolvedValue({ drillRecorded: true, ticketId: 'ROLLBACK-9' });

    const controller = new PlatformProvisioningAdminController(
      {} as any,
      {} as any,
      { pushCrossEntityReconciliationSnapshot: pushMock } as any,
      {
        compareHostingProjectionDualRead: dualReadMock,
        executeAuditedRollbackDrill: rollbackDrillMock,
      } as any,
    );

    await expect(controller.pushReconciliation(10)).resolves.toEqual({ alertTriggered: false, ordersSubmitted: 0 });
    expect(pushMock).toHaveBeenCalledWith({ staleMinutes: 10 });

    await expect(controller.hostingCutoverDualRead('acct-1')).resolves.toEqual({ status: 'matched', drifts: [] });
    expect(dualReadMock).toHaveBeenCalledWith('acct-1');

    await expect(
      controller.hostingCutoverRollbackDrill('acct-1', { ticketId: 'ROLLBACK-9', reason: 'staging rehearsal' }, { user: { id: 'admin-1' } }),
    ).resolves.toEqual({ drillRecorded: true, ticketId: 'ROLLBACK-9' });
    expect(rollbackDrillMock).toHaveBeenCalledWith({
      accountId: 'acct-1',
      actorId: 'admin-1',
      ticketId: 'ROLLBACK-9',
      reason: 'staging rehearsal',
    });
  });
});
