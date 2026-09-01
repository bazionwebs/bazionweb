import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Request, ParseUUIDPipe, Version,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { JwtAuthGuard, Roles } from '../../common/guards/jwt-auth.guard';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'tickets', version: '1' })
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a support ticket' })
  create(@Body() dto: CreateTicketDto, @Request() req: any) {
    return this.ticketsService.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets (scoped by role)' })
  findAll(
    @Request() req: any,
    @Query('scope') scope?: 'mine' | 'all',
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.ticketsService.findAll(req.user, { scope, status, priority, page: +page, limit: +limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single ticket' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.ticketsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update ticket status / assignment (staff only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @Request() req: any,
  ) {
    return this.ticketsService.update(id, dto, req.user);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a ticket' })
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
    @Request() req: any,
  ) {
    return this.ticketsService.addComment(id, dto, req.user);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get ticket comments' })
  getComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.ticketsService.getComments(id, req.user);
  }
}
