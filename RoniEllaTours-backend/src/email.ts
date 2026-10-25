import type { Config } from './config.js';
import type { Enquiry } from './validation.js';
import { HttpError } from './errors.js';

export interface EmailProvider {
  send(enquiry: Enquiry, idempotencyKey: string): Promise<{ status: 'accepted' | 'simulated' }>;
}
export function createEmailProvider(c: Config, fetchImpl: typeof fetch = fetch): EmailProvider {
  if (c.EMAIL_PROVIDER === 'local') {
    // Defense in depth: configuration validation also prohibits this on hosted environments.
    if (!['development', 'test'].includes(c.NODE_ENV) || c.VERCEL) throw new Error('Local adapter forbidden.');
    return { async send() { return { status: 'simulated' }; } };
  }
  return { async send(enquiry, key) {
    if (!c.RESEND_API_KEY || !c.EMAIL_FROM || !c.EMAIL_TO)
      throw new HttpError(503, 'EMAIL_UNCONFIGURED', 'Email service is not configured.');
    // Keep the payload stable across retries. The attempt timestamp is deliberately excluded.
    const { createdAt: _createdAt, ...content } = enquiry;
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${c.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `enquiry-v1/${key}` },
        body: JSON.stringify({ from: c.EMAIL_FROM, to: [c.EMAIL_TO], reply_to: enquiry.email,
          subject: `Website ${enquiry.type} enquiry`, text: `Enquiry only; not a booking.\n\n${JSON.stringify(content, null, 2)}` }),
      });
      if (response.status === 409) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Retry the original unchanged enquiry with its original key; concurrent requests may need a short wait.');
      if (!response.ok) throw new Error('Provider rejected request');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string' || !data.id) throw new Error('Invalid provider receipt');
      return { status: 'accepted' };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'EMAIL_UNAVAILABLE', 'Email acceptance could not be confirmed. Retry with the same idempotency key.');
    }
  } };
}
