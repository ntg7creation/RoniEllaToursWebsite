import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { languages } from '../src/i18n/languages.js';

const directory = new URL('../src/locales/en/', import.meta.url);
const TTL = 24 * 60 * 60 * 1000;
const MAX_BODY = 4096;
const tokens = text => (text.match(/\{\w+\}/g) || []).sort().join('|');
function prepareTemplate(text) {
  const placeholders = [];
  // Numeric tokens cannot themselves be translated as words (e.g. {field}).
  const source = text.replace(/\{\w+\}/g, token => `{${placeholders.push(token) - 1}}`);
  return { source, restore: value => value.replace(/\{(\d+)\}/g, (token, index) => placeholders[index] || token) };
}
function decodeText(text) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0' };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, code) => {
    if (code[0] !== '#') return entities[code.toLowerCase()] || match;
    const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
  });
}

async function loadCatalogs() {
  const files = (await readdir(directory)).filter(name => name.endsWith('.json'));
  return Object.fromEntries(await Promise.all(files.map(async name => [name.slice(0, -5), JSON.parse(await readFile(new URL(name, directory), 'utf8'))])));
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY) throw new Error('Body too large');
  }
  return JSON.parse(body);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

// Only known, public English website copy can be translated. Never accept user
// text, credentials or form values from the browser as translation input.
export function createTranslationHandler({ env = process.env, fetchImpl = fetch, readCatalogs = loadCatalogs, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  let inFlight = 0;
  async function translatePage(language, copy) {
    const hash = createHash('sha256').update(JSON.stringify(copy)).digest('hex');
    const key = `${language}:${hash}`;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.copy;
    if (pending.has(key)) return pending.get(key);
    const work = (async () => {
      const entries = Object.entries(copy);
      const output = {};
      // Keep batches comfortably below Google's character and 128-string limits.
      for (let offset = 0; offset < entries.length;) {
        const batch = [];
        let length = 0;
        while (offset < entries.length && batch.length < 100 && (!batch.length || length + entries[offset][1].length < 4500)) {
          batch.push(entries[offset]);
          length += entries[offset++][1].length;
        }
        const templates = batch.map(([, value]) => prepareTemplate(value));
        const response = await fetchImpl('https://translation.googleapis.com/language/translate/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': env.GOOGLE_TRANSLATE_API_KEY },
          body: JSON.stringify({ q: templates.map(item => item.source), source: 'en', target: language, format: 'text' }),
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error('Provider unavailable');
        const result = await response.json();
        const values = result.data?.translations;
        if (!Array.isArray(values) || values.length !== batch.length) throw new Error('Invalid provider response');
        batch.forEach(([id, source], index) => {
          const raw = values[index]?.translatedText;
          if (typeof raw !== 'string') throw new Error('Invalid translation');
          const decoded = decodeText(raw);
          if (tokens(decoded) !== tokens(templates[index].source)) throw new Error('Missing interpolation token');
          const value = templates[index].restore(decoded);
          if (!value.trim() || tokens(value) !== tokens(source)) throw new Error('Incomplete translation');
          output[id] = value;
        });
      }
      // Bounded process-local cache; English edits invalidate entries by hash.
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(key, { copy: output, expires: now() + TTL });
      return output;
    })();
    pending.set(key, work);
    try { return await work; } finally { pending.delete(key); }
  }

  return async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { code: 'METHOD_NOT_ALLOWED' });
    }
    let body;
    try {
      if (Number(req.headers?.['content-length']) > MAX_BODY) throw new Error('Body too large');
      body = await readBody(req);
      if (!body || Object.keys(body).some(key => !['language', 'namespaces'].includes(key))) throw new Error('Invalid request');
      if (!languages.some(item => item.code === body.language && !['en', 'he'].includes(item.code))) throw new Error('Unsupported language');
      if (!Array.isArray(body.namespaces) || !body.namespaces.length || body.namespaces.length > 32 || body.namespaces.some(name => typeof name !== 'string' || !/^[a-z0-9-]+$/.test(name))) throw new Error('Invalid pages');
    } catch { return send(res, 400, { code: 'INVALID_REQUEST' }); }
    if (!env.GOOGLE_TRANSLATE_API_KEY) return send(res, 503, { code: 'NOT_CONFIGURED' });
    if (inFlight >= 8) return send(res, 429, { code: 'BUSY' });
    inFlight++;
    try {
      const catalogs = await readCatalogs();
      if (body.namespaces.some(name => !Object.hasOwn(catalogs, name))) return send(res, 400, { code: 'UNKNOWN_PAGE' });
      const pages = await Promise.all([...new Set(body.namespaces)].map(name => translatePage(body.language, catalogs[name])));
      return send(res, 200, { language: body.language, source: 'en', automatic: true, copy: Object.assign({}, ...pages) });
    } catch {
      return send(res, 502, { code: 'TRANSLATION_UNAVAILABLE' });
    } finally { inFlight--; }
  };
}

export default createTranslationHandler();
