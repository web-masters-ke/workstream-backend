import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { WorkspacesController } from './workspaces.controller';
import { BusinessesService } from './businesses.service';

@Module({
  controllers: [BusinessesController, WorkspacesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
