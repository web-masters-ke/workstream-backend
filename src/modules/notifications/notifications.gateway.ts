import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Notification } from '@prisma/client';

@WebSocketGateway({ cors: true, namespace: '/notifications' })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly log = new Logger(NotificationsGateway.name);

  /** userId → Set of active socket IDs (multiple tabs / devices) */
  private readonly connectedUsers = new Map<string, Set<string>>();
  /** Users who have chosen "appear offline" — broadcast as OFFLINE to others */
  private readonly invisibleUsers = new Set<string>();

  // ── JWT payload extraction (no full verify — presence is non-security-critical) ──

  private extractUserId(token?: string): string | null {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      // Normalize base64url → base64
      const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(
        Buffer.from(raw, 'base64').toString('utf8'),
      );
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  // ── Lifecycle hooks ──────────────────────────────────────────────────────────

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    const userId = this.extractUserId(token);
    if (userId) client.data.userId = userId;
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    const sockets = this.connectedUsers.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.connectedUsers.delete(userId);
        // Only announce offline if user wasn't already invisible
        if (!this.invisibleUsers.has(userId)) {
          this.server.to('presence').emit('event', {
            type: 'user.presence',
            payload: { userId, status: 'OFFLINE' },
          });
        }
      }
    }
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────────

  @SubscribeMessage('subscribe')
  onSubscribe(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!userId) return { ok: false };

    client.join(`user:${userId}`);
    client.join('presence');
    client.data.userId = userId;

    // Register socket in presence map
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(client.id);

    // Broadcast that this user came online (skip if invisible)
    if (!this.invisibleUsers.has(userId)) {
      client.to('presence').emit('event', {
        type: 'user.presence',
        payload: { userId, status: 'ONLINE' },
      });
    }

    // Send current online-users snapshot to the newly connected socket
    const onlineUsers: Array<{ userId: string; status: string }> = [];
    for (const [uid, sockets] of this.connectedUsers) {
      if (sockets.size > 0 && !this.invisibleUsers.has(uid)) {
        onlineUsers.push({ userId: uid, status: 'ONLINE' });
      }
    }
    client.emit('event', {
      type: 'presence.snapshot',
      payload: { users: onlineUsers },
    });

    this.log.debug(`socket ${client.id} subscribed to user:${userId}`);
    return { ok: true };
  }

  // ── Set presence ──────────────────────────────────────────────────────────────

  @SubscribeMessage('set_presence')
  onSetPresence(
    @MessageBody() body: { status: 'ONLINE' | 'AWAY' | 'INVISIBLE' },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return { ok: false };

    const { status } = body;

    if (status === 'INVISIBLE') {
      this.invisibleUsers.add(userId);
    } else {
      this.invisibleUsers.delete(userId);
    }

    // Broadcast effective status (INVISIBLE shows as OFFLINE to others)
    const effectiveStatus = status === 'INVISIBLE' ? 'OFFLINE' : status;
    this.server.to('presence').emit('event', {
      type: 'user.presence',
      payload: { userId, status: effectiveStatus },
    });

    return { ok: true };
  }

  // ── Helpers used by other services ───────────────────────────────────────────

  emitToUser(userId: string, notification: Notification) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  /** Emit a typed real-time event to a user's room (chat messages, task events, etc.) */
  emitEvent(userId: string, event: { type: string; payload: Record<string, unknown> }) {
    this.server.to(`user:${userId}`).emit('event', event);
  }
}
