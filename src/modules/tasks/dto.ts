import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';
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
