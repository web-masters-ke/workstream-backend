import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateQAReviewDto {
  @IsUUID()
  taskId!: string;

  @IsUUID()
  agentId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsOptional()
  criteria?: Record<string, number>;
}

export class ListQAReviewsDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  agentId?: string;

  @IsUUID()
  @IsOptional()
  taskId?: string;
}
