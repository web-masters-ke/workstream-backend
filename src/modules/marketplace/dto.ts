import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum ListingSort {
  NEWEST = 'NEWEST',
  BUDGET_HIGH = 'BUDGET_HIGH',
  BUDGET_LOW = 'BUDGET_LOW',
  DEADLINE_SOON = 'DEADLINE_SOON',
  MOST_BIDS = 'MOST_BIDS',
}

export class CreateListingDto {
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredSkills?: string[];

  @IsInt()
  @IsPositive()
  budgetCents: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsDateString()
  dueAt: string;

  @IsDateString()
  @IsOptional()
  marketplaceExpiresAt?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxBids?: number;

  @IsString()
  @IsOptional()
  locationText?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}

export class UpdateListingDto {
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  @IsOptional()
  title?: string;

  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredSkills?: string[];

  @IsInt()
  @IsPositive()
  @IsOptional()
  budgetCents?: number;

  @IsDateString()
  @IsOptional()
  dueAt?: string;

  @IsDateString()
  @IsOptional()
  marketplaceExpiresAt?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxBids?: number;

  @IsString()
  @IsOptional()
  locationText?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}

export class BrowseListingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  skill?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  budgetMinCents?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  budgetMaxCents?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(ListingSort)
  @IsOptional()
  sort?: ListingSort;
}

export class PlaceBidDto {
  @IsInt()
  @IsPositive()
  proposedCents: number;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  coverNote: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedDays?: number;
}

export class ReviewBidDto {
  @IsString()
  @IsOptional()
  rejectionNote?: string;
}

export class AdminReviewListingDto {
  @IsString()
  @IsOptional()
  note?: string;
}
