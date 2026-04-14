import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TeamController } from './team.controller';
import { ApiKeysController } from './api-keys.controller';
import { WebhooksController } from './webhooks.controller';

@Module({
  controllers: [UsersController, TeamController, ApiKeysController, WebhooksController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
