import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController } from './billing.controller';
import { WebhooksController } from './webhooks.controller';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { DarajaService } from './daraja.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ScheduleModule],
  controllers: [BillingController, WebhooksController],
  providers: [BillingService, PaystackService, DarajaService],
  exports: [BillingService, PaystackService, DarajaService],
})
export class BillingModule {}
