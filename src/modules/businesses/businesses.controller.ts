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
import { BusinessesService } from './businesses.service';
import {
  AddMemberDto,
  CreateBusinessDto,
  CreateWorkspaceDto,
  ListBusinessesDto,
  UpdateBusinessDto,
  UpdateMemberDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('businesses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessesController {
  constructor(
    private readonly service: BusinessesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateBusinessDto) {
    return this.service.create(user.sub, dto);
  }

  @Get()
  list(@Query() dto: ListBusinessesDto) {
    return this.service.list(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'BUSINESS')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  // Workspaces
  @Get(':id/workspaces')
  listWorkspaces(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listWorkspaces(id);
  }

  @Post(':id/workspaces')
  createWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.service.createWorkspace(id, dto);
  }

  @Delete(':id/workspaces/:wsId')
  deleteWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wsId', ParseUUIDPipe) wsId: string,
  ) {
    return this.service.deleteWorkspace(id, wsId);
  }

  // Members
  @Get(':id/members')
  listMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listMembers(id);
  }

  @Post(':id/members')
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(id, dto);
  }

  @Patch('members/:memberId')
  updateMember(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.service.updateMember(memberId, dto);
  }

  @Delete('members/:memberId')
  removeMember(@Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.service.removeMember(memberId);
  }
}
