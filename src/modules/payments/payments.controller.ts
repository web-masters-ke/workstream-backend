import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('wallets')
  @Roles('ADMIN')
  createWallet(@Body() dto: CreateWalletDto) {
    return this.service.createWallet(dto);
  }

  @Get('wallets/:id')
  getWallet(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getWallet(id);
  }

  @Post('wallets/:id/topup')
  topup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WalletTopupDto,
  ) {
    return this.service.topup(id, dto);
  }

  @Post('wallets/transfer')
  transfer(@Body() dto: WalletTransferDto) {
    return this.service.transfer(dto);
  }

  @Post('wallets/:id/transactions')
  record(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordTransactionDto,
  ) {
    return this.service.recordTransaction(id, dto);
  }

  @Get('wallets/:id/transactions')
  listTx(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ListTransactionsDto,
  ) {
    return this.service.listTransactions(id, dto);
  }

  @Post('tasks/:taskId/settle')
  @Roles('ADMIN', 'SUPERVISOR')
  settle(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: { agentId: string; grossCents: number },
  ) {
    return this.service.settleTaskPayment(taskId, body.agentId, body.grossCents);
  }

  @Post('payouts')
  requestPayout(@Body() dto: RequestPayoutDto) {
    return this.service.requestPayout(dto);
  }

  @Patch('payouts/:id')
  @Roles('ADMIN')
  updatePayout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePayoutDto,
  ) {
    return this.service.updatePayout(id, dto);
  }

  /** Approve a pending payout — debits agent wallet and marks COMPLETED */
  @Patch('payouts/:id/approve')
  @Roles('ADMIN')
  approvePayout(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.updatePayout(id, { status: 'COMPLETED' });
  }

  /** Reject a pending payout — no wallet debit, marks FAILED */
  @Patch('payouts/:id/reject')
  @Roles('ADMIN')
  rejectPayout(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.updatePayout(id, { status: 'FAILED' });
  }

  @Get('payouts')
  @Roles('ADMIN')
  listPayouts(@Query('agentId') agentId?: string) {
    return this.service.listPayouts(agentId);
  }

  @Post('invoices')
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.service.createInvoice(dto);
  }

  @Patch('invoices/:id/status')
  updateInvoiceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    return this.service.updateInvoiceStatus(id, dto);
  }

  @Get('invoices')
  listInvoices(@Query('businessId') businessId?: string) {
    return this.service.listInvoices(businessId);
  }

  // Agent self-serve
  @Get('my-wallet')
  @Roles('AGENT')
  getMyWallet(@CurrentUser() user: JwtUser) {
    return this.service.getMyWallet(user.sub);
  }

  @Get('my-transactions')
  @Roles('AGENT')
  getMyTransactions(@CurrentUser() user: JwtUser, @Query() dto: ListTransactionsDto) {
    return this.service.getMyTransactions(user.sub, dto);
  }

  @Post('my-payouts')
  @Roles('AGENT')
  requestMyPayout(@CurrentUser() user: JwtUser, @Body() dto: RequestPayoutDto) {
    return this.service.requestMyPayout(user.sub, dto);
  }

  // Client-facing stub routes
  @Get('methods')
  getPaymentMethods() {
    return [];
  }

  @Get('plans')
  async getSubscriptionPlans() {
    const raw = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceCents: 'asc' },
    });

    if (raw.length > 0) {
      return raw.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        price: p.priceCents / 100,
        currency: 'KES',
        interval: 'month',
        features: Array.isArray(p.features) ? p.features : [],
        isActive: p.isActive,
      }));
    }

    // Fallback KES plans when DB has no active plans yet
    return [
      {
        id: 'plan-starter',
        name: 'Starter',
        description: 'For small teams getting started',
        price: 2999,
        currency: 'KES',
        interval: 'month',
        features: ['Up to 5 agents', '100 tasks/month', 'Basic SLA tracking', 'Email support'],
        isActive: true,
      },
      {
        id: 'plan-growth',
        name: 'Growth',
        description: 'For scaling remote operations',
        price: 7999,
        currency: 'KES',
        interval: 'month',
        features: ['Up to 25 agents', 'Unlimited tasks', 'Advanced SLA + QA', 'Live chat support', 'Wallet payouts', 'Analytics dashboard'],
        isActive: true,
      },
      {
        id: 'plan-enterprise',
        name: 'Enterprise',
        description: 'For large operations with custom needs',
        price: 24999,
        currency: 'KES',
        interval: 'month',
        features: ['Unlimited agents', 'Unlimited tasks', 'Custom SLA rules', 'Dedicated account manager', 'API access', 'White-label option', 'Priority support'],
        isActive: true,
      },
    ];
  }

  @Post('topup')
  initiateTopup(@CurrentUser() user: JwtUser, @Body() body: any) {
    return { success: true, message: 'Topup initiated' };
  }
}
