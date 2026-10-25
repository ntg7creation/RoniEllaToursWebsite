import { z } from 'zod';
import { address } from './validation.js';

const integer = (fallback: number, max: number) => z.coerce.number().int().min(1).max(max).default(fallback);
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  VERCEL: z.string().optional(),
  EMAIL_PROVIDER: z.enum(['resend', 'local']).default('resend'),
  ABUSE_MODE: z.enum(['managed', 'disabled']).default('managed'),
  PORT: integer(3001, 65535),
  ALLOWED_ORIGINS: z.string().default(''),
  RESEND_API_KEY: z.string().default(''), EMAIL_FROM: z.string().default(''), EMAIL_TO: z.string().default(''),
  TURNSTILE_SECRET_KEY: z.string().default(''), TURNSTILE_HOSTNAMES: z.string().default(''),
  UPSTASH_REDIS_REST_URL: z.string().default(''), UPSTASH_REDIS_REST_TOKEN: z.string().default(''),
  RATE_HASH_SECRET: z.string().default(''), RATE_NAMESPACE: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/).default('roniella'),
  RATE_WINDOW_SECONDS: integer(600, 86400), RATE_GLOBAL_LIMIT: integer(100, 100000), RATE_EMAIL_LIMIT: integer(5, 10000),
});
export type Config = z.infer<typeof schema> & { origins: string[]; hostnames: string[] };
export class ConfigurationError extends Error {}
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const result = schema.safeParse(env);
  if (!result.success) throw new ConfigurationError(`Invalid settings: ${[...new Set(result.error.issues.map(i => i.path[0]))].join(', ')}`);
  const c = result.data;
  const localAllowed = ['development', 'test'].includes(c.NODE_ENV) && !c.VERCEL;
  if (!localAllowed && (c.EMAIL_PROVIDER === 'local' || c.ABUSE_MODE === 'disabled'))
    throw new ConfigurationError('Local email and disabled abuse checks are forbidden in production and on Vercel.');
  for (const key of ['EMAIL_FROM', 'EMAIL_TO'] as const)
    if (c[key] && !address.safeParse(c[key]).success) throw new ConfigurationError(`${key} must be one bare email address.`);
  const origins = c.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  for (const origin of origins) {
    let valid = false;
    try { const u = new URL(origin); valid = u.origin === origin && ['http:', 'https:'].includes(u.protocol); } catch { /* invalid */ }
    if (!valid) throw new ConfigurationError('ALLOWED_ORIGINS must contain exact http(s) origins without paths or wildcards.');
  }
  if (c.UPSTASH_REDIS_REST_URL) {
    try {
      const u = new URL(c.UPSTASH_REDIS_REST_URL);
      if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error();
    } catch { throw new ConfigurationError('UPSTASH_REDIS_REST_URL must be an HTTPS origin.'); }
  }
  if (c.RATE_HASH_SECRET && c.RATE_HASH_SECRET.length < 32) throw new ConfigurationError('RATE_HASH_SECRET needs at least 32 characters.');
  const hostnames = c.TURNSTILE_HOSTNAMES.split(',').map(s => s.trim()).filter(Boolean);
  if (hostnames.some(h => !/^[a-z0-9.-]+$/.test(h))) throw new ConfigurationError('TURNSTILE_HOSTNAMES must contain bare lowercase hostnames.');
  return { ...c, origins, hostnames };
}
