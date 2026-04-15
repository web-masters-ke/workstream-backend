import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { SmsService } from '../notifications/sms.service';

@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  @Get()
  async listMembers(@CurrentUser() user: JwtUser) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId: user.sub },
      select: { businessId: true },
    });
    if (!member) return [];

    return this.prisma.businessMember.findMany({
      where: { businessId: member.businessId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: { invitedAt: 'asc' },
    });
  }

  @Post()
  async inviteMember(
    @CurrentUser() user: JwtUser,
    @Body() body: { userId: string; role?: string; workspaceId?: string },
  ) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId: user.sub },
      select: { businessId: true },
    });
    if (!member) return { error: 'No business found for this user' };

    return this.prisma.businessMember.create({
      data: {
        businessId: member.businessId,
        userId: body.userId,
        role: (body.role as any) ?? 'MEMBER',
        workspaceId: body.workspaceId ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  @Post('invites')
  async inviteByEmail(
    @CurrentUser() user: JwtUser,
    @Body() body: {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      role?: string;
      workspaceId?: string;
      personalMessage?: string;
    },
  ) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId: user.sub },
      include: { business: { select: { id: true, name: true } } },
    });
    if (!member) throw new ConflictException('No business found for this user');

    const existing = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    // Resolve workspace/team name
    let teamName: string | null = null;
    if (body.workspaceId) {
      const ws = await this.prisma.workspace.findUnique({
        where: { id: body.workspaceId },
        select: { name: true },
      });
      teamName = ws?.name ?? null;
    }

    const tempPassword = `Ws${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 4).toUpperCase()}@1`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const fullName = [body.firstName, body.lastName].filter(Boolean).join(' ') || undefined;
    const businessName = member.business?.name ?? 'your team';
    const appUrl = process.env.APP_URL ?? 'http://localhost:3200';

    const newMember = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: body.email.toLowerCase(),
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          name: fullName,
          role: 'BUSINESS',
        },
      });
      return tx.businessMember.create({
        data: {
          businessId: member.businessId,
          userId: newUser.id,
          role: (body.role as any) ?? 'MEMBER',
          workspaceId: body.workspaceId ?? null,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });
    });

    const name = fullName ?? body.email;
    const teamLine = teamName ? `<tr><td style="color:#6b7280;padding:4px 0">Team</td><td style="font-weight:600">${teamName}</td></tr>` : '';
    const teamLineTxt = teamName ? `\nTeam: ${teamName}` : '';

    await this.mail.send({
      to: body.email,
      subject: `You've been added to ${businessName}${teamName ? ` — ${teamName} team` : ''} on Workstream`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#7c3aed">Welcome to ${businessName}!</h2>
          ${teamName ? `<p style="background:#f5f3ff;border-left:3px solid #7c3aed;padding:8px 12px;border-radius:4px;font-size:13px">You've been added to the <strong>${teamName}</strong> team.</p>` : ''}
          ${body.personalMessage ? `<p style="color:#374151">${body.personalMessage}</p>` : ''}
          <p>Hi ${name}, your Workstream account has been created. Here are your login details:</p>
          <table style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;width:100%;border-collapse:collapse">
            <tr><td style="color:#6b7280;padding:6px 8px">Login URL</td><td style="padding:6px 8px"><a href="${appUrl}" style="color:#7c3aed">${appUrl}</a></td></tr>
            <tr style="background:#f9fafb"><td style="color:#6b7280;padding:6px 8px">Email</td><td style="padding:6px 8px">${body.email}</td></tr>
            <tr><td style="color:#6b7280;padding:6px 8px">Temp password</td><td style="padding:6px 8px;font-family:monospace;font-weight:bold;font-size:15px">${tempPassword}</td></tr>
            <tr style="background:#f9fafb"><td style="color:#6b7280;padding:6px 8px">Role</td><td style="padding:6px 8px">${body.role ?? 'MEMBER'}</td></tr>
            ${teamLine}
          </table>
          <p style="color:#ef4444;font-size:13px;margin-top:16px">Please change your password after your first login.</p>
        </div>
      `,
      text: `You've been added to ${businessName}${teamName ? ` — ${teamName} team` : ''} on Workstream.\nLogin: ${appUrl}\nEmail: ${body.email}\nTemp password: ${tempPassword}\nRole: ${body.role ?? 'MEMBER'}${teamLineTxt}`,
    });

    if (body.phone) {
      await this.sms.send({
        to: body.phone.replace(/\D/g, ''),
        message: `${businessName}${teamName ? ` (${teamName} team)` : ''} added you to Workstream. Login: ${appUrl} | Email: ${body.email} | Pass: ${tempPassword}`,
      });
    }

    return newMember;
  }

  @Get('invites')
  getInvites() {
    return [];
  }

  @Patch(':memberId')
  async updateMember(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: { role?: string; workspaceId?: string },
  ) {
    return this.prisma.businessMember.update({
      where: { id: memberId },
      data: {
        ...(body.role && { role: body.role as any }),
        ...(body.workspaceId !== undefined && { workspaceId: body.workspaceId }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  @Delete(':memberId')
  async removeMember(@Param('memberId', ParseUUIDPipe) memberId: string) {
    await this.prisma.businessMember.delete({ where: { id: memberId } });
    return { deleted: true };
  }
}
