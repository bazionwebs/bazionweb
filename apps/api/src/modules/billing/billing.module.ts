import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController } from './billing.controller';
import { WebhooksController } from './webhooks.controller';
import { BillingService } from './billing.service';
import { PaymentSettlementService } from './payment-settlement.service';
import { PlansController } from './plans.controller';
import { PaystackService } from './paystack.service';
import { DarajaService } from './daraja.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlatformProvisioningModule } from '../platform-provisioning/platform-provisioning.module';

@Module({
  imports: [PrismaModule, ScheduleModule, PlatformProvisioningModule],
  controllers: [BillingController, PlansController, WebhooksController],
  providers: [BillingService, PaymentSettlementService, PaystackService, DarajaService],
  exports: [BillingService, PaymentSettlementService, PaystackService, DarajaService],
})
export class BillingModule {}
