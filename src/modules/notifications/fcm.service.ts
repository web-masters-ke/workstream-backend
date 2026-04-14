import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

export interface FcmPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly log = new Logger(FcmService.name);
  private enabled = false;

  onModuleInit() {
    const projectId = process.env.FCM_PROJECT_ID;
    const clientEmail = process.env.FCM_CLIENT_EMAIL;
    const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.log.warn(
        'FCM credentials not set — push sends will be logged only (no real delivery).',
      );
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    this.enabled = true;
    this.log.log('FCM initialized');
  }

  async send(payload: FcmPayload): Promise<{
    successCount: number;
    failureCount: number;
    invalidTokens: string[];
  }> {
    if (!this.enabled) {
      this.log.debug(`[FCM mock] → ${payload.tokens.length} tokens | ${payload.title}`);
      return { successCount: payload.tokens.length, failureCount: 0, invalidTokens: [] };
    }
    if (!payload.tokens.length) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens: payload.tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data ?? {},
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    const res = await admin.messaging().sendEachForMulticast(message);
    const invalid: string[] = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code ?? '';
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalid.push(payload.tokens[i]);
        }
      }
    });

    return {
      successCount: res.successCount,
      failureCount: res.failureCount,
      invalidTokens: invalid,
    };
  }
}
