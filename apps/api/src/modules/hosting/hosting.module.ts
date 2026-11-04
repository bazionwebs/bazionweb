// hosting.module.ts
import { Module } from '@nestjs/common';
import { HostingController } from './hosting.controller';
import { HostingService } from './hosting.service';
import { DeploymentProvider } from './providers/deployment-provider.interface';
import { DokployProvider } from './providers/dokploy.provider';

@Module({
  controllers: [HostingController],
  providers: [
    HostingService,
    DokployProvider,
    {
      provide: DeploymentProvider,
      useClass: DokployProvider,
    },
    {
      provide: 'DEPLOYMENT_PROVIDER',
      useExisting: DeploymentProvider,
    },
  ],
  exports: [HostingService, DokployProvider, DeploymentProvider, 'DEPLOYMENT_PROVIDER'],
})
export class HostingModule {}

