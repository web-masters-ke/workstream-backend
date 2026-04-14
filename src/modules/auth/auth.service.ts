import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role ?? 'BUSINESS',
        name:
          [dto.firstName, dto.lastName].filter(Boolean).join(' ') || undefined,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return { user: this.publicUser(user), ...tokens };
  }

  async login(dto: LoginDto, userAgent?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account not active');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (user.mfaEnabled && !dto.mfaCode) {
      throw new UnauthorizedException('MFA code required');
    }
    // TODO: real MFA verification (TOTP). Placeholder accepts any 6-digit code.
    if (user.mfaEnabled && dto.mfaCode && !/^\d{6}$/.test(dto.mfaCode)) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.role,
      userAgent,
      ip,
    );
    return { user: this.publicUser(user), ...tokens };
  }

  async refresh(dto: RefreshDto) {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: dto.refreshToken },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const access = await this.signAccess(
      session.userId,
      session.user.email,
      session.user.role,
    );
    return { accessToken: access };
  }

  async logout(refreshToken: string) {
    await this.prisma.userSession.updateMany({
      where: { refreshToken },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) return { success: true }; // do not leak
    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    // TODO: email the token
    return { success: true, token };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new NotFoundException('User not found');
    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Wrong current password');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.publicUser(user);
  }

  async sendOtp(dto: SendOtpDto) {
    // Resolve userId by phone or email
    let userId: string | undefined;
    if (dto.email) {
      const u = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
        select: { id: true },
      });
      userId = u?.id;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in PasswordResetToken reusing the table; prefix token with purpose
    const stored = `otp:${dto.purpose}:${otp}`;
    await this.prisma.passwordResetToken.create({
      data: {
        userId: userId ?? (await this.getOrCreatePlaceholderUser()),
        token: stored,
        expiresAt,
      },
    });

    // In production: SMS/email the OTP. For now, log to console.
    console.log(`[OTP] ${dto.purpose} code for ${dto.phone ?? dto.email}: ${otp}`);
    return { sent: true };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    // Token stored as "otp:<purpose>:<code>" — caller sends just the 6-digit code
    // Support both raw code and full stored token
    const tokenValue = dto.token.startsWith('otp:') ? dto.token : `otp:${dto.token}`;

    // Search by partial match pattern — find all non-expired otp tokens
    const rows = await this.prisma.passwordResetToken.findMany({
      where: {
        token: { startsWith: 'otp:' },
        usedAt: null,
        expiresAt: { gt: new Date() },
        ...(dto.userId ? { userId: dto.userId } : {}),
      },
    });

    const match = rows.find(
      (r) =>
        r.token === tokenValue ||
        r.token.endsWith(`:${dto.token}`),
    );

    if (!match) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.passwordResetToken.update({
      where: { id: match.id },
      data: { usedAt: new Date() },
    });

    return { verified: true };
  }

  private async getOrCreatePlaceholderUser(): Promise<string> {
    // OTPs for unregistered phones/emails need a placeholder userId
    // Use a system user or create one
    const placeholder = await this.prisma.user.findUnique({
      where: { email: 'system-otp-placeholder@internal' },
      select: { id: true },
    });
    if (placeholder) return placeholder.id;
    const created = await this.prisma.user.create({
      data: {
        email: 'system-otp-placeholder@internal',
        passwordHash: '',
        role: 'AGENT',
        status: 'SUSPENDED',
      },
    });
    return created.id;
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    userAgent?: string,
    ip?: string,
  ) {
    const accessToken = await this.signAccess(userId, email, role);
    const refreshToken = randomBytes(48).toString('hex');
    const ttl =
      Number(this.config.get('JWT_REFRESH_TTL')) || 60 * 60 * 24 * 30;
    await this.prisma.userSession.create({
      data: {
        userId,
        refreshToken,
        userAgent,
        ipAddress: ip,
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  private async signAccess(userId: string, email: string, role: string) {
    const ttl = Number(this.config.get('JWT_ACCESS_TTL')) || 900;
    return this.jwt.signAsync(
      { sub: userId, email, role },
      { expiresIn: ttl },
    );
  }

  private publicUser(u: any) {
    const { passwordHash, mfaSecret, ...safe } = u;
    return safe;
  }
}
