import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { LocalStorageDriver } from './storage/local.driver';
import { S3StorageDriver } from './storage/s3.driver';

@Module({
  controllers: [MediaController],
  providers: [MediaService, LocalStorageDriver, S3StorageDriver],
  exports: [MediaService],
})
export class MediaModule {}
