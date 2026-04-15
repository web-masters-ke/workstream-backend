import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  AddTicketMessageDto,
  AdminCreateBusinessDto,
  AdminCreateUserDto,
  FileDisputeDto,
  ListAuditLogsDto,
  ListDisputesDto,
  ResolveDisputeDto,
  ReviewKycDto,
  UpsertFeatureFlagDto,
  UpsertSettingDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  // Users
  @Get('users')
  @Roles('ADMIN')
  listUsers(@Query() query: any) {
    return this.service.listUsers(query);
  }

  @Post('users')
  @Roles('ADMIN')
  createUser(@Body() dto: AdminCreateUserDto) {
    return this.service.createUser(dto);
  }

  @Get('businesses')
  @Roles('ADMIN')
  async listBusinesses(
    @Query('search') search?: string,
    @Query('limit') limit = '200',
  ) {
    const take = Math.min(Number(limit) || 200, 500);
    const businesses = await this.prisma.business.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { contactEmail: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      take,
      select: { id: true, name: true, contactEmail: true, status: true, industry: true },
    });
    return businesses;
  }

  @Post('businesses')
  @Roles('ADMIN')
  createBusiness(@Body() dto: AdminCreateBusinessDto) {
    return this.service.createBusiness(dto);
  }

  @Get('users/:id')
  @Roles('ADMIN')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getUser(id);
  }

  @Delete('users/:id')
  @Roles('ADMIN')
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteUser(id);
  }

  @Patch('users/:id/status')
  @Roles('ADMIN')
  updateUserStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: string) {
    return this.service.updateUserStatus(id, status);
  }

  // Reset business owner password
  @Post('businesses/:id/reset-password')
  @Roles('ADMIN')
  async resetBusinessPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('password') password: string,
  ) {
    return this.service.resetBusinessOwnerPassword(id, password);
  }

  // Agent ratings distribution
  @Get('agents/:id/ratings')
  @Roles('ADMIN', 'SUPERVISOR')
  async getAgentRatings(@Param('id', ParseUUIDPipe) id: string): Promise<Record<number, number>> {
    const reviews = await this.prisma.qAReview.findMany({
      where: { agentId: id },
      select: { score: true },
    });
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      if (r.score >= 1 && r.score <= 5) dist[r.score] = (dist[r.score] ?? 0) + 1;
    }
    return dist;
  }

  // KYC review
  @Patch('agents/:id/kyc')
  @Roles('ADMIN')
  reviewKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReviewKycDto,
  ) {
    return this.service.reviewKyc(id, user.sub, dto);
  }

  // Disputes / Tickets — all authenticated users can file
  @Post('disputes')
  fileDispute(
    @CurrentUser() user: JwtUser,
    @Body() dto: FileDisputeDto,
  ) {
    return this.service.fileDispute(user.sub, dto);
  }

  @Get('disputes')
  @Roles('ADMIN', 'SUPERVISOR')
  listDisputes(@Query() dto: ListDisputesDto) {
    return this.service.listDisputes(dto);
  }

  @Get('disputes/:id')
  @Roles('ADMIN', 'SUPERVISOR')
  getDispute(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getDispute(id);
  }

  @Patch('disputes/:id')
  @Roles('ADMIN', 'SUPERVISOR')
  resolveDispute(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.service.resolveDispute(id, dto, user.sub);
  }

  @Post('disputes/:id/messages')
  addTicketMessage(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTicketMessageDto,
  ) {
    return this.service.addTicketMessage(id, user.sub, dto);
  }

  @Get('disputes/:id/messages')
  @Roles('ADMIN', 'SUPERVISOR')
  listTicketMessages(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listTicketMessages(id);
  }

  // Audit logs
  @Get('audit-logs')
  @Roles('ADMIN')
  listAuditLogs(@Query() dto: ListAuditLogsDto) {
    return this.service.listAuditLogs(dto);
  }

  // Settings
  @Get('settings')
  @Roles('ADMIN')
  listSettings() {
    return this.service.listSettings();
  }

  @Put('settings')
  @Roles('ADMIN')
  upsertSetting(@Body() dto: UpsertSettingDto) {
    return this.service.upsertSetting(dto);
  }

  // Feature flags
  @Get('feature-flags')
  @Roles('ADMIN')
  listFlags() {
    return this.service.listFlags();
  }

  @Put('feature-flags')
  @Roles('ADMIN')
  upsertFlag(@Body() dto: UpsertFeatureFlagDto) {
    return this.service.upsertFlag(dto);
  }

  @Post('feature-flags')
  @Roles('ADMIN')
  createFlag(@Body() dto: UpsertFeatureFlagDto) {
    return this.service.upsertFlag(dto);
  }

  @Patch('feature-flags')
  @Roles('ADMIN')
  patchFlag(@Body() dto: UpsertFeatureFlagDto) {
    return this.service.upsertFlag(dto);
  }

  @Delete('feature-flags/:key')
  @Roles('ADMIN')
  deleteFlag(@Param('key') key: string) {
    return this.service.deleteFlag(key);
  }

  // ── Subscription plans ─────────────────────────────────────────────────────

  @Get('subscription-plans')
  @Roles('ADMIN')
  async listSubscriptionPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { priceCents: 'asc' },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      price: p.priceCents / 100,
      priceCents: p.priceCents,
      currency: p.currency,
      features: Array.isArray(p.features) ? p.features : [],
      isActive: p.isActive,
      createdAt: p.createdAt,
    }));
  }

  @Post('subscription-plans')
  @Roles('ADMIN')
  async createSubscriptionPlan(
    @Body() body: { name: string; description?: string; priceCents: number; currency?: string; features?: string[] },
  ) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        priceCents: body.priceCents,
        currency: body.currency ?? 'KES',
        features: body.features ?? [],
        isActive: true,
      },
    });
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description ?? '',
      price: plan.priceCents / 100,
      priceCents: plan.priceCents,
      currency: plan.currency,
      features: Array.isArray(plan.features) ? plan.features : [],
      isActive: plan.isActive,
      createdAt: plan.createdAt,
    };
  }

  @Patch('subscription-plans/:id')
  @Roles('ADMIN')
  async updateSubscriptionPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name?: string; description?: string; priceCents?: number; currency?: string; features?: string[]; isActive?: boolean },
  ) {
    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.priceCents !== undefined && { priceCents: body.priceCents }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.features !== undefined && { features: body.features }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description ?? '',
      price: plan.priceCents / 100,
      priceCents: plan.priceCents,
      currency: plan.currency,
      features: Array.isArray(plan.features) ? plan.features : [],
      isActive: plan.isActive,
      createdAt: plan.createdAt,
    };
  }

  // ── Admin notifications ────────────────────────────────────────────────────

  @Get('notifications')
  @Roles('ADMIN')
  async listAllNotifications(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const items = await this.prisma.notification.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(channel ? { channel: channel as any } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    return items.map((n) => ({
      id: n.id,
      userId: n.userId,
      userName: (n as any).user?.name ?? null,
      userEmail: (n as any).user?.email ?? null,
      title: n.title,
      body: n.body,
      channel: n.channel,
      status: n.status,
      read: n.readAt !== null,
      readAt: n.readAt,
      createdAt: n.createdAt,
    }));
  }

  // ── Admin wallet management ──────────────────────────────────────────────

  /** List all business wallets with balance and business details */
  @Get('wallets')
  @Roles('ADMIN')
  async listWallets() {
    const wallets = await this.prisma.wallet.findMany({
      where: { businessId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      include: {
        business: { select: { id: true, name: true, contactEmail: true, status: true } },
      },
    });

    return wallets.map((w) => ({
      id: w.id,
      businessId: w.businessId,
      businessName: w.business?.name ?? '—',
      businessEmail: w.business?.contactEmail ?? '—',
      businessStatus: w.business?.status ?? '—',
      currency: w.currency,
      balance: Number(w.balanceCents) / 100,
      status: w.status,
      updatedAt: w.updatedAt,
      createdAt: w.createdAt,
    }));
  }

  /** Get a single business wallet + recent transactions */
  @Get('wallets/:businessId')
  @Roles('ADMIN')
  async getBusinessWallet(@Param('businessId', ParseUUIDPipe) businessId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { businessId },
      include: {
        business: { select: { id: true, name: true, contactEmail: true, status: true } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!wallet) throw new NotFoundException('Wallet not found for this business');

    return {
      id: wallet.id,
      businessId: wallet.businessId,
      businessName: wallet.business?.name ?? '—',
      businessEmail: wallet.business?.contactEmail ?? '—',
      currency: wallet.currency,
      balance: Number(wallet.balanceCents) / 100,
      status: wallet.status,
      updatedAt: wallet.updatedAt,
      transactions: wallet.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        amount: Number(t.amountCents) / 100,
        currency: t.currency,
        description: t.description ?? '',
        reference: t.reference ?? null,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
    };
  }

  /** List all agent wallets */
  @Get('agent-wallets')
  @Roles('ADMIN')
  async listAgentWallets() {
    const wallets = await this.prisma.wallet.findMany({
      where: { ownerType: 'AGENT' },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Enrich with agent profile info via ownerId
    const agentIds = wallets.map((w) => w.ownerId);
    const agents = await this.prisma.agent.findMany({
      where: { id: { in: agentIds } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    return wallets.map((w) => {
      const agent = agentMap.get(w.ownerId);
      return {
        id: w.id,
        agentId: w.ownerId,
        agentName: agent?.user?.name ?? w.user?.name ?? '—',
        agentEmail: agent?.user?.email ?? w.user?.email ?? '—',
        currency: w.currency,
        balance: Number(w.balanceCents) / 100,
        status: w.status,
        updatedAt: w.updatedAt,
        createdAt: w.createdAt,
      };
    });
  }

  /** Admin fund an agent wallet directly */
  @Post('agent-wallets/:agentId/fund')
  @Roles('ADMIN')
  async fundAgentWallet(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentUser() admin: JwtUser,
    @Body() body: { amountCents: number; note?: string },
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: 'AGENT', ownerId: agentId } },
    });
    if (!wallet) throw new NotFoundException('Wallet not found for this agent');

    const amountCents = BigInt(Math.round(body.amountCents));
    const reference = `ADMIN-AGENT-CREDIT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const newBalance = wallet.balanceCents + amountCents;

    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balanceCents: newBalance },
    });

    const tx = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        status: 'COMPLETED',
        amountCents,
        currency: wallet.currency,
        balanceAfterCents: newBalance,
        reference,
        description: body.note ? `Admin credit: ${body.note}` : 'Admin wallet credit',
        completedAt: new Date(),
        metadata: { adminId: admin.sub, adminFund: true } as any,
      },
    });

    return {
      walletId: wallet.id,
      agentId,
      reference,
      amount: Number(amountCents) / 100,
      newBalance: Number(newBalance) / 100,
      currency: wallet.currency,
      transactionId: tx.id,
    };
  }

  /** Paginated transaction history for a business wallet */
  @Get('wallets/:businessId/transactions')
  @Roles('ADMIN')
  async getWalletTransactions(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const wallet = await this.prisma.wallet.findUnique({ where: { businessId }, select: { id: true } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);
    return {
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        amount: Number(t.amountCents) / 100,
        currency: t.currency,
        description: t.description ?? '',
        reference: t.reference ?? null,
        balanceAfter: t.balanceAfterCents != null ? Number(t.balanceAfterCents) / 100 : null,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
      total,
      page: Math.max(Number(page) || 1, 1),
      limit: take,
    };
  }

  /** Admin credit/fund a business wallet */
  @Post('wallets/:businessId/fund')
  @Roles('ADMIN')
  async fundBusinessWallet(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() admin: JwtUser,
    @Body() body: { amountCents: number; note?: string; type?: 'CREDIT' | 'ADJUSTMENT' | 'TOPUP' },
  ) {
    const wallet = await this.prisma.wallet.findUnique({ where: { businessId } });
    if (!wallet) throw new NotFoundException('Wallet not found for this business');

    const rawCents = Math.round(Number(body.amountCents));
    if (!Number.isFinite(rawCents) || rawCents === 0) {
      throw new BadRequestException('amountCents must be a non-zero number');
    }
    const txType = body.type ?? (rawCents < 0 ? 'DEBIT' : 'CREDIT');
    // Store absolute value in transaction record; sign applied to balance
    const absCents = BigInt(Math.abs(rawCents));
    const signedCents = BigInt(rawCents);
    const reference = `ADMIN-${txType}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const newBalance = wallet.balanceCents + signedCents;

    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balanceCents: newBalance },
    });

    const tx = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: txType,
        status: 'COMPLETED',
        amountCents: absCents,
        currency: wallet.currency,
        balanceAfterCents: newBalance,
        reference,
        description: body.note ? `Admin ${txType.toLowerCase()}: ${body.note}` : `Admin wallet ${txType.toLowerCase()}`,
        completedAt: new Date(),
        metadata: { adminId: admin.sub, adminFund: true } as any,
      },
    });

    return {
      walletId: wallet.id,
      businessId,
      reference,
      amount: Math.abs(rawCents) / 100,
      newBalance: Number(newBalance) / 100,
      currency: wallet.currency,
      transactionId: tx.id,
    };
  }
}
