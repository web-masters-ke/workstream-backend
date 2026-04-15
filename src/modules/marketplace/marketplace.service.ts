import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarketplaceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminReviewListingDto,
  BrowseListingsDto,
  CreateListingDto,
  ListingSort,
  PlaceBidDto,
  ReviewBidDto,
  UpdateListingDto,
} from './dto';

const LISTING_INCLUDE = {
  business: { select: { id: true, name: true, logoUrl: true, contactEmail: true } },
  _count: { select: { bids: true } },
};

const BID_AGENT_INCLUDE = {
  agent: {
    include: {
      user: { select: { id: true, name: true, email: true } },
      skills: { select: { skill: true } },
    },
  },
};

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── helpers ───────────────────────────────────────────────────────────────

  private listingDto(t: any) {
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      requiredSkills: t.requiredSkills,
      budgetCents: t.budgetCents,
      currency: t.currency,
      dueAt: t.dueAt,
      marketplaceStatus: t.marketplaceStatus,
      marketplaceExpiresAt: t.marketplaceExpiresAt,
      maxBids: t.maxBids,
      locationText: t.locationText,
      attachments: t.attachments,
      businessId: t.businessId,
      businessName: t.business?.name ?? '—',
      businessLogo: t.business?.logoUrl ?? null,
      businessCity: null,
      bidCount: t._count?.bids ?? 0,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private bidDto(b: any) {
    return {
      id: b.id,
      taskId: b.taskId,
      agentId: b.agentId,
      agentName: b.agent?.user?.name ?? '—',
      agentEmail: b.agent?.user?.email ?? '—',
      agentRating: b.agent?.rating ?? 0,
      agentCompletedTasks: b.agent?.completedTasks ?? 0,
      agentSkills: b.agent?.skills?.map((s: any) => s.skill) ?? [],
      agentType: b.agent?.agentType ?? 'EMPLOYEE',
      proposedCents: b.proposedCents,
      coverNote: b.coverNote,
      estimatedDays: b.estimatedDays,
      status: b.status,
      rejectionNote: b.rejectionNote,
      acceptedAt: b.acceptedAt,
      createdAt: b.createdAt,
    };
  }

  // ─── public browse ─────────────────────────────────────────────────────────

  async browse(dto: BrowseListingsDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {
      isMarketplace: true,
      marketplaceStatus: 'APPROVED',
    };

    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
        { category: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    if (dto.category) where.category = { equals: dto.category, mode: 'insensitive' };
    if (dto.skill) where.requiredSkills = { has: dto.skill };
    if (dto.location) where.locationText = { contains: dto.location, mode: 'insensitive' };
    if (dto.budgetMinCents) where.budgetCents = { ...where.budgetCents, gte: dto.budgetMinCents };
    if (dto.budgetMaxCents) where.budgetCents = { ...where.budgetCents, lte: dto.budgetMaxCents };

    let orderBy: any = { createdAt: 'desc' };
    if (dto.sort === ListingSort.BUDGET_HIGH) orderBy = { budgetCents: 'desc' };
    if (dto.sort === ListingSort.BUDGET_LOW) orderBy = { budgetCents: 'asc' };
    if (dto.sort === ListingSort.DEADLINE_SOON) orderBy = { dueAt: 'asc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: LISTING_INCLUDE,
      }),
      this.prisma.task.count({ where }),
    ]);

    const categories = await this.prisma.task.findMany({
      where: { isMarketplace: true, marketplaceStatus: 'APPROVED', category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return {
      items: items.map((t) => this.listingDto(t)),
      total,
      page,
      limit,
      categories: categories.map((c) => c.category).filter(Boolean),
    };
  }

  async findOne(id: string, viewerAgentId?: string) {
    const t = await this.prisma.task.findUnique({
      where: { id },
      include: {
        ...LISTING_INCLUDE,
        bids: {
          where: viewerAgentId ? { agentId: viewerAgentId } : undefined,
          include: BID_AGENT_INCLUDE,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!t || !t.isMarketplace) throw new NotFoundException('Listing not found');
    return {
      ...this.listingDto(t),
      myBid: viewerAgentId && t.bids.length > 0 ? this.bidDto(t.bids[0]) : null,
    };
  }

  // ─── org owner — manage listings ───────────────────────────────────────────

  async createListing(userId: string, dto: CreateListingDto) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId, role: { in: ['OWNER', 'MANAGER'] } },
      select: { businessId: true },
    });
    if (!member) throw new ForbiddenException('Only business owners or managers can post listings');

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          businessId: member.businessId,
          createdById: userId,
          title: dto.title,
          description: dto.description,
          category: dto.category,
          requiredSkills: dto.requiredSkills ?? [],
          budgetCents: dto.budgetCents,
          currency: dto.currency ?? 'KES',
          dueAt: new Date(dto.dueAt),
          isMarketplace: true,
          marketplaceStatus: 'APPROVED',
          marketplaceExpiresAt: dto.marketplaceExpiresAt
            ? new Date(dto.marketplaceExpiresAt)
            : null,
          maxBids: dto.maxBids ?? 20,
          locationText: dto.locationText,
          attachments: dto.attachments ?? [],
        },
        include: LISTING_INCLUDE,
      });
      await tx.taskHistory.create({
        data: {
          taskId: task.id,
          actorId: userId,
          toStatus: task.status,
          note: 'Task posted to marketplace — live',
        },
      });
      return this.listingDto(task);
    });
  }

  async updateListing(id: string, userId: string, dto: UpdateListingDto) {
    const task = await this.assertOwnsListing(id, userId);
    if (task.marketplaceStatus === 'ACTIVE' || task.marketplaceStatus === 'CLOSED') {
      throw new BadRequestException('Cannot edit an active or closed listing');
    }
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.requiredSkills && { requiredSkills: dto.requiredSkills }),
        ...(dto.budgetCents && { budgetCents: dto.budgetCents }),
        ...(dto.dueAt && { dueAt: new Date(dto.dueAt) }),
        ...(dto.marketplaceExpiresAt && { marketplaceExpiresAt: new Date(dto.marketplaceExpiresAt) }),
        ...(dto.maxBids && { maxBids: dto.maxBids }),
        ...(dto.locationText !== undefined && { locationText: dto.locationText }),
        ...(dto.attachments && { attachments: dto.attachments }),
        marketplaceStatus: 'PENDING_REVIEW', // re-review after edit
      },
      include: LISTING_INCLUDE,
    });
    return this.listingDto(updated);
  }

  async closeListing(id: string, userId: string) {
    await this.assertOwnsListing(id, userId);
    const updated = await this.prisma.task.update({
      where: { id },
      data: { marketplaceStatus: 'CLOSED' },
      include: LISTING_INCLUDE,
    });
    return this.listingDto(updated);
  }

  async myListings(userId: string, page = 1, limit = 20) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId },
      select: { businessId: true },
    });
    if (!member) return { items: [], total: 0, page, limit };

    const skip = (page - 1) * limit;
    const where = { isMarketplace: true, businessId: member.businessId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { ...LISTING_INCLUDE, bids: { select: { id: true, status: true } } },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        ...this.listingDto(t),
        bids: {
          total: t.bids.length,
          pending: t.bids.filter((b: any) => b.status === 'PENDING').length,
          accepted: t.bids.filter((b: any) => b.status === 'ACCEPTED').length,
        },
      })),
      total,
      page,
      limit,
    };
  }

  async getListingBids(taskId: string, userId: string) {
    await this.assertOwnsListing(taskId, userId);
    const bids = await this.prisma.bid.findMany({
      where: { taskId },
      include: BID_AGENT_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    return bids.map((b) => this.bidDto(b));
  }

  // ─── agent — bidding ───────────────────────────────────────────────────────

  async placeBid(taskId: string, userId: string, dto: PlaceBidDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { _count: { select: { bids: true } } },
    });
    if (!task || !task.isMarketplace) throw new NotFoundException('Listing not found');
    if (task.marketplaceStatus !== 'APPROVED') {
      throw new BadRequestException('This listing is not open for bids');
    }
    if (task.maxBids && task._count.bids >= task.maxBids) {
      throw new BadRequestException('This listing has reached its maximum number of bids');
    }
    if (task.marketplaceExpiresAt && new Date() > task.marketplaceExpiresAt) {
      throw new BadRequestException('This listing has expired');
    }

    const agent = await this.prisma.agent.findUnique({
      where: { userId },
      select: { id: true, businessId: true },
    });
    if (!agent) throw new ForbiddenException('Only agents can place bids');

    // Prevent org's own employees from bidding on their own tasks
    if (agent.businessId === task.businessId) {
      throw new BadRequestException('You cannot bid on your own organisation\'s tasks');
    }

    const existing = await this.prisma.bid.findUnique({
      where: { taskId_agentId: { taskId, agentId: agent.id } },
    });
    if (existing) {
      if (existing.status === 'WITHDRAWN') {
        // Allow re-bid after withdrawal
        return this.prisma.bid.update({
          where: { id: existing.id },
          data: {
            proposedCents: dto.proposedCents,
            coverNote: dto.coverNote,
            estimatedDays: dto.estimatedDays,
            status: 'PENDING',
            withdrawnAt: null,
          },
          include: BID_AGENT_INCLUDE,
        }).then((b) => this.bidDto(b));
      }
      throw new BadRequestException('You have already placed a bid on this listing');
    }

    const bid = await this.prisma.bid.create({
      data: {
        taskId,
        agentId: agent.id,
        proposedCents: dto.proposedCents,
        coverNote: dto.coverNote,
        estimatedDays: dto.estimatedDays,
      },
      include: BID_AGENT_INCLUDE,
    });
    return this.bidDto(bid);
  }

  async withdrawBid(bidId: string, userId: string) {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: { agent: true },
    });
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.agent.userId !== userId) throw new ForbiddenException('Not your bid');
    if (bid.status !== 'PENDING') {
      throw new BadRequestException('Only pending bids can be withdrawn');
    }
    return this.prisma.bid.update({
      where: { id: bidId },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    }).then((b) => this.bidDto({ ...b, agent: bid.agent }));
  }

  async myBids(userId: string, page = 1, limit = 20) {
    const agent = await this.prisma.agent.findUnique({ where: { userId }, select: { id: true } });
    if (!agent) return { items: [], total: 0, page, limit };

    const skip = (page - 1) * limit;
    const where = { agentId: agent.id };

    const [bids, total] = await this.prisma.$transaction([
      this.prisma.bid.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ...BID_AGENT_INCLUDE,
          task: {
            include: {
              business: { select: { id: true, name: true, logoUrl: true } },
              _count: { select: { bids: true } },
            },
          },
        },
      }),
      this.prisma.bid.count({ where }),
    ]);

    return {
      items: bids.map((b) => ({
        ...this.bidDto(b),
        listing: this.listingDto(b.task),
      })),
      total,
      page,
      limit,
    };
  }

  // ─── org owner — accept / reject bids ─────────────────────────────────────

  async acceptBid(bidId: string, userId: string) {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        task: { include: { business: { include: { members: { where: { role: 'OWNER' }, select: { userId: true } } } } } },
        agent: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.status !== 'PENDING') throw new BadRequestException('Only pending bids can be accepted');

    // Verify caller is owner/manager of the business
    await this.assertOwnsListing(bid.taskId, userId);

    return this.prisma.$transaction(async (tx) => {
      // Accept this bid
      const accepted = await tx.bid.update({
        where: { id: bidId },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      // Reject all other pending bids on this task
      await tx.bid.updateMany({
        where: { taskId: bid.taskId, id: { not: bidId }, status: 'PENDING' },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectionNote: 'Another bid was accepted' },
      });

      // Create task assignment for the winning agent
      await tx.taskAssignment.upsert({
        where: { taskId_agentId: { taskId: bid.taskId, agentId: bid.agentId } },
        create: { taskId: bid.taskId, agentId: bid.agentId, status: 'ACCEPTED', acceptedAt: new Date() },
        update: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      // Move task to ASSIGNED status and update marketplace status
      await tx.task.update({
        where: { id: bid.taskId },
        data: { status: 'ASSIGNED', marketplaceStatus: 'ACTIVE' },
      });

      // Notify the winning agent
      await tx.notification.create({
        data: {
          userId: bid.agent.user.id,
          title: 'Bid Accepted!',
          body: `Your bid on "${bid.task.title}" was accepted. Get started!`,
          channel: 'IN_APP',
          status: 'SENT',
          sentAt: new Date(),
          link: `/marketplace/${bid.taskId}`,
        },
      });

      return this.bidDto({ ...accepted, agent: bid.agent });
    });
  }

  async rejectBid(bidId: string, userId: string, dto: ReviewBidDto) {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: { agent: { include: { user: { select: { id: true } } } } },
    });
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.status !== 'PENDING') throw new BadRequestException('Only pending bids can be rejected');

    await this.assertOwnsListing(bid.taskId, userId);

    const updated = await this.prisma.bid.update({
      where: { id: bidId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionNote: dto.rejectionNote },
    });

    await this.prisma.notification.create({
      data: {
        userId: bid.agent.user.id,
        title: 'Bid Update',
        body: `Your bid was not selected this time. Keep bidding!`,
        channel: 'IN_APP',
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return this.bidDto({ ...updated, agent: bid.agent });
  }

  // ─── admin ─────────────────────────────────────────────────────────────────

  async adminListListings(page = 1, limit = 30, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = { isMarketplace: true };
    if (status) where.marketplaceStatus = status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ...LISTING_INCLUDE,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    const stats = await this.prisma.task.groupBy({
      by: ['marketplaceStatus'],
      where: { isMarketplace: true },
      _count: true,
    });

    return {
      items: items.map((t) => ({
        ...this.listingDto(t),
        postedBy: (t as any).createdBy,
      })),
      total,
      page,
      limit,
      stats: stats.reduce((acc: any, s) => { acc[s.marketplaceStatus ?? 'null'] = s._count; return acc; }, {}),
    };
  }

  async adminApproveListing(id: string, adminId: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || !task.isMarketplace) throw new NotFoundException('Listing not found');
    const updated = await this.prisma.task.update({
      where: { id },
      data: { marketplaceStatus: 'APPROVED', adminRejectNote: null },
      include: LISTING_INCLUDE,
    });
    await this.prisma.notification.create({
      data: {
        userId: task.createdById,
        title: 'Listing Approved',
        body: `Your listing "${task.title}" is now live on the marketplace.`,
        channel: 'IN_APP',
        status: 'SENT',
        sentAt: new Date(),
        link: `/marketplace/${id}`,
      },
    });
    return this.listingDto(updated);
  }

  async adminRejectListing(id: string, adminId: string, dto: AdminReviewListingDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || !task.isMarketplace) throw new NotFoundException('Listing not found');
    const updated = await this.prisma.task.update({
      where: { id },
      data: { marketplaceStatus: 'REJECTED', adminRejectNote: dto.note },
      include: LISTING_INCLUDE,
    });
    await this.prisma.notification.create({
      data: {
        userId: task.createdById,
        title: 'Listing Rejected',
        body: `Your listing "${task.title}" was not approved. ${dto.note ? `Reason: ${dto.note}` : ''}`,
        channel: 'IN_APP',
        status: 'SENT',
        sentAt: new Date(),
      },
    });
    return this.listingDto(updated);
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private async assertOwnsListing(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { businessId: true, isMarketplace: true, marketplaceStatus: true },
    });
    if (!task || !task.isMarketplace) throw new NotFoundException('Listing not found');

    const member = await this.prisma.businessMember.findFirst({
      where: { userId, businessId: task.businessId, role: { in: ['OWNER', 'MANAGER'] } },
    });
    if (!member) throw new ForbiddenException('You do not own this listing');
    return task;
  }
}
