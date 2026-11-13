import { ConflictException } from '@nestjs/common';
import { HostingService } from '../hosting.service';
import { DokployProvider } from '../providers/dokploy.provider';

describe('Legacy Hosting & Dokploy isolation under PLATFORM_SSOT_MODE', () => {
  it('blocks HostingService.create when PLATFORM_SSOT_MODE=true', async () => {
    const config = {
      get: jest.fn((key: string) => (key === 'PLATFORM_SSOT_MODE' ? 'true' : undefined)),
    };
    const svc = new HostingService({} as any, { emit: jest.fn() } as any, undefined, config as any);

    await expect(
      svc.create({
        clientId: 'client-1',
        domain: 'example.com',
        server: 'srv-1',
        plan: 'host-essential',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('blocks DokployProvider.createWorkload when PLATFORM_SSOT_MODE=true', async () => {
    const config = {
      get: jest.fn((key: string, def?: any) => {
        if (key === 'PLATFORM_SSOT_MODE') return 'true';
        if (key === 'DOKPLOY_API_URL') return 'http://127.0.0.1:3000';
        if (key === 'DOKPLOY_API_KEY') return 'dokploy-test-key';
        return def;
      }),
    };
    const provider = new DokployProvider(config as any);

    await expect(
      provider.createWorkload({
        clientId: 'client-1',
        domain: 'example.com',
        name: 'tenant-1',
      } as any),
    ).rejects.toThrow(ConflictException);
  });
});

