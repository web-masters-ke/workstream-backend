import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  @Get()
  listApiKeys() {
    return [];
  }

  @Post()
  createApiKey(@Body() body: { label?: string }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return {
      id,
      label: body.label ?? 'Unnamed key',
      prefix: 'wk_',
      createdAt: new Date(),
    };
  }

  @Delete(':id')
  deleteApiKey(@Param('id') id: string) {
    return { deleted: true };
  }
}
