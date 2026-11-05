import {
  Controller, Get, Post, Patch, Delete, Body,
  Param, Query, UseGuards, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ManualProvisionClientDto } from './dto/manual-provision-client.dto';
import { JwtAuthGuard, Roles } from '../../common/guards/jwt-auth.guard';
import { MfaGuard } from '../../common/guards/mfa.guard';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MfaGuard)
@Controller({ path: 'clients', version: '1' })
export class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  /** Admin: create a new client account */
  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create client (admin)' })
  create(@Body() dto: CreateClientDto) {
    return this.svc.create(dto);
  }

  /** Admin: atomically provision client organization, user account, initial project & claim token */
  @Post('manual-provision')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Manually provision client account with atomic workspace sync and claim link' })
  manualProvision(@Body() dto: ManualProvisionClientDto, @Request() req: any) {
    return this.svc.manualProvision(dto, req.user);
  }

  /** Admin: re-issue activation claim link for an unclaimed client */
  @Post(':id/resend-invite')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Re-generate activation claim link for client account' })
  resendInvite(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.resendInvite(id, req.user);
  }

  /** Admin: repair and sync client workspace onboarding state */
  @Post(':id/sync-onboarding')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Synchronize and repair client onboarding state' })
  syncOnboarding(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.syncOnboarding(id, req.user);
  }

  /** Admin: list all clients with pagination + filters */
  @Get()
  @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all clients (admin/support)' })
  findAll(
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('q') q?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 25,
  ) {
    return this.svc.findAll({ status, plan, q, page: +page, limit: +limit });
  }

  /** Client: get own account */
  @Get('me')
  @ApiOperation({ summary: 'Get my client account' })
  getMe(@Request() req: any) {
    return this.svc.findByUserId(req.user.id);
  }

  /** Client: mark guided portal onboarding complete (sets onboardedAt once) */
  @Post('me/onboard')
  @ApiOperation({ summary: 'Mark my portal onboarding as complete' })
  markOnboarded(@Request() req: any, @Body() body?: { completedSteps?: string[] }) {
    return this.svc.markOnboarded(req.user.id, body?.completedSteps);
  }

  /** Admin or self */
  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @Request() req: any,
  ) {
    return this.svc.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft-delete client (super admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(id);
  }
}
