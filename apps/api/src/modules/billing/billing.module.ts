import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController } from './billing.controller';
import { WebhooksController } from './webhooks.controller';
import { BillingService } from './billing.service';
import { IntaSendService } from './intasend.service';
import { PaystackService } from './paystack.service';
import { WiseService } from './wise.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ScheduleModule],
  controllers: [BillingController, WebhooksController],
  providers: [BillingService, IntaSendService, PaystackService, WiseService],
  exports: [BillingService, IntaSendService, PaystackService, WiseService],
})
export class BillingModule {}
