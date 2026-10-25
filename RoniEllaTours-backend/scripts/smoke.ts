import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';

// Run the built local entrypoint with no external services or credentials.
const probe = createServer();
await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
const address = probe.address(); assert.ok(address && typeof address === 'object');
const port = address.port;
await new Promise<void>(resolve => probe.close(() => resolve()));
const child = spawn(process.execPath, ['dist/src/server.js'], { env: { ...process.env, NODE_ENV: 'test', VERCEL: '', EMAIL_PROVIDER: 'local', ABUSE_MODE: 'disabled', PORT: String(port), ALLOWED_ORIGINS: '', RESEND_API_KEY: '', EMAIL_FROM: '', EMAIL_TO: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Startup timed out')), 10000);
    child.once('error', reject);
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited before startup')); });
    child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
  });
  const url = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
  const result = await fetch(`${url}/api/v1/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ type: 'contact', name: 'Local Test', email: 'test@example.com', phone: '+972501234567', consent: { privacy: true }, source: { page: '/contact', locale: 'en' } }) });
  assert.equal(result.status, 200); assert.equal((await result.json()).status, 'local_simulation');
  console.info('Smoke passed: built server health and local enquiry; no email sent.');
} finally {
  child.kill();
  await new Promise<void>(resolve => child.once('exit', () => resolve()));
}
