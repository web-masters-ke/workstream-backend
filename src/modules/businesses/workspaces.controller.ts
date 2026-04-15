import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /workspaces/members — members of all workspaces for the current user's business
  @Get('members')
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
        workspace: {
          select: { id: true, name: true },
        },
      },
      orderBy: { invitedAt: 'asc' },
    });
  }

  // GET /workspaces/settings — workspace-level settings for the current user (readable by any member)
  @Get('settings')
  async getSettings(@CurrentUser() user: JwtUser) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId: user.sub },
      select: { businessId: true, workspaceId: true },
    });
    if (!member) return { name: '', timezone: 'UTC', defaultSlaMinutes: 60, escalationRules: '' };

    const workspace = member.workspaceId
      ? await this.prisma.workspace.findUnique({ where: { id: member.workspaceId } })
      : await this.prisma.workspace.findFirst({ where: { businessId: member.businessId } });

    return {
      name: workspace?.name ?? '',
      description: workspace?.description ?? '',
      timezone: 'UTC',
      defaultSlaMinutes: 60,
      escalationRules: 'At 75% of SLA — notify supervisor.\nAt 100% — reassign to next available agent.',
      workspaceId: workspace?.id ?? null,
    };
  }

  // PATCH /workspaces/settings — update the current user's default workspace
  @Patch('settings')
  async saveSettings(@CurrentUser() user: JwtUser, @Body() dto: { name?: string; timezone?: string; defaultSlaMinutes?: number; escalationRules?: string }) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId: user.sub },
      select: { businessId: true, workspaceId: true },
    });
    if (!member) return { ok: false };

    const workspace = member.workspaceId
      ? await this.prisma.workspace.findUnique({ where: { id: member.workspaceId } })
      : await this.prisma.workspace.findFirst({ where: { businessId: member.businessId } });

    if (!workspace) return { ok: false };

    await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: { ...(dto.name && { name: dto.name }) },
    });
    return { ok: true };
  }

  // GET /workspaces — current user's business workspaces (admins see all)
  @Get()
  async list(@CurrentUser() user: JwtUser) {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
    if (isAdmin) {
      const workspaces = await this.prisma.workspace.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { id: true, name: true, contactEmail: true } },
          _count: { select: { members: true, tasks: true } },
        },
      });
      return workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        businessId: w.businessId,
        businessName: w.business?.name ?? null,
        timezone: w.timezone ?? 'UTC',
        currency: w.currency ?? 'USD',
        memberCount: w._count.members,
        taskCount: w._count.tasks,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));
    }

    const member = await this.prisma.businessMember.findFirst({
      where: { userId: user.sub },
      select: { businessId: true },
    });
    if (!member) return [];
    return this.prisma.workspace.findMany({
      where: { businessId: member.businessId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // POST /workspaces — create a workspace (admins supply businessId directly)
  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() dto: { name: string; description?: string; businessId?: string; timezone?: string; currency?: string }) {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERVISOR';

    let bizId: string;
    if (isAdmin && dto.businessId) {
      bizId = dto.businessId;
    } else {
      const member = await this.prisma.businessMember.findFirst({
        where: { userId: user.sub },
        select: { businessId: true },
      });
      if (!member) return { error: 'No business found for this user' };
      bizId = member.businessId;
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        businessId: bizId,
        name: dto.name,
        description: dto.description,
        timezone: dto.timezone ?? 'UTC',
        currency: dto.currency ?? 'USD',
      },
      include: {
        business: { select: { id: true, name: true } },
        _count: { select: { members: true, tasks: true } },
      },
    });

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      businessId: workspace.businessId,
      businessName: workspace.business?.name ?? null,
      timezone: workspace.timezone ?? 'UTC',
      currency: workspace.currency ?? 'USD',
      memberCount: workspace._count.members,
      taskCount: workspace._count.tasks,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  // PATCH /workspaces/:id — update a workspace
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: { name?: string; description?: string }) {
    return this.prisma.workspace.update({
      where: { id },
      data: { ...(dto.name && { name: dto.name }), ...(dto.description !== undefined && { description: dto.description }) },
    });
  }

  // DELETE /workspaces/:id — delete a workspace
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.workspace.delete({ where: { id } });
  }
}
