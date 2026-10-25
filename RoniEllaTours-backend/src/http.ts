import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig, type Config } from './config.js';
import { createEmailProvider, type EmailProvider } from './email.js';
import { createAbuseProtection, type AbuseProtection } from './abuse.js';
import { HttpError } from './errors.js';
import { idempotencySchema, submissionSchema } from './validation.js';
import { submitEnquiry } from './enquiries.js';

export const MAX_BODY_BYTES = 16 * 1024;
type Request = IncomingMessage & { body?: unknown };
async function readBody(req: Request): Promise<unknown> {
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw new HttpError(413, 'BODY_TOO_LARGE', 'Body exceeds 16 KiB.');
  let raw: string;
  if (req.body !== undefined) {
    // Vercel may supply a parsed body. Check its serialized size too.
    raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  } else {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      size += bytes.length;
      if (size > MAX_BODY_BYTES) throw new HttpError(413, 'BODY_TOO_LARGE', 'Body exceeds 16 KiB.');
      chunks.push(bytes);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new HttpError(413, 'BODY_TOO_LARGE', 'Body exceeds 16 KiB.');
  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'INVALID_JSON', 'Body must be valid JSON.'); }
}
export function createHandler(options: { env?: NodeJS.ProcessEnv; config?: Config; email?: EmailProvider; abuse?: AbuseProtection; fetchImpl?: typeof fetch } = {}) {
  return async (req: Request, res: ServerResponse): Promise<void> => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const send = (status: number, body: object) => { res.statusCode = status; res.end(JSON.stringify({ ...body, requestId })); };
    try {
      const c = options.config ?? loadConfig(options.env ?? process.env);
      const origin = req.headers.origin;
      if (origin && !c.origins.includes(origin)) throw new HttpError(403, 'ORIGIN_DENIED', 'Origin is not allowed.');
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, Retry-After');
      }
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (!['/api/health', '/api/v1/leads'].includes(path)) throw new HttpError(404, 'NOT_FOUND', 'Endpoint not found.');
      const method = path === '/api/health' ? 'GET' : 'POST';
      res.setHeader('Allow', `${method}, OPTIONS`);
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', `${method}, OPTIONS`);
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
        res.statusCode = 204; res.end(); return;
      }
      if (req.method !== method) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      if (path === '/api/health') { send(200, { status: 'ok', service: 'roniella-tours-backend' }); return; }
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json.');
      if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') throw new HttpError(415, 'UNSUPPORTED_ENCODING', 'Compressed bodies are not supported.');
      const key = idempotencySchema.safeParse(req.headers['idempotency-key']);
      if (!key.success) throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Supply a UUID Idempotency-Key header.');
      const abuse = options.abuse ?? createAbuseProtection(c, options.fetchImpl);
      await abuse.beforeBody();
      const parsed = submissionSchema.safeParse(await readBody(req));
      if (!parsed.success) throw new HttpError(422, 'INVALID_SUBMISSION', 'Invalid enquiry fields. Unknown fields, including sensitive registration details, are forbidden. Check the documented schema.');
      await abuse.check(parsed.data);
      const result = await submitEnquiry(parsed.data, key.data.toLowerCase(), options.email ?? createEmailProvider(c, options.fetchImpl));
      send(result.status === 'email_accepted' ? 202 : 200, result);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.retryAfter) res.setHeader('Retry-After', error.retryAfter);
        send(error.status, { error: { code: error.code, message: error.message } });
      } else {
        // Never log raw errors, provider responses, request bodies or credentials.
        send(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Service configuration or processing is unavailable.' } });
      }
    }
  };
}
