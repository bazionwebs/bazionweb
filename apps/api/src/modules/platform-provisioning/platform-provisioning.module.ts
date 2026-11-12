import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlatformCallbackProjectionService } from './platform-callback-projection.service';
import { PlatformCallbacksController } from './platform-callbacks.controller';
import { PlatformProvisioningAdminController } from './platform-provisioning-admin.controller';
import { PlatformProvisioningCatalogService } from './provisioning-catalog.service';
import { PlatformProvisioningOutboxService } from './platform-provisioning-outbox.service';
import { PlatformProvisioningReconciliationService } from './platform-provisioning-reconciliation.service';
import { PlatformHostingCutoverService } from './platform-hosting-cutover.service';
import { PlatformProvisioningWorkerService } from './platform-provisioning-worker.service';
import { SubscriptionLifecycleOutboxService } from './subscription-lifecycle-outbox.service';

@Module({
  imports: [PrismaModule, ScheduleModule],
  controllers: [PlatformCallbacksController, PlatformProvisioningAdminController],
  providers: [
    PlatformProvisioningOutboxService,
    PlatformProvisioningCatalogService,
    PlatformProvisioningWorkerService,
    SubscriptionLifecycleOutboxService,
    PlatformCallbackProjectionService,
    PlatformProvisioningReconciliationService,
    PlatformHostingCutoverService,
  ],
  exports: [
    PlatformProvisioningOutboxService,
    PlatformProvisioningCatalogService,
    PlatformProvisioningWorkerService,
    SubscriptionLifecycleOutboxService,
    PlatformCallbackProjectionService,
    PlatformProvisioningReconciliationService,
    PlatformHostingCutoverService,
  ],
})
export class PlatformProvisioningModule {}
