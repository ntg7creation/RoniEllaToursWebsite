import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTranslationHandler } from '../api/translate.js';
import { pageNamespaces } from '../src/i18n/languages.js';

const request = async (handler, body = { language: 'ru', namespaces: ['common'] }, method = 'POST') => {
  let result;
  const res = { statusCode: 200, setHeader() {}, end(text) { result = { status: this.statusCode, body: JSON.parse(text) }; } };
  await handler({ method, body, headers: {} }, res);
  return result;
};
const env = { GOOGLE_TRANSLATE_API_KEY: 'test-server-only-key' };

test('authored Hebrew/English catalogs have matching nonempty keys and placeholders', async () => {
  const files = await fs.readdir('src/locales/en');
  assert.deepEqual(files, await fs.readdir('src/locales/he'));
  for (const file of files) {
    const en = JSON.parse(await fs.readFile(`src/locales/en/${file}`, 'utf8'));
    const he = JSON.parse(await fs.readFile(`src/locales/he/${file}`, 'utf8'));
    assert.deepEqual(Object.keys(en).sort(), Object.keys(he).sort(), file);
    for (const key of Object.keys(en)) {
      assert.ok(en[key].trim() && he[key].trim(), key);
      assert.ok(!/[\u0590-\u05ff]/.test(en[key]), `${file}: ${key}`);
      const placeholders = text => (text.match(/\{\w+\}/g) || []).sort();
      assert.deepEqual(placeholders(en[key]), placeholders(he[key]), key);
    }
  }
  const names = files.map(file => file.slice(0, -5));
  assert.ok(pageNamespaces('/tours/china-zhong-guo', names).includes('tour-china-zhong-guo'));
  assert.ok(pageNamespaces('/blog/beijing-capital', names).includes('article-beijing-capital'));
  assert.ok(pageNamespaces('/no-such-page', names).includes('not-found'));
});

test('unconfigured translation is an honest unavailable response', async () => {
  const handler = createTranslationHandler({ env: {}, fetchImpl: () => { throw new Error('Must not call provider'); } });
  assert.deepEqual(await request(handler), { status: 503, body: { code: 'NOT_CONFIGURED' } });
  assert.equal((await request(handler, undefined, 'GET')).status, 405);
});

test('only known page namespaces and configured target languages are accepted', async () => {
  let calls = 0;
  const handler = createTranslationHandler({ env, readCatalogs: async () => ({ common: {} }), fetchImpl: () => calls++ });
  for (const body of [
    { language: 'xx', namespaces: ['common'] },
    { language: 'en', namespaces: ['common'] },
    { language: 'ru', namespaces: ['../secrets'] },
    { language: 'ru', namespaces: ['unknown'] },
    { language: 'ru', namespaces: ['common'], text: 'private form data' },
    { language: 'ru', namespaces: [] },
  ]) assert.equal((await request(handler, body)).status, 400);
  assert.equal(calls, 0);
});

test('provider receives English only, uses server key, caches and invalidates when English changes', async () => {
  const copy = { 'שלום': 'Hello {name}' };
  let calls = 0;
  let clock = 100;
  const handler = createTranslationHandler({ env, now: () => clock, readCatalogs: async () => ({ common: copy }), fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://translation.googleapis.com/language/translate/v2');
    assert.equal(options.headers['X-goog-api-key'], env.GOOGLE_TRANSLATE_API_KEY);
    const body = JSON.parse(options.body);
    assert.deepEqual(body, { q: Object.values(copy).map(value => value.replace('{name}', '{0}')), source: 'en', target: 'ru', format: 'text' });
    return { ok: true, json: async () => ({ data: { translations: [{ translatedText: 'Здравствуйте, {0}' }] } }) };
  } });
  const [first, second] = await Promise.all([request(handler), request(handler)]);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, second.body);
  assert.equal(first.body.copy['שלום'], 'Здравствуйте, {name}');
  assert.equal(calls, 1);
  await request(handler);
  assert.equal(calls, 1);
  copy['שלום'] = 'Welcome {name}';
  await request(handler);
  assert.equal(calls, 2);
  clock += 24 * 60 * 60 * 1000 + 1;
  await request(handler);
  assert.equal(calls, 3);
  assert.ok(!JSON.stringify(first.body).includes(env.GOOGLE_TRANSLATE_API_KEY));
});

test('missing placeholders and provider failures fail closed and can be retried', async () => {
  let calls = 0;
  const handler = createTranslationHandler({ env, readCatalogs: async () => ({ common: { title: 'Hello {name}' } }), fetchImpl: async () => {
    calls++;
    if (calls === 1) return { ok: false };
    return { ok: true, json: async () => ({ data: { translations: [{ translatedText: calls === 2 ? 'Привет' : 'Привет, {0}' }] } }) };
  } });
  assert.equal((await request(handler)).status, 502);
  assert.equal((await request(handler)).status, 502);
  assert.equal((await request(handler)).status, 200);
});

test('large catalogs are batched within provider limits', async () => {
  const copy = Object.fromEntries(Array.from({ length: 260 }, (_, index) => [`key${index}`, `Public English sentence ${index}`]));
  let calls = 0;
  const handler = createTranslationHandler({ env, readCatalogs: async () => ({ common: copy }), fetchImpl: async (_, options) => {
    calls++;
    const { q } = JSON.parse(options.body);
    assert.ok(q.length <= 100);
    assert.ok(q.join('').length < 4500);
    return { ok: true, json: async () => ({ data: { translations: q.map(text => ({ translatedText: `Перевод: ${text}` })) } }) };
  } });
  const response = await request(handler);
  assert.equal(response.status, 200);
  assert.equal(Object.keys(response.body.copy).length, 260);
  assert.equal(calls, 3);
});

test('provider entities remain plain text and reordered named tokens are restored', async () => {
  const handler = createTranslationHandler({ env, readCatalogs: async () => ({ common: { caption: '{place} with {guide}' } }), fetchImpl: async () => ({
    ok: true, json: async () => ({ data: { translations: [{ translatedText: '{1} &amp; &#39;{0}&#39; &lt;script&gt;' }] } }),
  }) });
  const response = await request(handler);
  assert.equal(response.status, 200);
  assert.equal(response.body.copy.caption, "{guide} & '{place}' <script>");
});
