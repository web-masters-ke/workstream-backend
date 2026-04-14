import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import {
  AssignmentResponseDto,
  AssignTaskDto,
  CreateTaskDto,
  ListTasksDto,
  TransitionTaskDto,
  UpdateTaskDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(
    private readonly service: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('available')
  @Roles('AGENT')
  async listAvailable(@CurrentUser() user: JwtUser, @Query() dto: PaginationDto) {
    const agent = await this.prisma.agent.findUnique({
      where: { userId: user.sub },
      select: { id: true },
    });
    if (!agent) throw new NotFoundException('Agent profile not found');
    return this.service.listAvailable(agent.id, dto);
  }

  @Get('sla/breaches')
  @Roles('BUSINESS', 'SUPERVISOR', 'ADMIN')
  getSLABreaches(@Query('businessId') businessId?: string) {
    return this.service.getSLABreaches(businessId);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateTaskDto) {
    return this.service.create(user.sub, dto);
  }

  @Get()
  list(@Query() dto: ListTasksDto) {
    return this.service.list(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: TransitionTaskDto,
  ) {
    return this.service.transition(id, user.sub, dto);
  }

  @Post(':id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: AssignTaskDto,
  ) {
    return this.service.assign(id, user.sub, dto);
  }

  @Post('assignments/:assignmentId/accept')
  accept(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: AssignmentResponseDto,
  ) {
    return this.service.respondToAssignment(assignmentId, user.sub, true, dto);
  }

  @Post('assignments/:assignmentId/decline')
  decline(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: AssignmentResponseDto,
  ) {
    return this.service.respondToAssignment(assignmentId, user.sub, false, dto);
  }

  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.history(id);
  }

  @Post(':id/escalate')
  escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body('reason') reason: string,
  ) {
    return this.service.escalate(id, user.sub, reason);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
