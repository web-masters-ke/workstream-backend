import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ShiftStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateShiftDto {
  @IsUUID()
  agentId!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateShiftDto {
  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsDateString()
  @IsOptional()
  endAt?: string;

  @IsEnum(ShiftStatus)
  @IsOptional()
  status?: ShiftStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ListShiftsDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  agentId?: string;

  @IsEnum(ShiftStatus)
  @IsOptional()
  status?: ShiftStatus;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}

export class RouteTaskDto {
  @IsUUID()
  taskId!: string;

  @IsInt()
  @IsOptional()
  maxCandidates?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredSkills?: string[];
}
