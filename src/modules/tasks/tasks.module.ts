import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { JobsController } from './jobs.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController, JobsController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
