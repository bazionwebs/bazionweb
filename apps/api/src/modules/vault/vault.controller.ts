import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { CreateVaultSecretDto } from './dto/vault.dto';
import { VaultService } from './vault.service';

@ApiTags('vault')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller({ path: 'vault', version: '1' })
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Get()
  @ApiOperation({ summary: 'List encrypted credentials stored in the client vault (masked metadata only)' })
  findAll(@Request() req: any, @Query('clientId') clientId?: string) {
    return this.vaultService.findAll(req.user, clientId);
  }

  @Post()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Encrypt and store a new credential using AES-256-GCM' })
  create(@Body() dto: CreateVaultSecretDto, @Request() req: any) {
    return this.vaultService.create(dto, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Post(':id/reveal')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Decrypt and reveal a vault credential (audit-logged)' })
  reveal(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.vaultService.reveal(id, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke and soft-delete a vault credential (audit-logged)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.vaultService.remove(id, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }
}

