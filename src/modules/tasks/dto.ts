import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';
import { TaskPriority, TaskStatus, SubmissionRound, SubmissionType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateTaskDto {
  @IsUUID()
  businessId!: string;

  @IsUUID()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredSkills?: string[];

  @IsInt()
  @IsOptional()
  budgetCents?: number;

  @IsDateString()
  @IsOptional()
  dueAt?: string;

  @IsInt()
  @IsOptional()
  slaMinutes?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredSkills?: string[];

  @IsInt()
  @IsOptional()
  budgetCents?: number;

  @IsDateString()
  @IsOptional()
  dueAt?: string;
}

export class TransitionTaskDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsString()
  @IsOptional()
  note?: string;
}

export class AssignTaskDto {
  @IsUUID()
  agentId!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AssignmentResponseDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ListTasksDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  businessId?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsUUID()
  @IsOptional()
  workspaceId?: string;
}

export class CreateSubmissionDto {
  @IsEnum(['FIRST_DRAFT', 'SECOND_DRAFT', 'FINAL'])
  round!: SubmissionRound;

  @IsEnum(['FILE', 'LINK', 'TEXT', 'OTHER'])
  type!: SubmissionType;

  @IsString()
  @IsOptional()
  content?: string; // text body or URL

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsInt()
  @IsOptional()
  fileSize?: number;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReviewSubmissionDto {
  @IsEnum(['APPROVED', 'REVISION_REQUESTED', 'REJECTED'])
  status!: 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED';

  @IsString()
  @IsOptional()
  reviewNote?: string;
}
