import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { AdminDiagnosticsController } from './diagnostics.controller';
import { AdminDiagnosticsService } from './diagnostics.service';

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [AdminDiagnosticsController],
  providers: [AdminDiagnosticsService],
  exports: [AdminDiagnosticsService],
})
export class DiagnosticsModule {}
