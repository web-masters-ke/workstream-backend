import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('transactions')
  async getTransactions(@CurrentUser() user: JwtUser) {
    const member = await this.prisma.businessMember.findFirst({
      where: { userId: user.sub },
      select: { businessId: true },
    });
    if (!member) return [];

    const wallet = await this.prisma.wallet.findUnique({
      where: { businessId: member.businessId },
    });
    if (!wallet) return [];

    return this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
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
