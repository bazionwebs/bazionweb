import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HostingService } from './hosting.service';

const accountId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const deploymentId = '33333333-3333-4333-8333-333333333333';
const operatorId = '44444444-4444-4444-8444-444444444444';

function makeService(overrides: { account?: Record<string, unknown>; projection?: Record<string, unknown> } = {}) {
  const account: Record<string, unknown> = {
    id: accountId,
    clientId,
    domain: 'Example.com.',
    deletedAt: null,
    platformDeploymentId: null,
    ...overrides.account,
  };
  const projection = {
    id: '55555555-5555-4555-8555-555555555555',
    clientId,
    platformTenantId: '66666666-6666-4666-8666-666666666666',
    requestedDomain: 'example.com',
    platformDeploymentId: deploymentId,
    status: 'ready',
    externalOrderId: 'INV-PHASE4:line:0',
    ...overrides.projection,
  };
  const tx = {
    hostingAccount: {
      findUnique: jest.fn(async () => account),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    platformProvisioningProjection: { findUnique: jest.fn(async () => projection) },
    auditLog: { create: jest.fn(async () => ({ id: 'audit-1' })) },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: any) => callback(tx)),
    hostingAccount: {
      findUnique: jest.fn(async () => account),
      update: jest.fn(async () => account),
    },
  };
  const service = new HostingService(prisma as any, {} as EventEmitter2);
  return { service, tx, account, projection, prisma };
}

describe('Platform hosting deployment mapping', () => {
  it('requires a ready deployment, exact client and normalized domain, then writes an auditable link', async () => {
    const { service, tx } = makeService();

    const result = await service.linkPlatformDeployment(accountId, deploymentId, 'CHG-2026-0042', { id: operatorId });

    expect(result).toMatchObject({
      data: {
        hostingAccountId: accountId,
        platformDeploymentId: deploymentId,
        alreadyLinked: false,
        evidenceRef: 'CHG-2026-0042',
      },
    });
    expect(tx.hostingAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: accountId, deletedAt: null, platformDeploymentId: null },
      data: expect.objectContaining({
        platformDeploymentId: deploymentId,
        platformDeploymentMappedBy: operatorId,
        platformDeploymentMappingEvidence: 'CHG-2026-0042',
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: operatorId,
        action: 'hosting.platform_deployment.link',
        resourceId: accountId,
        newValue: expect.objectContaining({ externalOrderId: 'INV-PHASE4:line:0', domain: 'example.com' }),
      }),
    }));
  });

  it.each([
    ['different client', { projection: { clientId: '77777777-7777-4777-8777-777777777777' } }],
    ['different domain', { projection: { requestedDomain: 'other.example' } }],
    ['missing domain', { projection: { requestedDomain: null } }],
    ['not ready', { projection: { status: 'provisioning_hosting' } }],
    ['missing tenant', { projection: { platformTenantId: null } }],
  ])('rejects a mapping with %s', async (_case, overrides) => {
    const { service, tx } = makeService(overrides as any);

    await expect(service.linkPlatformDeployment(accountId, deploymentId, 'CHG-2026-0042', { id: operatorId }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.hostingAccount.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('is idempotent for the same link and refuses to overwrite a different link', async () => {
    const alreadyLinked = makeService({ account: { platformDeploymentId: deploymentId } });
    await expect(alreadyLinked.service.linkPlatformDeployment(accountId, deploymentId, 'CHG-2026-0042', { id: operatorId }))
      .resolves.toMatchObject({ data: { alreadyLinked: true } });
    expect(alreadyLinked.tx.auditLog.create).not.toHaveBeenCalled();

    const differentLink = makeService({ account: { platformDeploymentId: '88888888-8888-4888-8888-888888888888' } });
    await expect(differentLink.service.linkPlatformDeployment(accountId, deploymentId, 'CHG-2026-0042', { id: operatorId }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(differentLink.tx.hostingAccount.updateMany).not.toHaveBeenCalled();
  });

  it('rolls a link back atomically and records the rollback evidence', async () => {
    const { service, tx } = makeService({
      account: {
        platformDeploymentId: deploymentId,
        platformDeploymentMappingEvidence: 'CHG-2026-0042',
      },
    });

    await expect(service.unlinkPlatformDeployment(accountId, 'ROLLBACK-DRILL-01', { id: operatorId }))
      .resolves.toMatchObject({ data: { platformDeploymentId: null, alreadyUnlinked: false } });
    expect(tx.hostingAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: accountId, deletedAt: null, platformDeploymentId: deploymentId },
      data: {
        platformDeploymentId: null,
        platformDeploymentMappedAt: null,
        platformDeploymentMappedBy: null,
        platformDeploymentMappingEvidence: null,
      },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'hosting.platform_deployment.unlink',
        oldValue: { platformDeploymentId: deploymentId, mappingEvidenceRef: 'CHG-2026-0042' },
        newValue: expect.objectContaining({ platformDeploymentId: null, rollbackEvidenceRef: 'ROLLBACK-DRILL-01' }),
      }),
    }));
  });

  it('keeps Platform-linked hosting status read-only in Bazionweb', async () => {
    const { service, prisma } = makeService({ account: { platformDeploymentId: deploymentId, status: 'SUSPENDED' } });

    await expect(service.updateAccount(accountId, { status: 'ACTIVE' }))
      .rejects.toThrow('status is read-only in Bazionweb');
    expect(prisma.hostingAccount.update).not.toHaveBeenCalled();
  });

  it('exposes the Platform provisioning read view without exposing deployment or legacy provider identifiers', async () => {
    const { service } = makeService({
      account: {
        platformDeploymentId: deploymentId,
        platformDeploymentMappedBy: operatorId,
        platformDeploymentMappingEvidence: 'CHG-2026-0042',
        deploymentProvider: 'dokploy',
        providerWorkloadId: 'private-old-provider-id',
        platformProjection: {
          status: 'ready',
          currentStep: 'complete',
          platformUpdatedAt: new Date('2026-11-12T00:00:00.000Z'),
        },
      },
    });

    const result = await service.findOne(accountId, { id: operatorId, roles: ['ADMIN'] });

    expect(result.data.platformProvisioning).toMatchObject({ status: 'ready', currentStep: 'complete' });
    expect(result.data).not.toHaveProperty('platformDeploymentId');
    expect(result.data).not.toHaveProperty('platformDeploymentMappingEvidence');
    expect(result.data).not.toHaveProperty('providerWorkloadId');
    expect(result.data).not.toHaveProperty('deploymentProvider');
  });

  it('rejects invalid evidence and missing operator identity before opening a transaction', async () => {
    const { service } = makeService();
    const transaction = jest.spyOn((service as any).prisma, '$transaction');

    await expect(service.linkPlatformDeployment(accountId, deploymentId, 'password', { id: operatorId }))
      .rejects.toThrow('valid change ticket or migration evidence');
    await expect(service.linkPlatformDeployment(accountId, deploymentId, 'CHG-2026-0042', {}))
      .rejects.toThrow('authenticated operator');
    expect(transaction).not.toHaveBeenCalled();
  });
});
