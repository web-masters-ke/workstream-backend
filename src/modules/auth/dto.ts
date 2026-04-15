import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsString()
  @IsOptional()
  mfaCode?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class EnableMfaDto {
  @IsString()
  code!: string;
}

export class SendOtpDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  /** Flutter / web send a unified identifier field (email or phone) */
  @IsString()
  @IsOptional()
  identifier?: string;

  @IsEnum(['register', 'reset', 'mfa'])
  purpose!: 'register' | 'reset' | 'mfa';
}

export class VerifyOtpDto {
  /** Web sends token; Flutter sends otp — accept both */
  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  @IsOptional()
  otp?: string;

  @IsString()
  @IsOptional()
  identifier?: string;

  @IsString()
  @IsOptional()
  userId?: string;
}
