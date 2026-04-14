import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import {
  CreateInvoiceDto,
  CreateWalletDto,
  ListTransactionsDto,
  RecordTransactionDto,
  RequestPayoutDto,
  UpdateInvoiceStatusDto,
  UpdatePayoutDto,
  WalletTopupDto,
  WalletTransferDto,
} from './dto';

const PLATFORM_COMMISSION_BPS = 1000; // 10%

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Wallets ----
  async createWallet(dto: CreateWalletDto) {
    const exists = await this.prisma.wallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: dto.ownerType,
          ownerId: dto.ownerId,
        },
      },
    });
    if (exists) throw new ConflictException('Wallet already exists');
    return this.prisma.wallet.create({
      data: {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        currency: dto.currency ?? 'USD',
      },
    });
  }

  async getWallet(id: string) {
    const w = await this.prisma.wallet.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Wallet not found');
    return w;
  }

  async getWalletByOwner(ownerType: any, ownerId: string) {
    const w = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType, ownerId } },
    });
    if (!w) throw new NotFoundException('Wallet not found');
    return w;
  }

  async topup(walletId: string, dto: WalletTopupDto) {
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!w) throw new NotFoundException('Wallet not found');
      if (w.status !== 'ACTIVE') throw new BadRequestException('Wallet not active');
      const newBal = w.balanceCents + BigInt(dto.amountCents);
      await tx.wallet.update({
        where: { id: walletId },
        data: { balanceCents: newBal },
      });
      return tx.walletTransaction.create({
        data: {
          walletId,
          type: 'TOPUP',
          status: 'COMPLETED',
          amountCents: BigInt(dto.amountCents),
          balanceAfterCents: newBal,
          reference: dto.reference,
          description: dto.description,
          completedAt: new Date(),
        },
      });
    });
  }

  async transfer(dto: WalletTransferDto) {
    if (dto.fromWalletId === dto.toWalletId) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }
    return this.prisma.$transaction(async (tx) => {
      const from = await tx.wallet.findUnique({
        where: { id: dto.fromWalletId },
      });
      const to = await tx.wallet.findUnique({
        where: { id: dto.toWalletId },
      });
      if (!from || !to) throw new NotFoundException('Wallet not found');
      if (from.balanceCents < BigInt(dto.amountCents)) {
        throw new BadRequestException('Insufficient funds');
      }

      const fromBal = from.balanceCents - BigInt(dto.amountCents);
      const toBal = to.balanceCents + BigInt(dto.amountCents);

      await tx.wallet.update({
        where: { id: from.id },
        data: { balanceCents: fromBal },
      });
      await tx.wallet.update({
        where: { id: to.id },
        data: { balanceCents: toBal },
      });

      const debit = await tx.walletTransaction.create({
        data: {
          walletId: from.id,
          type: 'DEBIT',
          status: 'COMPLETED',
          amountCents: BigInt(dto.amountCents),
          balanceAfterCents: fromBal,
          counterpartyType: 'WALLET',
          counterpartyId: to.id,
          description: dto.description,
          completedAt: new Date(),
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: to.id,
          type: 'CREDIT',
          status: 'COMPLETED',
          amountCents: BigInt(dto.amountCents),
          balanceAfterCents: toBal,
          counterpartyType: 'WALLET',
          counterpartyId: from.id,
          description: dto.description,
          completedAt: new Date(),
        },
      });
      return debit;
    });
  }

  async recordTransaction(walletId: string, dto: RecordTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!w) throw new NotFoundException('Wallet not found');
      const signed =
        dto.type === 'DEBIT' ||
        dto.type === 'PAYOUT' ||
        dto.type === 'WITHDRAWAL' ||
        dto.type === 'FEE'
          ? -Math.abs(dto.amountCents)
          : Math.abs(dto.amountCents);
      const newBal = w.balanceCents + BigInt(signed);
      if (newBal < 0n) throw new BadRequestException('Insufficient funds');
      await tx.wallet.update({
        where: { id: walletId },
        data: { balanceCents: newBal },
      });
      return tx.walletTransaction.create({
        data: {
          walletId,
          type: dto.type,
          status: 'COMPLETED',
          amountCents: BigInt(Math.abs(dto.amountCents)),
          balanceAfterCents: newBal,
          description: dto.description,
          reference: dto.reference,
          completedAt: new Date(),
        },
      });
    });
  }

  async listTransactions(walletId: string, dto: ListTransactionsDto) {
    await this.getWallet(walletId);
    const { skip, limit, page } = pageParams(dto);
    const where: any = { walletId };
    if (dto.type) where.type = dto.type;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // ---- Task payment settlement (commission) ----
  async settleTaskPayment(
    taskId: string,
    agentId: string,
    grossCents: number,
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const commission = Math.floor((grossCents * PLATFORM_COMMISSION_BPS) / 10000);
    const net = grossCents - commission;

    const agentWallet = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: 'AGENT', ownerId: agentId } },
    });
    if (!agentWallet) throw new NotFoundException('Agent wallet not found');

    return this.prisma.$transaction(async (tx) => {
      const newBal = agentWallet.balanceCents + BigInt(net);
      await tx.wallet.update({
        where: { id: agentWallet.id },
        data: { balanceCents: newBal },
      });
      return tx.walletTransaction.create({
        data: {
          walletId: agentWallet.id,
          type: 'TASK_PAYMENT',
          status: 'COMPLETED',
          amountCents: BigInt(net),
          balanceAfterCents: newBal,
          reference: `task:${taskId}`,
          description: `Task payout (commission ${commission})`,
          metadata: { taskId, grossCents, commissionCents: commission },
          completedAt: new Date(),
        },
      });
    });
  }

  // ---- Payouts ----
  async requestPayout(dto: RequestPayoutDto) {
    const wallet = await this.prisma.wallet.findUnique({
      where: {
        ownerType_ownerId: { ownerType: 'AGENT', ownerId: dto.agentId },
      },
    });
    if (!wallet) throw new NotFoundException('Agent wallet not found');
    if (wallet.balanceCents < BigInt(dto.amountCents)) {
      throw new BadRequestException('Insufficient balance');
    }
    return this.prisma.payout.create({
      data: {
        agentId: dto.agentId,
        amountCents: BigInt(dto.amountCents),
        method: dto.method,
        destination: dto.destination,
      },
    });
  }

  async updatePayout(id: string, dto: UpdatePayoutDto) {
    const p = await this.prisma.payout.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Payout not found');
    const data: any = { status: dto.status };
    if (dto.status === 'COMPLETED') data.processedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payout.update({ where: { id }, data });
      if (dto.status === 'COMPLETED' && p.status !== 'COMPLETED') {
        // debit the agent wallet
        const wallet = await tx.wallet.findUnique({
          where: {
            ownerType_ownerId: { ownerType: 'AGENT', ownerId: p.agentId },
          },
        });
        if (wallet) {
          const newBal = wallet.balanceCents - p.amountCents;
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balanceCents: newBal },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'PAYOUT',
              status: 'COMPLETED',
              amountCents: p.amountCents,
              balanceAfterCents: newBal,
              reference: `payout:${p.id}`,
              completedAt: new Date(),
            },
          });
        }
      }
      return updated;
    });
  }

  async listPayouts(agentId?: string) {
    return this.prisma.payout.findMany({
      where: agentId ? { agentId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- Invoices ----
  async createInvoice(dto: CreateInvoiceDto) {
    const tax = dto.taxCents ?? 0;
    const total = dto.amountCents + tax;
    const number = `INV-${Date.now()}`;
    return this.prisma.invoice.create({
      data: {
        businessId: dto.businessId,
        number,
        amountCents: BigInt(dto.amountCents),
        taxCents: BigInt(tax),
        totalCents: BigInt(total),
        currency: dto.currency ?? 'USD',
        lineItems: (dto.lineItems ?? []) as any,
      },
    });
  }

  async updateInvoiceStatus(id: string, dto: UpdateInvoiceStatusDto) {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const data: any = { status: dto.status };
    if (dto.status === 'ISSUED' && !inv.issuedAt) data.issuedAt = new Date();
    if (dto.status === 'PAID') data.paidAt = new Date();
    return this.prisma.invoice.update({ where: { id }, data });
  }

  async listInvoices(businessId?: string) {
    return this.prisma.invoice.findMany({
      where: businessId ? { businessId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- Agent self-serve wallet ----
  async getMyWallet(userId: string) {
    const w = await this.prisma.wallet.findFirst({
      where: { userId },
    });
    if (!w) throw new NotFoundException('Wallet not found');
    return w;
  }

  async getMyTransactions(userId: string, dto: ListTransactionsDto) {
    const wallet = await this.getMyWallet(userId);
    return this.listTransactions(wallet.id, dto);
  }

  async requestMyPayout(userId: string, dto: RequestPayoutDto) {
    const agent = await this.prisma.agent.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) throw new NotFoundException('Agent profile not found');

    const wallet = await this.prisma.wallet.findFirst({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.status !== 'ACTIVE') throw new BadRequestException('Wallet not active');

    if (wallet.balanceCents < BigInt(dto.amountCents)) {
      throw new BadRequestException('Insufficient balance');
    }

    // Check minimum payout setting
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'payout.minCents' },
    });
    if (setting) {
      const minCents = Number(setting.value);
      if (dto.amountCents < minCents) {
        throw new BadRequestException(
          `Minimum payout is ${minCents} cents`,
        );
      }
    }

    return this.prisma.payout.create({
      data: {
        agentId: agent.id,
        amountCents: BigInt(dto.amountCents),
        method: dto.method,
        destination: dto.destination,
      },
    });
  }
}
