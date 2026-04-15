import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  InvoiceStatus,
  PayoutStatus,
  TransactionType,
  WalletOwnerType,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateWalletDto {
  @IsEnum(WalletOwnerType)
  ownerType!: WalletOwnerType;

  @IsString()
  ownerId!: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class WalletTopupDto {
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class WalletTransferDto {
  @IsUUID()
  fromWalletId!: string;

  @IsUUID()
  toWalletId!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class RecordTransactionDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsInt()
  amountCents!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  reference?: string;
}

export class RequestPayoutDto {
  @IsUUID()
  @IsOptional()
  agentId?: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  @IsOptional()
  method?: string;

  @IsString()
  @IsOptional()
  destination?: string;

  @IsUUID()
  @IsOptional()
  businessId?: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  type?: string; // ESCROW_RELEASE | DIRECT_PAYMENT
}

export class UpdatePayoutDto {
  @IsEnum(PayoutStatus)
  status!: PayoutStatus;
}

export class CreateInvoiceDto {
  @IsUUID()
  businessId!: string;

  @IsInt()
  amountCents!: number;

  @IsInt()
  @IsOptional()
  taxCents?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  dueAt?: string;

  @IsString()
  @IsOptional()
  issuedAt?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsOptional()
  lineItems?: any[];
}

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;
}

export class ListTransactionsDto extends PaginationDto {
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;
}
