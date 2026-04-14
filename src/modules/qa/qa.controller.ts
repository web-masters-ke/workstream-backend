import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QAService } from './qa.service';
import { CreateQAReviewDto, ListQAReviewsDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';

@Controller('qa')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QAController {
  constructor(private readonly service: QAService) {}

  @Post('reviews')
  @Roles('ADMIN', 'SUPERVISOR', 'BUSINESS')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateQAReviewDto) {
    return this.service.create(user.sub, dto);
  }

  @Get('reviews')
  list(@Query() dto: ListQAReviewsDto) {
    return this.service.list(dto);
  }

  @Get('reviews/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get('agents/:agentId/summary')
  agentSummary(@Param('agentId', ParseUUIDPipe) agentId: string) {
    return this.service.agentSummary(agentId);
  }
}
