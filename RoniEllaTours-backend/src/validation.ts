import { z } from 'zod';

const line = (max: number) => z.string().trim().min(1).max(max).regex(/^[^\u0000-\u001f\u007f]+$/u);
export const address = z.email().max(254).regex(/^[^\s<>\r\n]+$/);
const identifier = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const submissionSchema = z.strictObject({
  type: z.enum(['contact', 'tour-interest', 'registration']),
  name: line(120),
  email: address,
  phone: z.string().trim().min(7).max(30).regex(/^\+?[0-9 ()-]+$/),
  destinationId: identifier.optional(),
  tourId: identifier.optional(),
  message: z.string().trim().max(2000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u).default(''),
  consent: z.strictObject({ privacy: z.literal(true), enquiryOnly: z.literal(true).optional() }),
  source: z.strictObject({ page: z.string().max(200).regex(/^\/[a-zA-Z0-9/_-]*$/), locale: z.enum(['he', 'en', 'ru']) }),
  website: z.string().max(200).default(''),
  turnstileToken: z.string().min(1).max(2048).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'tour-interest' && !value.destinationId && !value.tourId)
    ctx.addIssue({ code: 'custom', path: ['destinationId'], message: 'A destination or tour is required.' });
  if (value.type === 'registration' && (!value.tourId || !value.consent.enquiryOnly))
    ctx.addIssue({ code: 'custom', path: ['consent'], message: 'Tour and enquiry-only acknowledgement are required.' });
});
export type Submission = z.infer<typeof submissionSchema>;
export type Enquiry = Omit<Submission, 'website' | 'turnstileToken'> & { id: string; createdAt: string };
export const idempotencySchema = z.uuid();
