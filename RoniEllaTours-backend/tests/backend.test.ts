import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createHandler, MAX_BODY_BYTES } from '../src/http.js';
import { loadConfig } from '../src/config.js';
import { createEmailProvider } from '../src/email.js';
import { createAbuseProtection } from '../src/abuse.js';
import { submissionSchema } from '../src/validation.js';
import { submitEnquiry } from '../src/enquiries.js';

const base = { type: 'contact', name: 'Example Visitor', email: 'visitor@example.com', phone: '+972 50 123 4567', message: 'Please contact me.', consent: { privacy: true }, source: { page: '/contact', locale: 'en' } };
const env = { NODE_ENV: 'test', EMAIL_PROVIDER: 'resend', ABUSE_MODE: 'disabled', ALLOWED_ORIGINS: 'http://localhost:5173' };
const configured = { ...env, RESEND_API_KEY: 'fake-key', EMAIL_FROM: 'site@example.com', EMAIL_TO: 'office@example.com' };
const managed = { ...configured, ABUSE_MODE: 'managed', UPSTASH_REDIS_REST_URL: 'https://redis.example.com', UPSTASH_REDIS_REST_TOKEN: 'fake-token', RATE_HASH_SECRET: 'x'.repeat(32), TURNSTILE_SECRET_KEY: 'fake-secret', TURNSTILE_HOSTNAMES: 'example.com' };
const receipt = () => Response.json({ id: 'mock-provider-id' });
async function serve(options: Parameters<typeof createHandler>[0], run: (url: string) => Promise<void>) {
  const server = createServer(createHandler(options));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
function post(url: string, body: unknown = base, headers: Record<string, string> = {}) {
  return fetch(`${url}/api/v1/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), ...headers }, body: JSON.stringify(body) });
}
test('all enquiry types accepted only after provider acceptance; fixed recipient and Reply-To', async () => {
  const calls: Record<string, unknown>[] = [];
  await serve({ env: configured, fetchImpl: async (_url, init) => { calls.push(JSON.parse(String(init?.body))); return receipt(); } }, async url => {
    for (const extra of [{}, { type: 'tour-interest', destinationId: 'china' }, { type: 'registration', tourId: 'china-zhong-guo', consent: { privacy: true, enquiryOnly: true } }]) {
      const res = await post(url, { ...base, ...extra });
      assert.equal(res.status, 202);
      const data = await res.json();
      assert.equal(data.status, 'email_accepted'); assert.equal(data.stored, false); assert.equal(data.bookingConfirmed, false);
      assert.equal(data.requestId, res.headers.get('x-request-id'));
      assert.match(data.enquiryId, /^enq_[a-f0-9]{64}$/);
    }
  });
  for (const call of calls) { assert.deepEqual(call.to, ['office@example.com']); assert.equal(call.from, 'site@example.com'); assert.equal(call.reply_to, base.email); }
});
test('invalid, unknown and sensitive fields rejected without calling email', async () => {
  await serve({ env: configured, fetchImpl: async () => { assert.fail('Must not call provider'); } }, async url => {
    for (const patch of [{ email: 'invalid' }, { name: '' }, { email: 'a@example.com\r\nBcc:x@y.com' }, { consent: { privacy: false } }, { type: 'registration', tourId: 'china' }, { type: 'tour-interest' }, { message: 'x'.repeat(2001) }, { source: { page: '/contact', locale: 'en', passport: '123' } }, ...['passport', 'passportNumber', 'idNumber', 'nationalId', 'foodPreference', 'gender', 'to', 'from', 'recipient', 'sender', 'createdAt'].map(k => ({ [k]: 'forbidden' }))]) {
      const res = await post(url, { ...base, ...patch }); assert.equal(res.status, 422, JSON.stringify(patch));
      assert.equal((await res.json()).error.code, 'INVALID_SUBMISSION');
    }
  });
});
test('unconfigured, failed, malformed and timed-out providers never report success', async () => {
  await serve({ env, fetchImpl: async () => assert.fail('Unconfigured must not fetch') }, async url => assert.equal((await post(url)).status, 503));
  for (const fetchImpl of [async () => new Response('secret failure', { status: 500 }), async () => Response.json({}), async () => { throw new Error('secret network failure'); }, async () => { throw new DOMException('Timed out', 'TimeoutError'); }]) {
    await serve({ env: configured, fetchImpl }, async url => { const res = await post(url); assert.equal(res.status, 502); assert.doesNotMatch(await res.text(), /secret/); });
  }
});
test('provider acceptance is awaited', async () => {
  let accept!: () => void;
  const gate = new Promise<void>(resolve => { accept = resolve; });
  let called!: () => void;
  const started = new Promise<void>(resolve => { called = resolve; });
  await serve({ env: configured, fetchImpl: async () => { called(); await gate; return receipt(); } }, async url => {
    let finished = false;
    const pending = post(url).then(res => { finished = true; return res; });
    await started; assert.equal(finished, false); accept(); assert.equal((await pending).status, 202);
  });
});
test('stable provider idempotency across instances and timestamps, changed content conflicts', async () => {
  const seen = new Map<string, string>(); let deliveries = 0;
  const fetchImpl: typeof fetch = async (_url, init) => {
    const key = new Headers(init?.headers).get('Idempotency-Key')!;
    const body = String(init?.body);
    if (seen.has(key) && seen.get(key) !== body) return new Response('', { status: 409 });
    if (!seen.has(key)) { deliveries++; seen.set(key, body); }
    return receipt();
  };
  const key = randomUUID(); const c = loadConfig(configured); const submission = submissionSchema.parse(base);
  const a = await submitEnquiry(submission, key, createEmailProvider(c, fetchImpl), new Date('2026-01-01'));
  const b = await submitEnquiry(submission, key, createEmailProvider(c, fetchImpl), new Date('2026-01-02'));
  assert.equal(a.enquiryId, b.enquiryId); assert.equal(deliveries, 1);
  await assert.rejects(submitEnquiry({ ...submission, message: 'Changed' }, key, createEmailProvider(c, fetchImpl)), { status: 409 });
});
test('local simulation is explicit and impossible in production or Vercel', async () => {
  await serve({ env: { ...env, EMAIL_PROVIDER: 'local' } }, async url => {
    const res = await post(url); assert.equal(res.status, 200); const data = await res.json();
    assert.equal(data.status, 'local_simulation'); assert.match(data.message, /No email was sent/);
  });
  for (const extra of [{ NODE_ENV: 'production' }, { VERCEL: '1' }]) {
    assert.throws(() => loadConfig({ ...env, EMAIL_PROVIDER: 'local', ...extra }), /forbidden/);
    await serve({ env: { ...env, EMAIL_PROVIDER: 'local', ...extra } }, async url => assert.equal((await post(url)).status, 503));
  }
});
test('transient enquiry has server time and excludes anti-spam metadata', async () => {
  const now = new Date('2026-09-24T12:00:00.000Z');
  await submitEnquiry(submissionSchema.parse({ ...base, turnstileToken: 'private-token' }), randomUUID(), {
    async send(enquiry) {
      assert.equal(enquiry.createdAt, now.toISOString());
      assert.equal('turnstileToken' in enquiry, false); assert.equal('website' in enquiry, false);
      return { status: 'accepted' };
    },
  }, now);
});
test('configuration diagnostics name settings without disclosing values', () => {
  for (const [key, value] of Object.entries({ PORT: 'bad', EMAIL_TO: 'a@b.com,c@d.com', ALLOWED_ORIGINS: '*', UPSTASH_REDIS_REST_URL: 'http://secret.example', RATE_HASH_SECRET: 'short', RATE_EMAIL_LIMIT: '0' }))
    assert.throws(() => loadConfig({ ...env, [key]: value }), new RegExp(key));
});
test('HTTP contract: health, CORS, methods, malformed body, keys, encoding and size', async () => {
  await serve({ env }, async url => {
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
    assert.equal((await fetch(`${url}/missing`)).status, 404);
    assert.equal((await fetch(`${url}/api/v1/leads`)).status, 405);
    assert.equal((await post(url, base, { Origin: 'https://evil.example' })).status, 403);
    const pre = await fetch(`${url}/api/v1/leads`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
    assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal((await post(url, base, { 'Idempotency-Key': 'bad' })).status, 400);
    assert.equal((await post(url, base, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(url, base, { 'Content-Encoding': 'gzip' })).status, 415);
    const malformed = await fetch(`${url}/api/v1/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.equal((await post(url, { ...base, message: 'x'.repeat(MAX_BODY_BYTES) })).status, 413);
    // No Content-Length: enforce the streaming byte limit as well.
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(`${url}/api/v1/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.write('x'.repeat(MAX_BODY_BYTES + 1)); req.end();
    });
    assert.equal(status, 413);
  });
});
test('Vercel pre-parsed bodies also enforce limits', async () => {
  const handler = createHandler({ env });
  const server = createServer((req, res) => handler(Object.assign(req, { body: { ...base, message: 'x'.repeat(MAX_BODY_BYTES) } }), res));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  try { assert.equal((await post(`http://127.0.0.1:${address.port}`)).status, 413); }
  finally { server.closeAllConnections(); server.close(); }
});
test('honeypot rejects honestly even in development', async () => {
  await serve({ env }, async url => { const res = await post(url, { ...base, website: 'spam' }); assert.equal(res.status, 422); assert.equal((await res.json()).error.code, 'SPAM_REJECTED'); });
});
test('managed protection checks shared throttle, hostname and action; fails closed', async () => {
  for (const challenge of [{ success: true, hostname: 'example.com', action: 'lead' }, { success: false }, { success: true, hostname: 'evil.example', action: 'lead' }, { success: true, hostname: 'example.com', action: 'other' }]) {
    const fetchImpl: typeof fetch = async url => String(url).includes('redis') ? Response.json({ result: [1, 600] }) : String(url).includes('siteverify') ? Response.json(challenge) : receipt();
    await serve({ env: managed, fetchImpl }, async url => {
      assert.equal((await post(url, { ...base, turnstileToken: 'fake-token' })).status, challenge.success && challenge.hostname === 'example.com' && challenge.action === 'lead' ? 202 : 422);
    });
  }
  for (const fetchImpl of [async () => { throw new Error('secret'); }, async () => Response.json({ result: 'invalid' }), async () => new Response('', { status: 500 })])
    await serve({ env: managed, fetchImpl }, async url => assert.equal((await post(url)).status, 503));
  await serve({ env: { ...managed, TURNSTILE_SECRET_KEY: '' } }, async url => assert.equal((await post(url)).status, 503));
});
test('missing challenge, challenge service outage and provider conflict have honest HTTP errors', async () => {
  await serve({ env: managed, fetchImpl: async () => Response.json({ result: [1, 600] }) }, async url => {
    const res = await post(url); assert.equal(res.status, 422); assert.equal((await res.json()).error.code, 'CHALLENGE_REQUIRED');
  });
  await serve({ env: managed, fetchImpl: async url => {
    if (String(url).includes('redis')) return Response.json({ result: [1, 600] });
    throw new DOMException('Timed out', 'TimeoutError');
  } }, async url => assert.equal((await post(url, { ...base, turnstileToken: 'token' })).status, 503));
  await serve({ env: configured, fetchImpl: async () => new Response('', { status: 409 }) }, async url => {
    const res = await post(url); assert.equal(res.status, 409); assert.equal((await res.json()).error.code, 'IDEMPOTENCY_CONFLICT');
  });
});
test('global and per-email throttling return 429 with Retry-After across adapter instances', async () => {
  for (const target of ['global', 'email:']) {
    const counts = new Map<string, number>();
    const c = loadConfig({ ...managed, RATE_GLOBAL_LIMIT: target === 'global' ? '1' : '100', RATE_EMAIL_LIMIT: '1' });
    const fetchImpl: typeof fetch = async (url, init) => {
      if (!String(url).includes('redis')) return Response.json({ success: true, hostname: 'example.com', action: 'lead' });
      const command = JSON.parse(String(init?.body)); const key = String(command[3]);
      assert.equal(command[0], 'EVAL'); assert.equal(command[4], '600'); assert.ok(!key.includes(base.email));
      const count = (counts.get(key) ?? 0) + 1; counts.set(key, count); return Response.json({ result: [count, 37] });
    };
    const s = submissionSchema.parse({ ...base, turnstileToken: 'token' });
    const first = createAbuseProtection(c, fetchImpl); await first.beforeBody(); await first.check(s);
    const second = createAbuseProtection(c, fetchImpl);
    await assert.rejects(async () => { await second.beforeBody(); await second.check(s); }, { status: 429, retryAfter: 37 });
    await serve({ config: c, fetchImpl }, async url => { const res = await post(url, { ...base, turnstileToken: 'token' }); assert.equal(res.status, 429); assert.equal(res.headers.get('retry-after'), '37'); });
  }
});
