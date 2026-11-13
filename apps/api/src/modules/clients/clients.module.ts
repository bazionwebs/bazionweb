// ─── clients.module.ts ────────────────────────────────────────────────────────
import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { PlatformProvisioningModule } from '../platform-provisioning/platform-provisioning.module';

@Module({
  imports: [PlatformProvisioningModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
