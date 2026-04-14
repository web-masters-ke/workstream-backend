import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  AuditSeverity,
  DisputeCategory,
  DisputeStatus,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ReviewKycDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  note?: string;
}

export class FileDisputeDto {
  @IsUUID()
  @IsOptional()
  taskId?: string;

  @IsEnum(DisputeCategory)
  category!: DisputeCategory;

  @IsString()
  subject!: string;

  @IsString()
  description!: string;
}

export class ResolveDisputeDto {
  @IsEnum(DisputeStatus)
  status!: DisputeStatus;

  @IsString()
  @IsOptional()
  resolution?: string;
}

export class ListDisputesDto extends PaginationDto {
  @IsEnum(DisputeStatus)
  @IsOptional()
  status?: DisputeStatus;
}

export class ListAuditLogsDto extends PaginationDto {
  @IsString()
  @IsOptional()
  entityType?: string;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  action?: string;

  @IsEnum(AuditSeverity)
  @IsOptional()
  severity?: AuditSeverity;
}

export class UpsertSettingDto {
  @IsString()
  key!: string;

  value!: any;

  @IsString()
  @IsOptional()
  category?: string;
}

export class UpsertFeatureFlagDto {
  @IsString()
  key!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPct?: number;
}
