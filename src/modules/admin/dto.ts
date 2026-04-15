import {
  Allow,
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
  TicketAssigneeType,
  TicketPriority,
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

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsEnum(TicketAssigneeType)
  @IsOptional()
  assigneeType?: TicketAssigneeType;

  @IsUUID()
  @IsOptional()
  assignedToAgentId?: string;

  @IsUUID()
  @IsOptional()
  assignedToBusinessId?: string;

  @IsString()
  subject!: string;

  @IsString()
  description!: string;
}

export class ResolveDisputeDto {
  @IsEnum(DisputeStatus)
  @IsOptional()
  status?: DisputeStatus;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsString()
  @IsOptional()
  resolution?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsEnum(TicketAssigneeType)
  @IsOptional()
  assigneeType?: TicketAssigneeType;

  @IsUUID()
  @IsOptional()
  assignedToAgentId?: string;

  @IsUUID()
  @IsOptional()
  assignedToBusinessId?: string;
}

export class AddTicketMessageDto {
  @IsString()
  body!: string;

  @IsBoolean()
  @IsOptional()
  internal?: boolean;
}

export class ListDisputesDto extends PaginationDto {
  @IsEnum(DisputeStatus)
  @IsOptional()
  status?: DisputeStatus;

  @IsUUID()
  @IsOptional()
  agentId?: string;

  @IsUUID()
  @IsOptional()
  businessId?: string;
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

  @Allow()
  value!: any;

  @IsString()
  @IsOptional()
  category?: string;
}

export class AdminCreateUserDto {
  @IsString()
  email!: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(['BUSINESS', 'AGENT', 'SUPERVISOR', 'ADMIN'])
  @IsOptional()
  role?: 'BUSINESS' | 'AGENT' | 'SUPERVISOR' | 'ADMIN';

  @IsString()
  @IsOptional()
  password?: string;

  // Business-specific fields
  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  businessLegalName?: string;

  @IsString()
  @IsOptional()
  businessIndustry?: string;

  @IsString()
  @IsOptional()
  businessCountry?: string;

  @IsString()
  @IsOptional()
  businessPhone?: string;

  @IsString()
  @IsOptional()
  businessWebsite?: string;

  @IsString()
  @IsOptional()
  businessAddress?: string;

  @IsString()
  @IsOptional()
  businessDescription?: string;

  @IsString()
  @IsOptional()
  businessRegistrationNumber?: string;

  @IsString()
  @IsOptional()
  businessTaxId?: string;

  // Agent-specific fields
  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @IsString()
  @IsOptional()
  bio?: string;

  // Org linking — for SUPERVISOR/ADMIN (required) and AGENT (optional)
  @IsUUID()
  @IsOptional()
  businessId?: string;
}

export class AdminCreateBusinessDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsString()
  contactEmail!: string;

  @IsString()
  ownerFirstName!: string;

  @IsString()
  @IsOptional()
  ownerLastName?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @IsString()
  @IsOptional()
  taxId?: string;
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
