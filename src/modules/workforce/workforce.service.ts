import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import {
  CreateShiftDto,
  ListShiftsDto,
  RouteTaskDto,
  UpdateShiftDto,
} from './dto';

@Injectable()
export class WorkforceService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Shifts ----
  async createShift(dto: CreateShiftDto) {
    if (new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException('endAt must be after startAt');
    }
    return this.prisma.shift.create({
      data: {
        agentId: dto.agentId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        notes: dto.notes,
      },
    });
  }

  async listShifts(dto: ListShiftsDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.agentId) where.agentId = dto.agentId;
    if (dto.status) where.status = dto.status;
    if (dto.from || dto.to) {
      where.startAt = {};
      if (dto.from) where.startAt.gte = new Date(dto.from);
      if (dto.to) where.startAt.lte = new Date(dto.to);
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.shift.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async updateShift(id: string, dto: UpdateShiftDto) {
    const s = await this.prisma.shift.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Shift not found');
    return this.prisma.shift.update({
      where: { id },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
    });
  }

  async deleteShift(id: string) {
    const s = await this.prisma.shift.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Shift not found');
    await this.prisma.shift.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Rule-based routing engine.
   * Scores candidate agents by:
   *   - ONLINE availability
   *   - skill overlap with task.requiredSkills
   *   - rating
   *   - active assignment count (lower = better)
   *
   * BED §9.2 calls for an AI-driven matcher; this is the deterministic
   * placeholder that will be swapped out later.
   */
  async routeTask(dto: RouteTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: dto.taskId },
    });
    if (!task) throw new NotFoundException('Task not found');

    const skills = dto.requiredSkills ?? task.requiredSkills ?? [];
    const maxCandidates = dto.maxCandidates ?? 5;

    const agents = await this.prisma.agent.findMany({
      where: {
        status: 'ACTIVE',
        availability: { in: ['ONLINE', 'ON_SHIFT'] },
        OR: skills.length
          ? [{ skills: { some: { skill: { in: skills } } } }]
          : undefined,
      },
      include: {
        skills: true,
        _count: {
          select: {
            assignments: {
              where: { status: { in: ['OFFERED', 'ACCEPTED'] } },
            },
          },
        },
      },
      take: 50,
    });

    const scored = agents.map((a) => {
      const matched = a.skills.filter((s) => skills.includes(s.skill)).length;
      const skillScore = skills.length ? matched / skills.length : 1;
      const ratingScore = Number(a.rating) / 5;
      const loadPenalty = 1 / (1 + (a._count?.assignments ?? 0));
      const score =
        skillScore * 0.5 + ratingScore * 0.3 + loadPenalty * 0.2;
      return { agent: a, score, matchedSkills: matched };
    });

    scored.sort((x, y) => y.score - x.score);
    return {
      taskId: task.id,
      candidates: scored.slice(0, maxCandidates).map((s) => ({
        agentId: s.agent.id,
        userId: s.agent.userId,
        score: Number(s.score.toFixed(4)),
        rating: s.agent.rating,
        matchedSkills: s.matchedSkills,
        activeAssignments: s.agent._count?.assignments ?? 0,
      })),
    };
  }

  async queueStats() {
    const [pending, assigned, inProgress, onHold] = await Promise.all([
      this.prisma.task.count({ where: { status: 'PENDING' } }),
      this.prisma.task.count({ where: { status: 'ASSIGNED' } }),
      this.prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.task.count({ where: { status: 'ON_HOLD' } }),
    ]);
    const agentsOnline = await this.prisma.agent.count({
      where: { availability: { in: ['ONLINE', 'ON_SHIFT'] } },
    });
    return { pending, assigned, inProgress, onHold, agentsOnline };
  }

  async getAvailableAgents(taskId?: string) {
    let requiredSkills: string[] = [];
    if (taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { requiredSkills: true },
      });
      requiredSkills = task?.requiredSkills ?? [];
    }

    const agents = await this.prisma.agent.findMany({
      where: {
        availability: 'ONLINE',
        status: 'VERIFIED',
        ...(requiredSkills.length
          ? { skills: { some: { skill: { in: requiredSkills } } } }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        skills: true,
        _count: {
          select: {
            assignments: { where: { status: 'ACCEPTED' } },
          },
        },
      },
    });

    return agents.map((a) => ({
      ...a,
      activeTaskCount: a._count.assignments,
    }));
  }
}
