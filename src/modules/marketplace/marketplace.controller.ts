import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import {
  AdminReviewListingDto,
  BrowseListingsDto,
  CreateListingDto,
  PlaceBidDto,
  ReviewBidDto,
  UpdateListingDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarketplaceController {
  constructor(
    private readonly service: MarketplaceService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Public browse (any authenticated user) ──────────────────────────────

  @Get()
  browse(@Query() dto: BrowseListingsDto, @CurrentUser() user: JwtUser) {
    return this.service.browse(dto);
  }

  @Get('my-listings')
  @Roles('BUSINESS', 'SUPERVISOR', 'ADMIN')
  async myListings(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.myListings(user.sub, Number(page) || 1, Number(limit) || 20);
  }

  @Get('my-bids')
  @Roles('AGENT')
  myBids(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.myBids(user.sub, Number(page) || 1, Number(limit) || 20);
  }

  // Admin routes — must come before :id so they don't get swallowed
  @Get('admin')
  @Roles('ADMIN')
  adminList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.service.adminListListings(Number(page) || 1, Number(limit) || 30, status);
  }

  @Patch('admin/:id/approve')
  @Roles('ADMIN')
  adminApprove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtUser,
  ) {
    return this.service.adminApproveListing(id, admin.sub);
  }

  @Patch('admin/:id/reject')
  @Roles('ADMIN')
  adminReject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtUser,
    @Body() dto: AdminReviewListingDto,
  ) {
    return this.service.adminRejectListing(id, admin.sub, dto);
  }

  // ── Listing detail ──────────────────────────────────────────────────────

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtUser) {
    const agentId = user.role === 'AGENT'
      ? (await this.prisma.agent.findUnique({ where: { userId: user.sub }, select: { id: true } }))?.id
      : undefined;
    return this.service.findOne(id, agentId);
  }

  // ── Org owner — manage listings ─────────────────────────────────────────

  @Post()
  @Roles('BUSINESS', 'SUPERVISOR')
  createListing(@CurrentUser() user: JwtUser, @Body() dto: CreateListingDto) {
    return this.service.createListing(user.sub, dto);
  }

  @Patch(':id')
  @Roles('BUSINESS', 'SUPERVISOR')
  updateListing(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateListingDto,
  ) {
    return this.service.updateListing(id, user.sub, dto);
  }

  @Patch(':id/close')
  @Roles('BUSINESS', 'SUPERVISOR')
  closeListing(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtUser) {
    return this.service.closeListing(id, user.sub);
  }

  @Get(':id/bids')
  @Roles('BUSINESS', 'SUPERVISOR', 'ADMIN')
  getListingBids(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getListingBids(id, user.sub);
  }

  @Patch(':id/bids/:bidId/accept')
  @Roles('BUSINESS', 'SUPERVISOR')
  acceptBid(
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.acceptBid(bidId, user.sub);
  }

  @Patch(':id/bids/:bidId/reject')
  @Roles('BUSINESS', 'SUPERVISOR')
  rejectBid(
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReviewBidDto,
  ) {
    return this.service.rejectBid(bidId, user.sub, dto);
  }

  // ── Agent — bidding ─────────────────────────────────────────────────────

  @Post(':id/bids')
  @Roles('AGENT')
  placeBid(
    @Param('id', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: PlaceBidDto,
  ) {
    return this.service.placeBid(taskId, user.sub, dto);
  }

  @Patch('bids/:bidId/withdraw')
  @Roles('AGENT')
  withdrawBid(
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.withdrawBid(bidId, user.sub);
  }
}
