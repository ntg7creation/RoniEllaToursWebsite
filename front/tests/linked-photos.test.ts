import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from '../app/routes/media.js';
const filename = 'drive-' + 'a'.repeat(32) + '-1600.jpg';
const args = { request: new Request('http://localhost:5173/media/' + filename), params: { filename } } as unknown as Parameters<typeof loader>[0];
test('linked photo delivery fetches Google without backend credentials and rejects unsafe or oversized responses', async () => {
  const original = globalThis.fetch;
  try {
    const calls: { input: string; headers: Headers }[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), headers: new Headers(init?.headers) });
      return calls.length === 1 ? new Response(null, { status: 307, headers: { Location: 'https://lh3.googleusercontent.com/photo=w1600-h1600' } }) : new Response(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } });
    };
    const response = await loader(args); assert.equal(response.status, 200);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [255, 216, 255]);
    assert.equal(calls[1]!.headers.get('authorization'), null); assert.equal(calls[1]!.headers.get('x-vercel-protection-bypass'), null);
    globalThis.fetch = async () => new Response(null, { status: 307, headers: { Location: 'https://evil.test/image.jpg' } });
    assert.equal((await loader(args)).status, 503);
    let count = 0; globalThis.fetch = async () => ++count === 1 ? new Response(null, { status: 307, headers: { Location: 'https://lh3.googleusercontent.com/photo' } }) : new Response(new Uint8Array(4000001), { headers: { 'Content-Type': 'image/jpeg' } });
    assert.equal((await loader(args)).status, 503);
  } finally { globalThis.fetch = original; }
});
