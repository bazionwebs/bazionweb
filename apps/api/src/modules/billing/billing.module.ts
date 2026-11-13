import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController, SubscriptionsController } from './billing.controller';
import { WebhooksController } from './webhooks.controller';
import { BillingService } from './billing.service';
import { PaymentSettlementService } from './payment-settlement.service';
import { SubscriptionDunningService } from './subscription-dunning.service';
import { PlansController } from './plans.controller';
import { PaystackService } from './paystack.service';
import { DarajaService } from './daraja.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlatformProvisioningModule } from '../platform-provisioning/platform-provisioning.module';

@Module({
  imports: [PrismaModule, ScheduleModule, PlatformProvisioningModule],
  controllers: [BillingController, SubscriptionsController, PlansController, WebhooksController],
  providers: [
    BillingService,
    PaymentSettlementService,
    SubscriptionDunningService,
    PaystackService,
    DarajaService,
  ],
  exports: [
    BillingService,
    PaymentSettlementService,
    SubscriptionDunningService,
    PaystackService,
    DarajaService,
  ],
})
export class BillingModule {}
