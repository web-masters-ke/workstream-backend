import { Injectable, Logger } from '@nestjs/common';

export interface SmsPayload {
  to: string; // E.164 e.g. 254712345678
  message: string;
}

@Injectable()
export class SmsService {
  private readonly log = new Logger(SmsService.name);

  async send(payload: SmsPayload): Promise<void> {
    const url = process.env.BONGA_SMS_URL;
    const apiKey = process.env.BONGA_API_KEY;
    if (!url || !apiKey) {
      this.log.warn('Bonga SMS not configured — SMS skipped');
      return;
    }
    try {
      const body = {
        apiClientID: process.env.BONGA_CLIENT_ID,
        key: apiKey,
        secret: process.env.BONGA_API_SECRET,
        txtMessage: payload.message,
        MSISDN: payload.to,
        serviceID: process.env.BONGA_SERVICE_ID,
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as any;
      if (res.ok && (data.status === 'success' || data.success)) {
        this.log.log(`SMS sent → ${payload.to}`);
      } else {
        this.log.warn(`Bonga SMS failed: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      this.log.error(`Bonga SMS error: ${err instanceof Error ? err.message : err}`);
    }
  }
}
