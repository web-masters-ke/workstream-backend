import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  CreateConversationDto,
  ListMessagesDto,
  SendMessageDto,
  StartCallDto,
  UpdateCallDto,
} from './dto';
import { JwtUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class CommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async createConversation(creatorId: string, dto: CreateConversationDto) {
    const ids = Array.from(new Set([creatorId, ...dto.participantUserIds]));
    const conv = await this.prisma.conversation.create({
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

    // Notify all participants that a new conversation was created
    for (const p of conv.participants) {
      this.gateway.emitEvent(p.userId, {
        type: 'conversation.created',
        payload: { conversationId: conv.id, title: conv.title ?? '', taskId: conv.taskId ?? null } as Record<string, unknown>,
      });
    }

    return conv;
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
    const conv = await this.findConversation(conversationId, senderId);

    // Get sender name for the real-time event
    const sender = conv.participants.find((p) => p.userId === senderId);
    const senderName = sender?.user?.name ?? 'Unknown';

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

    // Emit real-time event to every other participant
    for (const p of conv.participants) {
      if (p.userId === senderId) continue;
      this.gateway.emitEvent(p.userId, {
        type: 'conversation.message',
        payload: {
          conversationId,
          messageId: msg.id,
          body: dto.body ?? '',
          senderName,
          senderId,
          taskId: conv.taskId ?? null,
        } as Record<string, unknown>,
      });
    }

    return msg;
  }

  async sendTyping(conversationId: string, senderId: string, isTyping: boolean) {
    const conv = await this.findConversation(conversationId, senderId);
    const sender = conv.participants.find((p) => p.userId === senderId);
    const senderName = sender?.user?.name ?? 'Unknown';

    for (const p of conv.participants) {
      if (p.userId === senderId) continue;
      this.gateway.emitEvent(p.userId, {
        type: 'conversation.typing',
        payload: { conversationId, senderId, senderName, isTyping } as Record<string, unknown>,
      });
    }
    return { ok: true };
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
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: { sender: { select: { id: true, name: true } } },
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

  // ── Security helpers ─────────────────────────────────────────────────────

  /**
   * Generates a cryptographically random room name.
   * 20 hex chars = 80 bits of entropy → effectively impossible to brute-force.
   * Prefix "ws" keeps it recognisable in Jitsi dashboards.
   */
  private secureRoomName(): string {
    return `ws${randomBytes(10).toString('hex')}`;
  }

  /**
   * Generates a human-readable meeting password.
   * Uses an unambiguous character set (no 0/O, 1/I/l) so it's safe to read aloud.
   * 8 chars from 54-char alphabet ≈ 46 bits of entropy.
   */
  private securePassword(): string {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = randomBytes(8);
    return Array.from(bytes)
      .map((b) => CHARS[b % CHARS.length])
      .join('');
  }

  // ---- Calls ----

  async startCall(initiatorId: string, dto: StartCallDto) {
    const appId        = process.env.JAAS_APP_ID ?? 'vpaas-magic-cookie-315e6ce2ff244da49ecbd19f303846d7';
    const roomName     = dto.roomName ?? this.secureRoomName();
    const meetingUrl   = dto.meetingUrl ?? `https://8x8.vc/${appId}/${roomName}`;
    const meetingPassword = this.securePassword();

    const isScheduled =
      dto.scheduledAt && new Date(dto.scheduledAt).getTime() > Date.now();

    return this.prisma.callSession.create({
      data: {
        initiatorId,
        conversationId: dto.conversationId ?? null,
        type: dto.type ?? 'VIDEO',
        status: isScheduled ? 'INITIATED' : 'ONGOING',
        startedAt: isScheduled ? null : new Date(),
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        roomName,
        meetingUrl,
        meetingTitle: dto.meetingTitle ?? null,
        meetingPassword,
        participantIds: dto.participantIds ?? initiatorId,
        recurrenceRule: dto.recurrenceRule ?? null,
      },
    });
  }

  /** "Start now" — activate a scheduled INITIATED call and spawn the next recurrence */
  async activateScheduledCall(callId: string, initiatorId: string) {
    const call = await this.prisma.callSession.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.initiatorId !== initiatorId) {
      throw new ForbiddenException('Only the organizer can start this meeting');
    }
    if (call.status !== 'INITIATED') {
      throw new ForbiddenException('Call is already active or has ended');
    }

    const updated = await this.prisma.callSession.update({
      where: { id: callId },
      data: { status: 'ONGOING', startedAt: new Date() },
    });

    // Spawn next recurrence if applicable
    if (call.recurrenceRule && call.scheduledAt) {
      const nextDate = this.nextOccurrence(call.scheduledAt, call.recurrenceRule);
      if (nextDate) {
        const nextRoom = this.secureRoomName();
        await this.prisma.callSession.create({
          data: {
            initiatorId,
            type: call.type,
            status: 'INITIATED',
            scheduledAt: nextDate,
            meetingTitle: call.meetingTitle,
            roomName: nextRoom,
            meetingUrl: `https://8x8.vc/${process.env.JAAS_APP_ID ?? 'vpaas-magic-cookie-315e6ce2ff244da49ecbd19f303846d7'}/${nextRoom}`,
            meetingPassword: this.securePassword(),
            participantIds: call.participantIds,
            recurrenceRule: call.recurrenceRule,
            recurrenceParentId: call.recurrenceParentId ?? call.id,
          },
        });
      }
    }

    return updated;
  }

  private nextOccurrence(from: Date, rule: string): Date | null {
    const d = new Date(from);
    switch (rule) {
      case 'DAILY':
        d.setDate(d.getDate() + 1);
        break;
      case 'WEEKDAYS':
        do { d.setDate(d.getDate() + 1); } while ([0, 6].includes(d.getDay()));
        break;
      case 'WEEKLY':
        d.setDate(d.getDate() + 7);
        break;
      case 'BIWEEKLY':
        d.setDate(d.getDate() + 14);
        break;
      case 'MONTHLY':
        d.setMonth(d.getMonth() + 1);
        break;
      default:
        return null;
    }
    return d;
  }

  async getCall(id: string) {
    const call = await this.prisma.callSession.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async updateCall(id: string, dto: UpdateCallDto) {
    const call = await this.prisma.callSession.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    const data: any = { ...dto };
    if (
      dto.status &&
      (dto.status === 'COMPLETED' || dto.status === 'FAILED' || dto.status === 'MISSED') &&
      !call.endedAt
    ) {
      data.endedAt = new Date();
      if (!dto.durationSec && call.startedAt) {
        data.durationSec = Math.round(
          (Date.now() - new Date(call.startedAt).getTime()) / 1000,
        );
      }
    }
    return this.prisma.callSession.update({ where: { id }, data });
  }

  async listCalls(userId: string) {
    return this.prisma.callSession.findMany({
      where: {
        initiatorId: userId,
        status: { in: ['ONGOING', 'COMPLETED', 'MISSED', 'FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async listScheduledCalls(userId: string) {
    return this.prisma.callSession.findMany({
      where: {
        initiatorId: userId,
        status: 'INITIATED',
        scheduledAt: { not: null },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    });
  }

  // ── JaaS JWT ─────────────────────────────────────────────────────────────

  /**
   * Mints a short-lived RS256 JWT for the calling Workstream user.
   * Jitsi trusts this token and immediately grants moderator rights —
   * no separate Jitsi login required.
   */
  async mintJaasToken(user: JwtUser, roomName?: string): Promise<{ token: string }> {
    const appId   = process.env.JAAS_APP_ID   ?? '';
    const keyId   = process.env.JAAS_KEY_ID   ?? '';
    const rawKey  = process.env.JAAS_PRIVATE_KEY ?? '';

    // Replace literal \n sequences that .env stores as escaped newlines
    const privateKey = rawKey.replace(/\\n/g, '\n');

    // Fetch user's display name from DB
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { name: true, email: true },
    });

    const now = Math.floor(Date.now() / 1000);

    const payload = {
      aud: 'jitsi',
      iss: 'chat',
      iat: now,
      exp: now + 7200,        // 2-hour token
      nbf: now - 5,
      sub: appId,
      context: {
        features: {
          livestreaming: false,
          recording: false,
          transcription: false,
          'outbound-call': false,
          'sip-outbound-call': false,
        },
        user: {
          'hidden-from-recorder': false,
          moderator: true,            // Workstream user = meeting moderator
          name: dbUser?.name ?? user.email,
          id: user.sub,
          avatar: '',
          email: dbUser?.email ?? user.email,
        },
      },
      room: roomName ?? '*',
    };

    const token = jwt.sign(payload, privateKey, {
      algorithm: 'RS256',
      header: { kid: `${appId}/${keyId}`, typ: 'JWT', alg: 'RS256' },
    });

    return { token };
  }
}
