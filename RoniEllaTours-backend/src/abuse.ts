import { createHmac } from 'node:crypto';
import type { Config } from './config.js';
import type { Submission } from './validation.js';
import { HttpError } from './errors.js';

// Redis executes this atomically. TTL starts with the first hit; no process-local counters.
export const throttleScript = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {n, redis.call('TTL', KEYS[1])}
`;
export interface AbuseProtection {
  beforeBody(): Promise<void>;
  check(submission: Submission): Promise<void>;
}
export function createAbuseProtection(c: Config, fetchImpl: typeof fetch = fetch): AbuseProtection {
  function configured() {
    if (!c.UPSTASH_REDIS_REST_URL || !c.UPSTASH_REDIS_REST_TOKEN || c.RATE_HASH_SECRET.length < 32 || !c.TURNSTILE_SECRET_KEY || !c.hostnames.length)
      throw new HttpError(503, 'ABUSE_UNCONFIGURED', 'Submission protection is not configured.');
  }
  async function throttle(key: string, limit: number) {
    try {
      const response = await fetchImpl(c.UPSTASH_REDIS_REST_URL, {
        method: 'POST', signal: AbortSignal.timeout(3000),
        headers: { Authorization: `Bearer ${c.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', throttleScript, '1', `${c.RATE_NAMESPACE}:${key}`, String(c.RATE_WINDOW_SECONDS)]),
      });
      if (!response.ok) throw new Error();
      const data = await response.json() as { result?: unknown; error?: unknown };
      if (data.error || !Array.isArray(data.result) || data.result.length !== 2 || !data.result.every(x => Number.isInteger(x) && x >= 0)) throw new Error();
      const [count, ttl] = data.result as [number, number];
      if (count > limit) throw new HttpError(429, 'RATE_LIMITED', 'Too many submissions. Try again later.', Math.max(1, ttl));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'ABUSE_UNAVAILABLE', 'Submission protection is temporarily unavailable.');
    }
  }
  return {
    async beforeBody() {
      if (c.ABUSE_MODE === 'disabled') return;
      configured();
      await throttle('global', c.RATE_GLOBAL_LIMIT);
    },
    async check(s) {
      if (s.website) throw new HttpError(422, 'SPAM_REJECTED', 'Submission rejected.');
      if (c.ABUSE_MODE === 'disabled') return;
      configured();
      if (!s.turnstileToken) throw new HttpError(422, 'CHALLENGE_REQUIRED', 'Complete the anti-spam challenge.');
      await throttle(`email:${createHmac('sha256', c.RATE_HASH_SECRET).update(s.email.toLowerCase()).digest('hex')}`, c.RATE_EMAIL_LIMIT);
      try {
        const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: c.TURNSTILE_SECRET_KEY, response: s.turnstileToken }),
        });
        if (!response.ok) throw new Error();
        const data = await response.json() as { success?: unknown; hostname?: unknown; action?: unknown };
        if (data.success !== true || typeof data.hostname !== 'string' || !c.hostnames.includes(data.hostname) || data.action !== 'lead')
          throw new HttpError(422, 'CHALLENGE_REJECTED', 'Complete a new anti-spam challenge before retrying.');
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(503, 'ABUSE_UNAVAILABLE', 'Submission protection is temporarily unavailable.');
      }
    },
  };
}
