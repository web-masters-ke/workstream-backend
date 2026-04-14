import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaKind } from '@prisma/client';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('userId') userId?: string,
    @Query('kind') kind?: MediaKind,
  ) {
    return this.service.upload({ userId, file, kind });
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/signed')
  signed(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('expires') expires = '900',
  ) {
    return this.service.signed(id, Math.max(30, Number(expires) || 900));
  }

  @Get()
  list(
    @Query('userId') userId?: string,
    @Query('kind') kind?: MediaKind,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.list({
      userId,
      kind,
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
    });
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
