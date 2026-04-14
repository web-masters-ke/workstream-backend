import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto, SendNotificationDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('send')
  send(@Body() dto: SendNotificationDto) {
    return this.service.send(dto);
  }

  // GET /notifications — returns current user's notifications (used by client-web Shell)
  @Get()
  @UseGuards(JwtAuthGuard)
  async listMine(
    @CurrentUser() user: JwtUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('unreadOnly', new ParseBoolPipe({ optional: true })) unreadOnly = false,
  ) {
    const [items, total] = await this.service.listForUser(user.sub, {
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      unreadOnly: !!unreadOnly,
    });
    return { items, total };
  }

  @Get('user/:userId')
  async list(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('unreadOnly', new ParseBoolPipe({ optional: true })) unreadOnly = false,
  ) {
    const [items, total] = await this.service.listForUser(userId, {
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      unreadOnly: !!unreadOnly,
    });
    return { items, total };
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.markRead(id);
  }

  @Patch('user/:userId/read-all')
  markAll(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.markAllRead(userId);
  }

  @Post('devices/register')
  register(@Body() dto: RegisterDeviceDto) {
    return this.service.registerDevice(dto);
  }

  @Post('devices/unregister')
  unregister(@Body() dto: RegisterDeviceDto) {
    return this.service.unregisterDevice(dto);
  }
}
