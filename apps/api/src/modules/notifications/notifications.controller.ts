import {
  Controller, Get, Patch, Param, Query,
  UseGuards, Request, ParseUUIDPipe, Sse,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { map } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  /**
   * SSE stream — real-time notification delivery
   * GET /api/v1/notifications/stream
   * Client connects with EventSource and receives events as they occur.
   */
  @Sse('stream')
  @ApiOperation({ summary: 'Real-time notification stream (SSE)' })
  stream(@Request() req: any) {
    return this.svc.streamForUser(req.user.id).pipe(
      map(({ notification }) => ({
        data: JSON.stringify(notification),
      })),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List notifications (paginated)' })
  findAll(
    @Request() req: any,
    @Query('read') read?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.findAll(req.user.id, {
      read:  read !== undefined ? read === 'true' : undefined,
      page:  +page,
      limit: +limit,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Request() req: any) {
    const count = await this.svc.getUnreadCount(req.user.id);
    return { data: { count } };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.markRead(id, req.user.id);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Request() req: any) {
    return this.svc.markAllRead(req.user.id);
  }
}
