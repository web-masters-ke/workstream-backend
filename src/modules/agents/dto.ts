import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AgentStatus,
  AgentType,
  AvailabilityStatus,
  KycStatus,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateAgentDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  @IsOptional()
  businessId?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  headline?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsInt()
  @IsOptional()
  hourlyRateCents?: number;
}

export class UpdateAgentDto {
  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  headline?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsInt()
  @IsOptional()
  hourlyRateCents?: number;
}

export class AddSkillDto {
  @IsString()
  skill!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  proficiencyLevel?: number;

  @IsInt()
  @IsOptional()
  yearsOfExperience?: number;
}

export class SetAvailabilityDto {
  @IsEnum(AvailabilityStatus)
  availability!: AvailabilityStatus;
}

export class UpdateAgentStatusDto {
  @IsEnum(AgentStatus)
  status!: AgentStatus;
}

export class UpdateKycDto {
  @IsEnum(KycStatus)
  kycStatus!: KycStatus;
}

export class AddAvailabilitySlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsString()
  @IsOptional()
  timezone?: string;
}

export class InviteAgentDto {
  @IsEmail()
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

  @IsUUID()
  @IsOptional()
  businessId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @IsInt()
  @IsOptional()
  hourlyRateCents?: number;

  @IsEnum(['EMPLOYEE', 'FREELANCER'])
  @IsOptional()
  agentType?: AgentType;

  @IsString()
  @IsOptional()
  personalMessage?: string;
}

export class ListAgentsDto extends PaginationDto {
  @IsEnum(AgentStatus)
  @IsOptional()
  status?: AgentStatus;

  @IsEnum(AvailabilityStatus)
  @IsOptional()
  availability?: AvailabilityStatus;

  @IsUUID()
  @IsOptional()
  businessId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Type(() => String)
  skills?: string[];
}
