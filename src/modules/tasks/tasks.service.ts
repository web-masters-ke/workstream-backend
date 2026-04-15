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
  CreateSubmissionDto,
  CreateTaskDto,
  ListTasksDto,
  ReviewSubmissionDto,
  TransitionTaskDto,
  UpdateTaskDto,
} from './dto';

// Allowed transitions matrix
const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED', 'ON_HOLD'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED', 'ON_HOLD', 'PENDING'],
  IN_PROGRESS: ['UNDER_REVIEW', 'COMPLETED', 'FAILED', 'ON_HOLD', 'CANCELLED'],
  UNDER_REVIEW: ['IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED', 'PENDING'],
  COMPLETED: ['IN_PROGRESS', 'PENDING'],
  FAILED: ['PENDING'],
  CANCELLED: ['PENDING'],
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

  async listForAgent(agentId: string, dto: ListTasksDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {
      assignments: { some: { agentId } },
    };
    if (dto.status) where.status = dto.status;
    if (dto.priority) where.priority = dto.priority;
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
            where: { agentId },
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

        // Auto-pay agents from business wallet when task completes
        if (task.budgetCents && task.budgetCents > 0) {
          const assignments = await tx.taskAssignment.findMany({
            where: { taskId, status: { in: ['ACCEPTED', 'OFFERED'] } },
            select: { agentId: true },
          });

          if (assignments.length > 0) {
            const businessWallet = await tx.wallet.findUnique({
              where: { businessId: task.businessId },
            });

            if (businessWallet && businessWallet.balanceCents >= BigInt(task.budgetCents)) {
              const perAgent = Math.floor(task.budgetCents / assignments.length);
              let bizBal = businessWallet.balanceCents;

              for (const { agentId } of assignments) {
                const agentWallet = await tx.wallet.findUnique({
                  where: { ownerType_ownerId: { ownerType: 'AGENT', ownerId: agentId } },
                });
                if (!agentWallet) continue;

                // Debit business wallet
                bizBal = bizBal - BigInt(perAgent);
                await tx.wallet.update({
                  where: { id: businessWallet.id },
                  data: { balanceCents: bizBal },
                });
                await tx.walletTransaction.create({
                  data: {
                    walletId: businessWallet.id,
                    type: 'DEBIT',
                    status: 'COMPLETED',
                    amountCents: BigInt(perAgent),
                    currency: businessWallet.currency,
                    balanceAfterCents: bizBal,
                    reference: `task:${taskId}:pay:${agentId}`,
                    description: `Task payment: "${task.title}"`,
                    completedAt: new Date(),
                  },
                });

                // Credit agent wallet
                const agentNewBal = agentWallet.balanceCents + BigInt(perAgent);
                await tx.wallet.update({
                  where: { id: agentWallet.id },
                  data: { balanceCents: agentNewBal },
                });
                await tx.walletTransaction.create({
                  data: {
                    walletId: agentWallet.id,
                    type: 'TASK_PAYMENT',
                    status: 'COMPLETED',
                    amountCents: BigInt(perAgent),
                    currency: agentWallet.currency,
                    balanceAfterCents: agentNewBal,
                    reference: `task:${taskId}`,
                    description: `Payment for completed task: "${task.title}"`,
                    completedAt: new Date(),
                  },
                });
              }
            }
          }
        }
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

  async listSubmissions(taskId: string) {
    await this.assertExists(taskId);
    const items = await this.prisma.taskSubmission.findMany({
      where: { taskId },
      orderBy: { submittedAt: 'desc' },
      include: {
        agent: {
          select: { user: { select: { name: true, firstName: true, lastName: true } } },
        },
      },
    });
    return items.map((s) => ({
      ...s,
      agentName: (s.agent as any)?.user?.name
        ?? [(s.agent as any)?.user?.firstName, (s.agent as any)?.user?.lastName].filter(Boolean).join(' ')
        ?? 'Agent',
    }));
  }

  async createSubmission(taskId: string, agentUserId: string, dto: CreateSubmissionDto) {
    await this.assertExists(taskId);

    const agent = await this.prisma.agent.findUnique({
      where: { userId: agentUserId },
      select: { id: true },
    });
    if (!agent) throw new ForbiddenException('Agent profile not found');

    const assigned = await this.prisma.taskAssignment.findFirst({
      where: { taskId, agentId: agent.id, status: 'ACCEPTED' },
    });
    if (!assigned) throw new ForbiddenException('You are not assigned to this task');

    const submission = await this.prisma.taskSubmission.create({
      data: {
        taskId,
        agentId: agent.id,
        round: dto.round,
        type: dto.type,
        content: dto.content ?? null,
        fileUrl: dto.fileUrl ?? null,
        fileName: dto.fileName ?? null,
        fileSize: dto.fileSize ?? null,
        mimeType: dto.mimeType ?? null,
        notes: dto.notes ?? null,
        status: 'SUBMITTED',
      },
    });

    // Move task to UNDER_REVIEW if it's in progress
    await this.prisma.task.updateMany({
      where: { id: taskId, status: 'IN_PROGRESS' },
      data: { status: 'UNDER_REVIEW' },
    });

    return submission;
  }

  async reviewSubmission(taskId: string, submissionId: string, dto: ReviewSubmissionDto) {
    await this.assertExists(taskId);

    const submission = await this.prisma.taskSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission || submission.taskId !== taskId) {
      throw new NotFoundException('Submission not found');
    }

    const updated = await this.prisma.taskSubmission.update({
      where: { id: submissionId },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote ?? null,
        reviewedAt: new Date(),
      },
    });

    if (dto.status === 'APPROVED') {
      await this.prisma.task.update({
        where: { id: taskId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    } else if (dto.status === 'REVISION_REQUESTED') {
      await this.prisma.task.updateMany({
        where: { id: taskId, status: 'UNDER_REVIEW' },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return updated;
  }

  private async assertExists(id: string) {
    const t = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!t) throw new NotFoundException('Task not found');
  }
}
