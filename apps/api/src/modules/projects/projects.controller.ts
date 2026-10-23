// projects.controller.ts
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard, Roles } from '../../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects (scoped by role)' })
  findAll(@Request() req: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.svc.findAll(req.user, { page: +page, limit: +limit });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my projects (client)' })
  findMe(@Request() req: any) {
    return this.svc.findMe(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.findOne(id, req.user);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create project (admin)' })
  create(@Body() dto: any) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update project status/progress (admin)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }
}
