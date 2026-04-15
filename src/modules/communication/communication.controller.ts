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
  Request,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import {
  CreateConversationDto,
  ListMessagesDto,
  SendMessageDto,
  StartCallDto,
  UpdateCallDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';

@Controller('communication')
@UseGuards(JwtAuthGuard)
export class CommunicationController {
  constructor(private readonly service: CommunicationService) {}

  @Post('conversations')
  createConversation(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.service.createConversation(user.sub, dto);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: JwtUser) {
    return this.service.listUserConversations(user.sub);
  }

  @Get('conversations/:id')
  findConversation(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findConversation(id, user.sub);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(id, user.sub, dto);
  }

  @Get('conversations/:id/messages')
  listMessages(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ListMessagesDto,
  ) {
    return this.service.listMessages(id, user.sub, dto);
  }

  @Patch('conversations/:id/read')
  markRead(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markRead(id, user.sub);
  }

  @Post('conversations/:id/typing')
  typingIndicator(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { isTyping?: boolean },
  ) {
    return this.service.sendTyping(id, user.sub, body.isTyping ?? true);
  }

  @Post('calls')
  startCall(@CurrentUser() user: JwtUser, @Body() dto: StartCallDto) {
    return this.service.startCall(user.sub, dto);
  }

  @Get('calls')
  listCalls(@CurrentUser() user: JwtUser) {
    return this.service.listCalls(user.sub);
  }

  // IMPORTANT: static /calls/* routes must be declared BEFORE /calls/:id to avoid route conflict

  @Get('calls/scheduled')
  listScheduledCalls(@CurrentUser() user: JwtUser) {
    return this.service.listScheduledCalls(user.sub);
  }

  /** Mint a JaaS JWT for the calling user — frontend passes this to Jitsi as `token` */
  @Get('calls/jaas-token')
  getJaasToken(
    @CurrentUser() user: JwtUser,
    @Query('roomName') roomName: string,
  ) {
    return this.service.mintJaasToken(user, roomName);
  }

  @Post('calls/:id/activate')
  activateCall(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.activateScheduledCall(id, user.sub);
  }

  @Get('calls/:id')
  getCall(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCall(id);
  }

  @Patch('calls/:id')
  updateCall(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCallDto,
  ) {
    return this.service.updateCall(id, dto);
  }
}
