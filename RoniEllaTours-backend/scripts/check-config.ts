import { loadConfig, ConfigurationError } from '../src/config.js';
try {
  const c = loadConfig(process.env);
  const missing: string[] = [];
  if (c.EMAIL_PROVIDER === 'resend') for (const key of ['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_TO'] as const) if (!c[key]) missing.push(key);
  if (c.ABUSE_MODE === 'managed') for (const key of ['TURNSTILE_SECRET_KEY', 'TURNSTILE_HOSTNAMES', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RATE_HASH_SECRET'] as const) if (!c[key]) missing.push(key);
  if (missing.length) throw new ConfigurationError(`Missing settings: ${missing.join(', ')}`);
  console.info(`Configuration valid (${c.EMAIL_PROVIDER}, ${c.ABUSE_MODE}). Credentials have not been tested.`);
} catch (error) {
  console.error(error instanceof ConfigurationError ? error.message : 'Configuration check failed.');
  process.exitCode = 1;
}
