import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly prisma: PrismaService) {}

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
