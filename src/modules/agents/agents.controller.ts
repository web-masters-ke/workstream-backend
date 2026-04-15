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
import { AgentsService } from './agents.service';
import {
  AddAvailabilitySlotDto,
  AddSkillDto,
  CreateAgentDto,
  InviteAgentDto,
  ListAgentsDto,
  SetAvailabilityDto,
  UpdateAgentDto,
  UpdateAgentStatusDto,
  UpdateKycDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Post()
  create(@Body() dto: CreateAgentDto) {
    return this.service.create(dto);
  }

  @Post('invite')
  invite(@Body() dto: InviteAgentDto) {
    return this.service.invite(dto);
  }

  @Get()
  list(@Query() dto: ListAgentsDto) {
    return this.service.list(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/performance')
  getPerformance(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPerformance(id);
  }

  @Get(':id/earnings')
  getEarnings(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getEarnings(id);
  }

  @Get(':id/disputes')
  getDisputes(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getDisputes(id);
  }

  @Get(':id/tasks')
  getTasks(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getTasks(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/availability')
  setAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.service.setAvailability(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPERVISOR')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }

  @Patch(':id/kyc')
  @Roles('ADMIN')
  updateKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKycDto,
  ) {
    return this.service.updateKyc(id, dto);
  }

  @Post(':id/skills')
  addSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddSkillDto,
  ) {
    return this.service.addSkill(id, dto);
  }

  @Delete('skills/:skillId')
  removeSkill(@Param('skillId', ParseUUIDPipe) skillId: string) {
    return this.service.removeSkill(skillId);
  }

  @Post(':id/availability-slots')
  addSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAvailabilitySlotDto,
  ) {
    return this.service.addSlot(id, dto);
  }

  @Delete('availability-slots/:slotId')
  removeSlot(@Param('slotId', ParseUUIDPipe) slotId: string) {
    return this.service.removeSlot(slotId);
  }
}
