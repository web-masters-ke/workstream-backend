import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type Period = '7d' | '30d' | '90d' | 'all';

function periodToDate(period: Period): Date | undefined {
  if (period === 'all') return undefined;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async platformOverview(period: Period = 'all') {
    const since = periodToDate(period);
    const dateFilter = since ? { createdAt: { gte: since } } : {};

    const [users, agents, businesses, tasks, completedTasks] =
      await Promise.all([
        this.prisma.user.count({ where: dateFilter }),
        this.prisma.agent.count({ where: dateFilter }),
        this.prisma.business.count({ where: dateFilter }),
        this.prisma.task.count({ where: dateFilter }),
        this.prisma.task.count({ where: { status: 'COMPLETED', ...dateFilter } }),
      ]);

    const openTasks = await this.prisma.task.count({
      where: {
        status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] },
        ...dateFilter,
      },
    });

    return {
      period,
      users,
      agents,
      businesses,
      tasks: {
        total: tasks,
        completed: completedTasks,
        open: openTasks,
        completionRate: tasks ? completedTasks / tasks : 0,
      },
    };
  }

  async getBusinessDashboard(businessId: string, period: Period = 'all') {
    const since = periodToDate(period);
    const dateFilter = since ? { createdAt: { gte: since } } : {};

    const [tasks, completed, inProgress, pending, failed, agentsUsed] =
      await Promise.all([
        this.prisma.task.count({ where: { businessId, ...dateFilter } }),
        this.prisma.task.count({ where: { businessId, status: 'COMPLETED', ...dateFilter } }),
        this.prisma.task.count({ where: { businessId, status: 'IN_PROGRESS', ...dateFilter } }),
        this.prisma.task.count({ where: { businessId, status: 'PENDING', ...dateFilter } }),
        this.prisma.task.count({ where: { businessId, status: 'FAILED', ...dateFilter } }),
        this.prisma.taskAssignment.groupBy({
          by: ['agentId'],
          where: { task: { businessId, ...dateFilter } },
        }),
      ]);

    // Total spend from settled wallet transactions linked to business
    const wallet = await this.prisma.wallet.findFirst({ where: { businessId } });
    let totalSpendCents = 0;
    if (wallet) {
      const agg = await this.prisma.walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          status: 'COMPLETED',
          type: { in: ['DEBIT', 'TASK_PAYMENT'] },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        _sum: { amountCents: true },
      });
      totalSpendCents = Number(agg._sum.amountCents ?? 0n);
    }

    // Top agents for this business
    const topAgentRows = await this.prisma.taskAssignment.groupBy({
      by: ['agentId'],
      where: { task: { businessId, status: 'COMPLETED', ...dateFilter } },
      _count: { agentId: true },
      orderBy: { _count: { agentId: 'desc' } },
      take: 5,
    });
    const topAgentIds = topAgentRows.map((r) => r.agentId);
    const topAgents = await this.prisma.agent.findMany({
      where: { id: { in: topAgentIds } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const completionRate = tasks ? completed / tasks : 0;

    return {
      period,
      tasks: { total: tasks, completed, inProgress, pending, failed },
      agentCount: agentsUsed.length,
      totalSpendCents,
      completionRate: Number(completionRate.toFixed(4)),
      topAgents,
    };
  }

  async getAgentDashboard(agentId: string, period: Period = 'all') {
    const since = periodToDate(period);
    const dateFilter = since ? { createdAt: { gte: since } } : {};

    const [agent, completedTasks, reviews, wallet] = await Promise.all([
      this.prisma.agent.findUnique({
        where: { id: agentId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.taskAssignment.count({
        where: { agentId, status: 'COMPLETED', ...dateFilter },
      }),
      this.prisma.qAReview.findMany({
        where: { agentId, ...dateFilter },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.wallet.findFirst({
        where: { ownerType: 'AGENT', ownerId: agentId },
      }),
    ]);

    // Earnings this period
    let earningsCents = 0;
    if (wallet) {
      const agg = await this.prisma.walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          type: { in: ['CREDIT', 'TASK_PAYMENT'] },
          status: 'COMPLETED',
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        _sum: { amountCents: true },
      });
      earningsCents = Number(agg._sum.amountCents ?? 0n);
    }

    const avgScore =
      reviews.length > 0
        ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length
        : 0;

    // Simple ranking among all agents by rating
    const higherRated = await this.prisma.agent.count({
      where: { rating: { gt: agent?.rating ?? 0 } },
    });
    const rank = higherRated + 1;

    return {
      period,
      agent,
      completedTasks,
      earningsCents,
      avgQaScore: Number(avgScore.toFixed(2)),
      currentRating: agent?.rating ?? 0,
      rank,
    };
  }

  async businessOverview(businessId: string) {
    return this.getBusinessDashboard(businessId, 'all');
  }

  async agentOverview(agentId: string) {
    return this.getAgentDashboard(agentId, 'all');
  }

  async tasksByStatusSeries(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.task.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status, count: g._count._all }));
  }

  async topAgents(limit = 10) {
    return this.prisma.agent.findMany({
      orderBy: [{ rating: 'desc' }, { completedTasks: 'desc' }],
      take: limit,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }
}
