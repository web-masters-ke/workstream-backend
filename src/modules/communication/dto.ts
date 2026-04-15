import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
} from 'class-validator';
import {
  CallStatus,
  CallType,
  ConversationType,
  MessageType,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  @IsOptional()
  type?: ConversationType;

  @IsString()
  @IsOptional()
  title?: string;

  @IsUUID()
  @IsOptional()
  taskId?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  participantUserIds!: string[];
}

export class SendMessageDto {
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @IsString()
  @IsOptional()
  body?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  attachmentUrl?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class ListMessagesDto extends PaginationDto {}

export class StartCallDto {
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @IsEnum(CallType)
  @IsOptional()
  type?: CallType;

  @IsString()
  @IsOptional()
  roomName?: string;

  @IsString()
  @IsOptional()
  meetingUrl?: string;

  @IsString()
  @IsOptional()
  meetingTitle?: string;

  @IsString()
  @IsOptional()
  participantIds?: string;

  /** ISO-8601 timestamp — if in the future the call is scheduled (status=INITIATED) */
  @IsString()
  @IsOptional()
  scheduledAt?: string;

  /** Recurrence rule: "DAILY" | "WEEKDAYS" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" */
  @IsString()
  @IsOptional()
  recurrenceRule?: string;
}

export class UpdateCallDto {
  @IsEnum(CallStatus)
  @IsOptional()
  status?: CallStatus;

  @IsInt()
  @IsOptional()
  durationSec?: number;

  @IsUrl({ require_tld: false })
  @IsOptional()
  recordingUrl?: string;

  @IsString()
  @IsOptional()
  meetingTitle?: string;

  @IsString()
  @IsOptional()
  participantIds?: string;
}
