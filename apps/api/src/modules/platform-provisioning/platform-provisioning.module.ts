import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlatformCallbackProjectionService } from './platform-callback-projection.service';
import { PlatformCallbacksController } from './platform-callbacks.controller';
import { PlatformProvisioningAdminController } from './platform-provisioning-admin.controller';
import { PlatformProvisioningOutboxService } from './platform-provisioning-outbox.service';
import { PlatformProvisioningReconciliationService } from './platform-provisioning-reconciliation.service';
import { PlatformProvisioningWorkerService } from './platform-provisioning-worker.service';
import { SubscriptionLifecycleOutboxService } from './subscription-lifecycle-outbox.service';

@Module({
  imports: [PrismaModule, ScheduleModule],
  controllers: [PlatformCallbacksController, PlatformProvisioningAdminController],
  providers: [
    PlatformProvisioningOutboxService,
    PlatformProvisioningWorkerService,
    SubscriptionLifecycleOutboxService,
    PlatformCallbackProjectionService,
    PlatformProvisioningReconciliationService,
  ],
  exports: [
    PlatformProvisioningOutboxService,
    PlatformProvisioningWorkerService,
    SubscriptionLifecycleOutboxService,
    PlatformCallbackProjectionService,
    PlatformProvisioningReconciliationService,
  ],
})
export class PlatformProvisioningModule {}

