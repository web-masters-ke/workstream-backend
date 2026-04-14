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
import { WorkforceService } from './workforce.service';
import {
  CreateShiftDto,
  ListShiftsDto,
  RouteTaskDto,
  UpdateShiftDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('workforce')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkforceController {
  constructor(private readonly service: WorkforceService) {}

  @Post('shifts')
  @Roles('ADMIN', 'SUPERVISOR', 'BUSINESS')
  createShift(@Body() dto: CreateShiftDto) {
    return this.service.createShift(dto);
  }

  @Get('shifts')
  listShifts(@Query() dto: ListShiftsDto) {
    return this.service.listShifts(dto);
  }

  @Patch('shifts/:id')
  @Roles('ADMIN', 'SUPERVISOR', 'BUSINESS')
  updateShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.service.updateShift(id, dto);
  }

  @Delete('shifts/:id')
  @Roles('ADMIN', 'SUPERVISOR', 'BUSINESS')
  deleteShift(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteShift(id);
  }

  @Post('route')
  @Roles('ADMIN', 'SUPERVISOR', 'BUSINESS')
  routeTask(@Body() dto: RouteTaskDto) {
    return this.service.routeTask(dto);
  }

  @Get('queue/stats')
  queueStats() {
    return this.service.queueStats();
  }

  @Get('agents/available')
  @Roles('BUSINESS', 'SUPERVISOR', 'ADMIN')
  getAvailableAgents(@Query('taskId') taskId?: string) {
    return this.service.getAvailableAgents(taskId);
  }
}
