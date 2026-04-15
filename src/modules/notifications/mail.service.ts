import { Injectable, Logger } from '@nestjs/common';

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
}

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  async send(payload: MailPayload): Promise<void> {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      this.log.warn('BREVO_API_KEY not set — email skipped');
      return;
    }
    try {
      const body = {
        sender: {
          email: payload.fromEmail ?? process.env.BREVO_FROM_EMAIL ?? 'noreply@workstream.io',
          name: payload.fromName ?? process.env.EMAIL_FROM_NAME ?? 'Workstream',
        },
        to: [{ email: payload.to }],
        subject: payload.subject,
        htmlContent: payload.html,
        ...(payload.text ? { textContent: payload.text } : {}),
      };
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        this.log.log(`Email sent → ${payload.to}`);
      } else {
        const err = await res.json().catch(() => ({})) as any;
        this.log.error(`Brevo error ${res.status}: ${err?.message ?? res.statusText}`);
      }
    } catch (err) {
      this.log.error(`Brevo send failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}
