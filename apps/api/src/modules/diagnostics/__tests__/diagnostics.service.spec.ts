import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AdminDiagnosticsService } from '../diagnostics.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AdminDiagnosticsService - Impersonation Scoped Token', () => {
  let service: AdminDiagnosticsService;
  let prisma: {
    client: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let config: {
    get: jest.Mock;
  };

  const JWT_SECRET = 'test-sandbox-secret';

  beforeEach(() => {
    prisma = {
      client: { findUnique: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return JWT_SECRET;
        return null;
      }),
    };

    service = new AdminDiagnosticsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('throws NotFoundException if client does not exist', async () => {
    prisma.client.findUnique.mockResolvedValue(null);

    await expect(
      service.impersonateClient('missing-id', { id: 'staff-1', email: 'admin@bazionweb.com' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException if client has no associated user account', async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: 'client-1',
      businessName: 'Acacia Tech',
      user: null,
    });

    await expect(
      service.impersonateClient('client-1', { id: 'staff-1', email: 'admin@bazionweb.com' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('mints an isolated, scoped 15-minute sandbox JWT containing full client and auditor identity', async () => {
    const mockClient = {
      id: 'client-123',
      businessName: 'Acacia Healthcare Services',
      contactName: 'Dr. Jane Doe',
      email: 'billing@acacia.co.ke',
      status: 'ACTIVE',
      user: {
        id: 'user-client-789',
        email: 'jane@acacia.co.ke',
        firstName: 'Jane',
        lastName: 'Doe',
      },
    };

    prisma.client.findUnique.mockResolvedValue(mockClient);

    const staffUser = {
      id: 'staff-admin-456',
      email: 'superadmin@bazionweb.com',
    };

    const res = await service.impersonateClient('client-123', staffUser);

    expect(res).toBeDefined();
    expect(res.expiresIn).toBe(900);
    expect(res.client).toEqual({
      id: 'client-123',
      businessName: 'Acacia Healthcare Services',
      email: 'billing@acacia.co.ke',
      contactName: 'Dr. Jane Doe',
    });

    // Verify token structure and claims
    const decoded: any = jwt.verify(res.token, JWT_SECRET);

    expect(decoded.sub).toBe('user-client-789');
    expect(decoded.email).toBe('jane@acacia.co.ke');
    expect(decoded.given_name).toBe('Jane');
    expect(decoded.family_name).toBe('Doe');
    expect(decoded.clientId).toBe('client-123');
    expect(decoded.clientBusinessName).toBe('Acacia Healthcare Services');
    expect(decoded.realm_access?.roles).toEqual(['CLIENT']);
    expect(decoded.subscriptionStatus).toBe('ACTIVE');
    expect(decoded.impersonatedBy).toBe('superadmin@bazionweb.com');
    expect(decoded.isSandbox).toBe(true);
    expect(decoded.iss).toBe('bazionweb');

    // Audit log was created
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'staff-admin-456',
        action: 'impersonation.launch',
        resourceType: 'Client',
        resourceId: 'client-123',
        newValue: { targetUser: 'jane@acacia.co.ke' },
      }),
    });
  });
});
