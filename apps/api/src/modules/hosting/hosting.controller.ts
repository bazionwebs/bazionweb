import {
  Controller, Get, Post, Patch, Body,
  Param, Query, UseGuards, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HostingService } from './hosting.service';
import { CreateHostingAccountDto, UpdateHostingAccountDto } from './dto/create-hosting-account.dto';
import { JwtAuthGuard, Roles } from '../../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

@ApiTags('hosting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller({ path: 'hosting', version: '1' })
export class HostingController {
  constructor(private readonly svc: HostingService) {}

  /** Admin: list all hosting accounts */
  @Get()
  @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all hosting accounts (admin)' })
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 25,
  ) {
    return this.svc.findAll(req.user, { status, page: +page, limit: +limit });
  }

  /** Client: get own hosting accounts */
  @Get('me')
  @ApiOperation({ summary: 'Get my hosting accounts (client)' })
  findMe(@Request() req: any) {
    return this.svc.findMe(req.user.id);
  }

  /** Admin: provision a new hosting account */
  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Provision a new hosting account (admin)' })
  create(@Body() dto: CreateHostingAccountDto) {
    return this.svc.create(dto);
  }

  /** Admin: update hosting account status */
  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update hosting account (admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHostingAccountDto,
  ) {
    return this.svc.updateAccount(id, dto as Record<string, unknown>);
  }

  /** Any authenticated user: get specific hosting account (scope-checked) */
  @Get(':id')
  @ApiOperation({ summary: 'Get hosting account by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.findOne(id, req.user);
  }
}
