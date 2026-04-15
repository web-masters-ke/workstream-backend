import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FcmService } from './fcm.service';
import { NotificationsGateway } from './notifications.gateway';
import { MailService } from './mail.service';
import { SmsService } from './sms.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, FcmService, NotificationsGateway, MailService, SmsService],
  exports: [NotificationsService, NotificationsGateway, MailService, SmsService],
})
export class NotificationsModule {}
