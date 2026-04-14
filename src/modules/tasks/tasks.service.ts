import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskAssignmentStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams, PaginationDto } from '../../common/dto/pagination.dto';
import {
  AssignTaskDto,
  AssignmentResponseDto,
  CreateTaskDto,
  ListTasksDto,
  TransitionTaskDto,
  UpdateTaskDto,
} from './dto';

// Allowed transitions matrix
const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED', 'ON_HOLD'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED', 'ON_HOLD', 'PENDING'],
  IN_PROGRESS: ['COMPLETED', 'FAILED', 'ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED', 'PENDING'],
  COMPLETED: [],
  FAILED: ['PENDING'],
  CANCELLED: [],
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(creatorId: string, dto: CreateTaskDto) {
    const business = await this.prisma.business.findUnique({
      where: { id: dto.businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          ...dto,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          createdById: creatorId,
        },
      });
      await tx.taskHistory.create({
        data: {
          taskId: task.id,
          actorId: creatorId,
          toStatus: task.status,
          note: 'Task created',
        },
      });
      return task;
    });
  }

  async list(dto: ListTasksDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.businessId) where.businessId = dto.businessId;
    if (dto.status) where.status = dto.status;
    if (dto.priority) where.priority = dto.priority;
    if (dto.workspaceId) where.workspaceId = dto.workspaceId;
    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignments: {
            include: {
              agent: { include: { user: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const t = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            agent: { include: { user: true } },
          },
        },
        history: { orderBy: { createdAt: 'desc' }, take: 50 },
        business: { select: { id: true, name: true } },
      },
    });
    if (!t) throw new NotFoundException('Task not found');
    return t;
  }

  async update(id: string, dto: UpdateTaskDto) {
    await this.assertExists(id);
    return this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
    });
  }

  async transition(taskId: string, actorId: string, dto: TransitionTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const allowed = ALLOWED[task.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid transition: ${task.status} -> ${dto.status}`,
      );
    }

    const data: any = { status: dto.status };
    if (dto.status === 'IN_PROGRESS' && !task.startedAt)
      data.startedAt = new Date();
    if (dto.status === 'COMPLETED') data.completedAt = new Date();
    if (dto.status === 'CANCELLED') data.cancelledAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id: taskId }, data });
      await tx.taskHistory.create({
        data: {
          taskId,
          actorId,
          fromStatus: task.status,
          toStatus: dto.status,
          note: dto.note,
        },
      });

      if (dto.status === 'COMPLETED') {
        await tx.agent.updateMany({
          where: { assignments: { some: { taskId } } },
          data: {
            completedTasks: { increment: 1 },
            totalTasks: { increment: 1 },
          },
        });
      }
      return updated;
    });
  }

  async assign(taskId: string, actorId: string, dto: AssignTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      throw new BadRequestException('Cannot assign a closed task');
    }
    const agent = await this.prisma.agent.findUnique({
      where: { id: dto.agentId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    return this.prisma.$transaction(async (tx) => {
      const a = await tx.taskAssignment.upsert({
        where: { taskId_agentId: { taskId, agentId: dto.agentId } },
        create: {
          taskId,
          agentId: dto.agentId,
          status: 'OFFERED',
          notes: dto.notes,
        },
        update: { status: 'OFFERED', notes: dto.notes },
      });
      if (task.status === 'PENDING') {
        await tx.task.update({
          where: { id: taskId },
          data: { status: 'ASSIGNED' },
        });
        await tx.taskHistory.create({
          data: {
            taskId,
            actorId,
            fromStatus: 'PENDING',
            toStatus: 'ASSIGNED',
            note: `Assigned to agent ${dto.agentId}`,
          },
        });
      }
      return a;
    });
  }

  async respondToAssignment(
    assignmentId: string,
    agentUserId: string,
    accept: boolean,
    dto: AssignmentResponseDto,
  ) {
    const a = await this.prisma.taskAssignment.findUnique({
      where: { id: assignmentId },
      include: { agent: true },
    });
    if (!a) throw new NotFoundException('Assignment not found');
    if (a.agent.userId !== agentUserId) {
      throw new ForbiddenException('Not your assignment');
    }
    const status: TaskAssignmentStatus = accept ? 'ACCEPTED' : 'DECLINED';
    return this.prisma.taskAssignment.update({
      where: { id: assignmentId },
      data: {
        status,
        notes: dto.notes,
        acceptedAt: accept ? new Date() : null,
        declinedAt: accept ? null : new Date(),
      },
    });
  }

  async history(taskId: string) {
    await this.assertExists(taskId);
    return this.prisma.taskHistory.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.task.delete({ where: { id } });
    return { success: true };
  }

  async listAvailable(agentId: string, dto: PaginationDto) {
    const { skip, limit, page } = pageParams(dto);
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { skills: true },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const agentSkills = agent.skills.map((s) => s.skill);

    // Find tasks that are PENDING with no active (OFFERED or ACCEPTED) assignment
    const tasks = await this.prisma.task.findMany({
      where: {
        status: 'PENDING',
        NOT: {
          assignments: {
            some: { status: { in: ['OFFERED', 'ACCEPTED'] } },
          },
        },
        OR: agentSkills.length
          ? [
              { requiredSkills: { isEmpty: true } },
              {
                requiredSkills: {
                  hasSome: agentSkills,
                },
              },
            ]
          : undefined,
      },
      skip,
      take: limit,
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
      include: {
        business: { select: { id: true, name: true } },
      },
    });

    const total = await this.prisma.task.count({
      where: {
        status: 'PENDING',
        NOT: {
          assignments: {
            some: { status: { in: ['OFFERED', 'ACCEPTED'] } },
          },
        },
        OR: agentSkills.length
          ? [
              { requiredSkills: { isEmpty: true } },
              {
                requiredSkills: {
                  hasSome: agentSkills,
                },
              },
            ]
          : undefined,
      },
    });

    return { items: tasks, total, page, limit };
  }

  async escalate(taskId: string, actorId: string, reason: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        business: {
          include: {
            members: {
              where: { role: 'OWNER' },
              include: { user: true },
            },
          },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    await this.prisma.taskHistory.create({
      data: {
        taskId,
        actorId,
        toStatus: task.status,
        note: `ESCALATION: ${reason}`,
      },
    });

    // Notify business owner(s)
    const owners = task.business?.members ?? [];
    for (const member of owners) {
      await this.prisma.notification.create({
        data: {
          userId: member.userId,
          title: 'Task Escalated',
          body: `Task "${task.title}" has been escalated: ${reason}`,
          channel: 'IN_APP',
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }

    return task;
  }

  async getSLABreaches(businessId?: string) {
    const now = new Date();
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'ASSIGNED'] },
        dueAt: { lt: now },
        ...(businessId ? { businessId } : {}),
      },
      include: {
        assignments: {
          where: { status: { in: ['ACCEPTED', 'OFFERED'] } },
          include: {
            agent: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    });

    return tasks.map((t) => ({
      ...t,
      minutesOverdue: Math.floor((now.getTime() - t.dueAt!.getTime()) / 60000),
    }));
  }

  private async assertExists(id: string) {
    const t = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!t) throw new NotFoundException('Task not found');
  }
}
