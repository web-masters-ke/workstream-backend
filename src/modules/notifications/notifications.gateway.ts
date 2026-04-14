import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Notification } from '@prisma/client';

@WebSocketGateway({ cors: true, namespace: '/notifications' })
export class NotificationsGateway {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger(NotificationsGateway.name);

  @SubscribeMessage('subscribe')
  onSubscribe(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!userId) return { ok: false };
    client.join(`user:${userId}`);
    this.log.debug(`socket ${client.id} subscribed to user:${userId}`);
    return { ok: true };
  }

  emitToUser(userId: string, notification: Notification) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
