import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { NotificationsGateway } from './notifications.gateway';
import { RegisterDeviceDto, SendNotificationDto } from './dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async send(dto: SendNotificationDto): Promise<Notification> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const channel = dto.channel ?? NotificationChannel.IN_APP;
    const notif = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        body: dto.body,
        channel,
        data: dto.data ?? undefined,
        imageUrl: dto.imageUrl,
        status: NotificationStatus.PENDING,
      },
    });

    this.gateway.emitToUser(dto.userId, notif);

    if (channel === NotificationChannel.PUSH && user.fcmTokens.length) {
      const res = await this.fcm.send({
        tokens: user.fcmTokens,
        title: dto.title,
        body: dto.body,
        data: dto.data ? this.stringifyValues(dto.data) : undefined,
        imageUrl: dto.imageUrl,
      });

      if (res.invalidTokens.length) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            fcmTokens: user.fcmTokens.filter((t) => !res.invalidTokens.includes(t)),
          },
        });
      }

      return this.prisma.notification.update({
        where: { id: notif.id },
        data: {
          status:
            res.successCount > 0
              ? NotificationStatus.SENT
              : NotificationStatus.FAILED,
          sentAt: new Date(),
          error:
            res.failureCount > 0
              ? `Failed ${res.failureCount} of ${res.successCount + res.failureCount}`
              : null,
        },
      });
    }

    return this.prisma.notification.update({
      where: { id: notif.id },
      data: { status: NotificationStatus.SENT, sentAt: new Date() },
    });
  }

  listForUser(userId: string, opts: { page: number; limit: number; unreadOnly: boolean }) {
    const skip = (opts.page - 1) * opts.limit;
    const where = {
      userId,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: opts.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
  }

  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
  }

  async registerDevice(dto: RegisterDeviceDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    const tokens = Array.from(new Set([...user.fcmTokens, dto.token]));
    return this.prisma.user.update({
      where: { id: dto.userId },
      data: { fcmTokens: tokens },
      select: { id: true, fcmTokens: true },
    });
  }

  async unregisterDevice(dto: RegisterDeviceDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: dto.userId },
      data: { fcmTokens: user.fcmTokens.filter((t) => t !== dto.token) },
      select: { id: true, fcmTokens: true },
    });
  }

  private stringifyValues(obj: Record<string, any>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return out;
  }
}
