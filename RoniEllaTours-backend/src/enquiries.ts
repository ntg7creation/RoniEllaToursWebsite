import { createHash } from 'node:crypto';
import type { EmailProvider } from './email.js';
import type { Enquiry, Submission } from './validation.js';

export async function submitEnquiry(s: Submission, key: string, email: EmailProvider, now = new Date()) {
  const { website: _website, turnstileToken: _token, ...fields } = s;
  const enquiry: Enquiry = { ...fields, id: `enq_${createHash('sha256').update(key).digest('hex')}`, createdAt: now.toISOString() };
  const receipt = await email.send(enquiry, key);
  return { status: receipt.status === 'accepted' ? 'email_accepted' : 'local_simulation', enquiryId: enquiry.id,
    stored: false, bookingConfirmed: false,
    message: receipt.status === 'accepted'
      ? 'Email provider accepted the enquiry. Delivery is not confirmed; no lead was saved and no booking was made.'
      : 'Local simulation only. No email was sent, no lead was saved and no booking was made.' };
}
