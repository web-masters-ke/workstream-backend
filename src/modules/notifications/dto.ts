import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class SendNotificationDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  @IsOptional()
  data?: Record<string, any>;

  @IsUrl({ require_tld: false })
  @IsOptional()
  imageUrl?: string;
}

export class RegisterDeviceDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;
}
