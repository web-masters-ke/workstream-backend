import {
  Body,
  Controller,
  Get,
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

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // Users
  @Get('users')
  @Roles('ADMIN')
  listUsers(@Query() query: any) {
    return this.service.listUsers(query);
  }

  @Get('users/:id')
  @Roles('ADMIN')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getUser(id);
  }

  @Patch('users/:id/status')
  @Roles('ADMIN')
  updateUserStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: string) {
    return this.service.updateUserStatus(id, status);
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

  // Disputes — all authenticated users can file
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

  @Patch('disputes/:id')
  @Roles('ADMIN', 'SUPERVISOR')
  resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.service.resolveDispute(id, dto);
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
}
