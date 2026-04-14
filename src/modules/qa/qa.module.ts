import { Module } from '@nestjs/common';
import { QAController } from './qa.controller';
import { QAService } from './qa.service';

@Module({
  controllers: [QAController],
  providers: [QAService],
  exports: [QAService],
})
export class QAModule {}
