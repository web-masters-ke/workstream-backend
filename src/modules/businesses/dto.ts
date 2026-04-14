import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
} from 'class-validator';
import { BusinessMemberRole, BusinessStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateBusinessDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  logoUrl?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  website?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;
}

export class UpdateBusinessDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  logoUrl?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  website?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsEnum(BusinessStatus)
  @IsOptional()
  status?: BusinessStatus;
}

export class CreateWorkspaceDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class AddMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(BusinessMemberRole)
  @IsOptional()
  role?: BusinessMemberRole;

  @IsUUID()
  @IsOptional()
  workspaceId?: string;
}

export class UpdateMemberDto {
  @IsEnum(BusinessMemberRole)
  role!: BusinessMemberRole;
}

export class ListBusinessesDto extends PaginationDto {
  @IsEnum(BusinessStatus)
  @IsOptional()
  status?: BusinessStatus;
}
