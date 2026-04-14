import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  @Get()
  listWebhooks() {
    return [];
  }

  @Post()
  createWebhook(@Body() body: Record<string, any>) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return {
      id,
      ...body,
      active: true,
      createdAt: new Date(),
    };
  }

  @Patch(':id')
  updateWebhook(@Param('id') id: string, @Body() body: Record<string, any>) {
    return { id, ...body };
  }

  @Delete(':id')
  deleteWebhook(@Param('id') id: string) {
    return { deleted: true };
  }
}
