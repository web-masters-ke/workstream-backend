import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly prisma: PrismaService) {}

  private async findUserWallet(userId: string) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId },
      select: { businessId: true },
    });
    if (member) {
      const w = await this.prisma.wallet.findUnique({ where: { businessId: member.businessId } });
      if (w) return w;
    }
    const agent = await this.prisma.agent.findUnique({ where: { userId }, select: { id: true } });
    if (agent) {
      const w = await this.prisma.wallet.findFirst({ where: { ownerId: agent.id, ownerType: 'AGENT' } });
      if (w) return w;
    }
    return null;
  }

  private walletDto(wallet: any) {
    return {
      id: wallet.id,
      currency: wallet.currency,
      balance: Number(wallet.balanceCents) / 100,
      reservedBalance: 0,
      autoRechargeEnabled: false,
      autoRechargeThreshold: 0,
      autoRechargeAmount: 0,
      updatedAt: wallet.updatedAt,
    };
  }

  @Get()
  async getWallet(@CurrentUser() user: JwtUser) {
    const wallet = await this.findUserWallet(user.sub);
    if (!wallet) {
      return { id: null, balance: 0, reservedBalance: 0, currency: 'KES', autoRechargeEnabled: false, autoRechargeThreshold: 0, autoRechargeAmount: 0 };
    }

    return this.walletDto(wallet);
  }

  @Get('transactions')
  async getTransactions(@CurrentUser() user: JwtUser) {
    const wallet = await this.findUserWallet(user.sub);
    if (!wallet) return [];

    const rows = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return rows.map((r) => ({
      id: r.id,
      walletId: r.walletId,
      type: r.type,
      status: r.status,
      amount: Number(r.amountCents) / 100,
      currency: r.currency,
      description: r.description ?? '',
      reference: r.reference ?? null,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    }));
  }

  @Post('topup')
  async initiateTopup(
    @CurrentUser() user: JwtUser,
    @Body() body: { amountCents: number; method: 'MPESA' | 'CARD'; phone?: string },
  ) {
    const wallet = await this.findUserWallet(user.sub);
    if (!wallet) throw new NotFoundException('No wallet found for this user');

    const amountCents = BigInt(Math.round(body.amountCents));
    const reference = `TOPUP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    if (body.method === 'CARD') {
      // Card top-up: immediately complete
      const newBalance = wallet.balanceCents + amountCents;
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: newBalance },
      });
      const tx = await this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'TOPUP',
          status: 'COMPLETED',
          amountCents,
          currency: wallet.currency,
          balanceAfterCents: newBalance,
          reference,
          description: 'Wallet top-up via card',
          completedAt: new Date(),
        },
      });
      return {
        reference,
        status: 'COMPLETED',
        amount: Number(amountCents) / 100,
        balance: Number(newBalance) / 100,
        currency: wallet.currency,
        transactionId: tx.id,
      };
    }

    // M-Pesa: create pending transaction, simulate STK push
    const tx = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'TOPUP',
        status: 'PENDING',
        amountCents,
        currency: wallet.currency,
        reference,
        description: `Wallet top-up via M-Pesa${body.phone ? ` (${body.phone})` : ''}`,
        metadata: { method: 'MPESA', phone: body.phone ?? null } as any,
      },
    });

    return {
      reference,
      status: 'PENDING',
      amount: Number(amountCents) / 100,
      currency: wallet.currency,
      transactionId: tx.id,
      message: 'STK push sent to your phone. Enter your M-Pesa PIN to complete.',
    };
  }

  @Get('topup/:reference/status')
  async checkTopupStatus(
    @CurrentUser() user: JwtUser,
    @Param('reference') reference: string,
  ) {
    const tx = await this.prisma.walletTransaction.findUnique({ where: { reference } });
    if (!tx) throw new NotFoundException('Transaction not found');

    if (tx.status === 'COMPLETED') {
      const wallet = await this.prisma.wallet.findUnique({ where: { id: tx.walletId } });
      return {
        status: 'COMPLETED',
        balance: wallet ? Number(wallet.balanceCents) / 100 : null,
        amount: Number(tx.amountCents) / 100,
        currency: tx.currency,
      };
    }

    if (tx.status === 'PENDING') {
      const ageSec = (Date.now() - new Date(tx.createdAt).getTime()) / 1000;
      // Simulate M-Pesa callback after 5 seconds
      if (ageSec >= 5) {
        const wallet = await this.prisma.wallet.findUnique({ where: { id: tx.walletId } });
        if (!wallet) throw new NotFoundException('Wallet not found');

        const newBalance = wallet.balanceCents + tx.amountCents;
        await this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balanceCents: newBalance },
        });
        await this.prisma.walletTransaction.update({
          where: { reference },
          data: { status: 'COMPLETED', balanceAfterCents: newBalance, completedAt: new Date() },
        });
        return {
          status: 'COMPLETED',
          balance: Number(newBalance) / 100,
          amount: Number(tx.amountCents) / 100,
          currency: tx.currency,
        };
      }
    }

    return {
      status: tx.status,
      amount: Number(tx.amountCents) / 100,
      currency: tx.currency,
    };
  }

  @Post('payout')
  async requestPayout(
    @CurrentUser() user: JwtUser,
    @Body() body: { amountCents: number; phone?: string },
  ) {
    const amountCents = BigInt(Math.round(Number(body.amountCents)));
    if (amountCents <= 0n) throw new BadRequestException('Amount must be positive');

    // Resolve wallet — agent wallet takes priority, fall back to business wallet
    let wallet: any = null;
    let agentId: string | null = null;

    const agent = await this.prisma.agent.findUnique({
      where: { userId: user.sub },
      select: { id: true },
    });
    if (agent) {
      wallet = await this.prisma.wallet.findFirst({
        where: { ownerType: 'AGENT', ownerId: agent.id },
      });
      agentId = agent.id;
    }

    // Business member fallback
    if (!wallet) {
      const member = await this.prisma.businessMember.findFirst({
        where: { userId: user.sub },
        select: { businessId: true },
      });
      if (member) {
        wallet = await this.prisma.wallet.findUnique({
          where: { businessId: member.businessId },
        });
      }
    }

    if (!wallet) throw new NotFoundException('No wallet found for this user');
    if (wallet.status !== 'ACTIVE') throw new BadRequestException('Wallet is not active');
    if (wallet.balanceCents < amountCents) throw new BadRequestException('Insufficient balance');

    const reference = `PAYOUT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const newBalance = wallet.balanceCents - amountCents;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: newBalance },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PAYOUT',
          status: 'COMPLETED',
          amountCents,
          currency: wallet.currency,
          balanceAfterCents: newBalance,
          reference,
          description: `M-Pesa withdrawal${body.phone ? ` to ${body.phone}` : ''}`,
          completedAt: new Date(),
        },
      });
      // Payout record is agent-only (agentId is required); skip it for business wallets
      let payoutId: string | null = null;
      if (agentId) {
        const payout = await tx.payout.create({
          data: {
            agentId,
            amountCents,
            currency: wallet.currency,
            method: 'MPESA',
            destination: body.phone ?? '',
            status: 'COMPLETED',
            reference,
            processedAt: new Date(),
          },
        });
        payoutId = payout.id;
      }
      return {
        reference,
        status: 'COMPLETED',
        amount: Number(amountCents) / 100,
        balance: Number(newBalance) / 100,
        currency: wallet.currency,
        payoutId,
        message: 'Withdrawal successful. Funds will arrive on your M-Pesa shortly.',
      };
    });
  }

  @Get('auto-recharge')
  getAutoRecharge() {
    return { enabled: false, threshold: 0, amount: 0 };
  }

  @Patch('auto-recharge')
  updateAutoRecharge(
    @Body() body: { enabled?: boolean; threshold?: number; amount?: number },
  ) {
    return {
      enabled: body.enabled ?? false,
      threshold: body.threshold ?? 0,
      amount: body.amount ?? 0,
    };
  }
}
