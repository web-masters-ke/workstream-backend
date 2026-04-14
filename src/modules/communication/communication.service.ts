import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import {
  CreateConversationDto,
  ListMessagesDto,
  SendMessageDto,
  StartCallDto,
  UpdateCallDto,
} from './dto';

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(creatorId: string, dto: CreateConversationDto) {
    const ids = Array.from(new Set([creatorId, ...dto.participantUserIds]));
    return this.prisma.conversation.create({
      data: {
        type: dto.type ?? 'DIRECT',
        title: dto.title,
        taskId: dto.taskId,
        participants: {
          create: ids.map((userId) => ({ userId })),
        },
      },
      include: { participants: true },
    });
  }

  async listUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async findConversation(id: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (!conv.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException('Not a participant');
    }
    return conv;
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
  ) {
    await this.findConversation(conversationId, senderId); // authz
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: dto.type ?? 'TEXT',
        body: dto.body,
        attachmentUrl: dto.attachmentUrl,
        metadata: dto.metadata as any,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return msg;
  }

  async listMessages(
    conversationId: string,
    userId: string,
    dto: ListMessagesDto,
  ) {
    await this.findConversation(conversationId, userId);
    const { skip, limit, page } = pageParams(dto);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({
        where: { conversationId, deletedAt: null },
      }),
    ]);
    return { items, total, page, limit };
  }

  async markRead(conversationId: string, userId: string) {
    await this.findConversation(conversationId, userId);
    return this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });
  }

  // ---- Calls ----
  async startCall(initiatorId: string, dto: StartCallDto) {
    return this.prisma.callSession.create({
      data: {
        initiatorId,
        conversationId: dto.conversationId,
        type: dto.type ?? 'VOICE',
        status: 'INITIATED',
        startedAt: new Date(),
      },
    });
  }

  async updateCall(id: string, dto: UpdateCallDto) {
    const call = await this.prisma.callSession.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    const data: any = { ...dto };
    if (
      (dto.status === 'COMPLETED' ||
        dto.status === 'FAILED' ||
        dto.status === 'MISSED') &&
      !call.endedAt
    ) {
      data.endedAt = new Date();
    }
    return this.prisma.callSession.update({ where: { id }, data });
  }

  async listCalls(userId: string) {
    return this.prisma.callSession.findMany({
      where: { initiatorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
