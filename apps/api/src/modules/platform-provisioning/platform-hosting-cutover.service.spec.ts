import { PlatformHostingCutoverService } from './platform-hosting-cutover.service';

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
});