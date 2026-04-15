/**
 * /jobs — a logical grouping layer over tasks.
 * The frontend treats jobs as task-groups/contracts. Since the DB has a single
 * Task model, this controller returns tasks shaped as Job objects so the
 * client-web pages work without a schema migration.
 */
import { BadRequestException, Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

function taskToJob(t: any) {
  return {
    id: t.id,
    workspaceId: t.workspaceId ?? null,
    businessId: t.businessId,
    title: t.title,
    description: t.description ?? '',
    status: t.status === 'PENDING' ? 'PUBLISHED'
      : t.status === 'ASSIGNED' ? 'IN_PROGRESS'
      : t.status === 'IN_PROGRESS' ? 'IN_PROGRESS'
      : t.status === 'UNDER_REVIEW' ? 'IN_PROGRESS'
      : t.status === 'COMPLETED' ? 'COMPLETED'
      : t.status === 'CANCELLED' ? 'CANCELLED'
      : t.status === 'FAILED' ? 'CANCELLED'
      : 'DRAFT',
    priority: t.priority ?? 'MEDIUM',
    slaMinutes: t.slaMinutes ?? 60,
    taskCount: 1,
    completedTaskCount: t.status === 'COMPLETED' ? 1 : 0,
    rateType: t.rateType ?? 'PER_TASK',
    rateAmount: t.rateAmount ?? 0,
    costEstimate: t.costEstimate ?? null,
    slaStatus: t.slaStatus ?? 'ON_TRACK',
    tags: t.tags ?? [],
    isTemplate: false,
    createdAt: t.createdAt,
    startAt: t.startedAt ?? null,
    dueAt: t.dueAt ?? null,
  };
}

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtUser,
    @Query('limit') limit = '20',
    @Query('page') page = '1',
    @Query('status') _status?: string,
    @Query('priority') priority?: string,
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const member = await this.prisma.businessMember.findFirst({
      where: { userId: user.sub },
      select: { businessId: true },
    });

    const where: any = member ? { businessId: member.businessId } : {};
    if (priority) where.priority = priority;

    const tasks = await this.prisma.task.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map(taskToJob);
  }

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() dto: any) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId: user.sub },
      select: { businessId: true },
    });
    const businessId = member?.businessId ?? dto.businessId;
    if (!businessId) {
      throw new BadRequestException('Your account is not linked to any business. Re-run the database seed or contact your administrator.');
    }
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        businessId,
        workspaceId: dto.workspaceId ?? undefined,
        priority: dto.priority ?? 'MEDIUM',
        slaMinutes: dto.slaMinutes ?? 60,
        status: 'PENDING',
        createdById: user.sub,
      },
    });
    return taskToJob(task);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id } });
    return taskToJob(task);
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.slaMinutes && { slaMinutes: Number(dto.slaMinutes) }),
      },
    });
    return taskToJob(task);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.task.delete({ where: { id } });
    return { deleted: true };
  }
}
