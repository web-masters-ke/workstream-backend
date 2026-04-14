import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import { CreateQAReviewDto, ListQAReviewsDto } from './dto';

@Injectable()
export class QAService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reviewerId: string, dto: CreateQAReviewDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: dto.taskId },
    });
    if (!task) throw new NotFoundException('Task not found');
    const agent = await this.prisma.agent.findUnique({
      where: { id: dto.agentId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.qAReview.create({
        data: {
          taskId: dto.taskId,
          agentId: dto.agentId,
          reviewerId,
          score: dto.score,
          comment: dto.comment,
          criteria: dto.criteria as any,
        },
      });

      // Update agent rolling rating (simple average)
      const agg = await tx.qAReview.aggregate({
        where: { agentId: dto.agentId },
        _avg: { score: true },
      });
      const avg = Number(agg._avg.score ?? 0);
      await tx.agent.update({
        where: { id: dto.agentId },
        data: { rating: avg.toFixed(2) },
      });
      return review;
    });
  }

  async list(dto: ListQAReviewsDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.agentId) where.agentId = dto.agentId;
    if (dto.taskId) where.taskId = dto.taskId;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.qAReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.qAReview.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const r = await this.prisma.qAReview.findUnique({
      where: { id },
      include: {
        reviewer: { select: { id: true, email: true, name: true } },
        task: true,
      },
    });
    if (!r) throw new NotFoundException('Review not found');
    return r;
  }

  async agentSummary(agentId: string) {
    const agg = await this.prisma.qAReview.aggregate({
      where: { agentId },
      _avg: { score: true },
      _count: { _all: true },
    });
    return {
      agentId,
      avgScore: Number(agg._avg.score ?? 0),
      totalReviews: agg._count._all,
    };
  }
}
