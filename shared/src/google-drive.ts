import { z } from 'zod';
export const DriveFolderUrlSchema = z.string().max(2000).regex(/^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+(?:\?usp=sharing)?$/).refine(value => !/\s/.test(value)).transform(value => value.split('?')[0]!);
export const DriveFileIdSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
export const DrivePhotoReferenceSchema = z.strictObject({ folderUrl: DriveFolderUrlSchema, fileId: DriveFileIdSchema, fileUrl: z.string().regex(/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view$/) })
  .refine(value => value.fileUrl === driveFileUrl(value.fileId), 'File link must match its ID');
export type DrivePhotoReference = z.infer<typeof DrivePhotoReferenceSchema>;
export type DrivePhoto = { sourceId: string; name: string; addedAt?: string; modifiedAt?: string; takenAt?: string; position: number };
export type DrivePhotoChoice = DrivePhoto & { id: string; thumbnail: string; alt: string };
export const driveFileUrl = (id: string) => `https://drive.google.com/file/d/${DriveFileIdSchema.parse(id)}/view`;
export const driveThumbnailUrl = (id: string, edge: number) => `https://drive.google.com/thumbnail?id=${DriveFileIdSchema.parse(id)}&sz=w${edge}`;
export function isDriveImageUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    if (/^lh\d+\.googleusercontent\.com$/.test(url.hostname)) return !url.search;
    return url.hostname === 'drive.google.com' && url.pathname === '/thumbnail' && DriveFileIdSchema.safeParse(url.searchParams.get('id')).success && /^w(?:360|480|1600)$/.test(url.searchParams.get('sz') ?? '') && [...url.searchParams.keys()].every(key => ['id', 'sz'].includes(key));
  } catch { return false; }
}
export async function fetchDriveImage(url: string, signal?: AbortSignal, transport: typeof fetch = fetch) {
  const combined = AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]);
  for (let hop = 0; hop < 5; hop++) {
    if (!isDriveImageUrl(url)) throw Error('Unexpected Drive image host');
    const response = await transport(url, { headers: { Accept: 'image/jpeg,image/png' }, redirect: 'manual', signal: combined, cache: 'no-store' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw Error('Image redirect missing'); url = new URL(location, url).href; continue;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !response.body || !/^image\/(?:jpeg|png|webp|avif)(?:;|$)/.test(contentType)) { await response.body?.cancel(); throw Error('Drive image is unavailable'); }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 4000000) throw Error('Image too large'); chunks.push(value); } } finally { await reader.cancel(); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { bytes, contentType };
  }
  throw Error('Too many image redirects');
}
const timestamp = (value: unknown) => typeof value === 'number' && value > 0 && value < 4102444800000 ? new Date(value).toISOString() : undefined;
const entities = (text: string) => text.replace(/&(?:amp|lt|gt|quot|#39|#\d+|#x[0-9a-f]+);/gi, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[entity] ?? String.fromCodePoint(parseInt(entity.slice(entity.startsWith('&#x') ? 3 : 2, -1), entity.startsWith('&#x') ? 16 : 10))));
export function parsePublicDriveFolder(html: string, folderUrl: string): { title: string; photos: DrivePhoto[] } {
  const folderId = DriveFolderUrlSchema.parse(folderUrl).split('/').at(-1)!;
  const match = /window\['_DRIVE_ivd'\]\s*=\s*'((?:\\.|[^'\\])*)'/.exec(html);
  if (!match) throw Error('Public Drive folder data is unavailable');
  // Decode only string escapes and JSON. Never execute Google's page scripts.
  const decoded = match[1]!.replace(/\\x([a-f0-9]{2})|\\u([a-f0-9]{4})|\\([\\'"\/nrt])/gi, (_m, hex: string, unicode: string, simple: string) => hex || unicode ? String.fromCharCode(parseInt(hex || unicode, 16)) : ({ n: '\n', r: '\r', t: '\t' }[simple] ?? simple));
  const data: unknown = JSON.parse(decoded);
  if (!Array.isArray(data) || !Array.isArray(data[0]) || data[1] || data[0].length > 2000) throw Error('Drive folder is incomplete or paginated');
  const seen = new Set<string>();
  const photos: DrivePhoto[] = [];
  for (const [position, item] of data[0].entries()) {
    if (!Array.isArray(item) || !DriveFileIdSchema.safeParse(item[0]).success || !Array.isArray(item[1]) || !item[1].includes(folderId) || typeof item[2] !== 'string' || typeof item[3] !== 'string') throw Error('Unrecognized Drive file');
    if (!/^image\/(?:jpeg|png|webp|avif|heic|heif|gif|bmp|tiff)$/.test(item[3])) continue;
    if (seen.has(item[0])) throw Error('Duplicate Drive file'); seen.add(item[0]);
    const addedAt = timestamp(item[9]), modifiedAt = timestamp(item[10]);
    photos.push({ sourceId: item[0], name: item[2], position, ...(addedAt ? { addedAt } : {}), ...(modifiedAt ? { modifiedAt } : {}) });
  }
  const title = entities(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? 'תמונות האתר').replace(/\s*[–-]\s*Google Drive$/, '').replace(/[\u202a-\u202e]/g, '').trim();
  return { title, photos };
}
export class PublicDriveFolderReader {
  private cached = new Map<string, { expires: number; value: { title: string; photos: DrivePhoto[] } }>();
  private pending = new Map<string, Promise<{ title: string; photos: DrivePhoto[] }>>();
  constructor(private transport: typeof fetch = fetch, private now = Date.now) {}
  async read(input: string, fresh = false) {
    const folderUrl = DriveFolderUrlSchema.parse(input), cached = this.cached.get(folderUrl);
    if (!fresh && cached && cached.expires > this.now()) return cached.value;
    const pending = this.pending.get(folderUrl); if (pending) return pending;
    const task = this.download(folderUrl).then(value => { if (this.cached.size >= 16) this.cached.delete(this.cached.keys().next().value!); this.cached.set(folderUrl, { value, expires: this.now() + 60000 }); return value; }).finally(() => this.pending.delete(folderUrl));
    this.pending.set(folderUrl, task); return task;
  }
  private async download(url: string) {
    const response = await this.transport(url, { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' }, redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!response.ok || !response.body || !/^text\/html/i.test(response.headers.get('content-type') ?? '')) { await response.body?.cancel(); throw Error('Drive folder is unavailable'); }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8000000) throw Error('Folder response too large'); chunks.push(value); } } finally { await reader.cancel(); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return parsePublicDriveFolder(new TextDecoder().decode(bytes), url);
  }
}
export function orderDrivePhotos<T extends { addedAt?: string; takenAt?: string; modifiedAt?: string; position: number; name?: string }>(photos: T[], order: string): T[] {
  if (order === 'name') return [...photos].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'he'));
  if (order === 'album') return [...photos].sort((a, b) => a.position - b.position);
  const field = order.startsWith('taken') ? 'takenAt' : order.startsWith('modified') ? 'modifiedAt' : 'addedAt', direction = order.endsWith('oldest') ? 1 : -1;
  return [...photos].sort((a, b) => !a[field] ? !b[field] ? a.position - b.position : 1 : !b[field] ? -1 : direction * a[field]!.localeCompare(b[field]!) || a.position - b.position);
}
