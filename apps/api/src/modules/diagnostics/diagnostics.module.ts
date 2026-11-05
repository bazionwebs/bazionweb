import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { HostingModule } from '../hosting/hosting.module';
import { AuthModule } from '../auth/auth.module';
import { AdminDiagnosticsController } from './diagnostics.controller';
import { AdminDiagnosticsService } from './diagnostics.service';

@Module({
  imports: [PrismaModule, BillingModule, HostingModule, AuthModule],
  controllers: [AdminDiagnosticsController],
  providers: [AdminDiagnosticsService],
  exports: [AdminDiagnosticsService],
})
export class DiagnosticsModule {}
