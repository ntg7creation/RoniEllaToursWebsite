import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { GallerySchema, type GalleryPhoto } from "../shared/src/site-content.js";
import { parsePublicAlbum, jpegDimensions } from "../back/src/google-photos.js";

const directory = new URL("../back/content/", import.meta.url);
const configuration = GallerySchema.parse(JSON.parse(await readFile(new URL("gallery.json", directory), "utf8")));
const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" };
async function getBytes(url: string, limit: number, album = false): Promise<Uint8Array> {
  for (let redirect = 0; redirect < 5; redirect++) {
    const response = await fetch(url, { headers: { ...headers, Accept: album ? "text/html" : "image/jpeg" }, redirect: "manual", signal: AbortSignal.timeout(30000) });
    if (response.status >= 300 && response.status < 400) {
      const next = new URL(response.headers.get("location") ?? "", url);
      await response.body?.cancel();
      if (!album || next.protocol !== "https:" || !["photos.app.goo.gl", "photos.google.com"].includes(next.hostname) || next.port || next.username || next.password)
        throw Error("Unexpected album redirect");
      url = next.href; continue;
    }
    if (!response.ok || !response.body) throw Error(`Album download failed (${response.status})`);
    if (!(album ? /^text\/html/i : /^image\/jpeg/i).test(response.headers.get("content-type") ?? "")) {
      await response.body.cancel(); throw Error("Unexpected album response type");
    }
    const chunks: Uint8Array[] = []; let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > limit) { throw Error("Album response exceeds import size limit"); }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw Error("Too many album redirects");
}
const album = parsePublicAlbum(Buffer.from(await getBytes(configuration.albumUrl, 8_000_000, true)).toString("utf8"));
await mkdir(new URL("media/", directory), { recursive: true });
const photos: GalleryPhoto[] = new Array(album.photos.length);
let cursor = 0, completed = 0, totalBytes = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < album.photos.length) {
    const index = cursor++, source = album.photos[index]!;
    const id = `album-${createHash("sha256").update(source.sourceId).digest("hex").slice(0,20)}`;
    const variants = [];
    let largest = { width: 0, height: 0, src: "" };
    for (const edge of [480, 1600]) {
      const bytes = await getBytes(`${source.url}=w${edge}-h${edge}`, 10_000_000);
      const dimensions = jpegDimensions(bytes);
      if (Math.max(dimensions.width, dimensions.height) > edge) throw Error("Image service ignored resize bounds");
      const digest = createHash("sha256").update(bytes).digest("hex").slice(0,12);
      const filename = `${id}-${edge}-${digest}.jpg`, src = `/media/${filename}`;
      await writeFile(new URL(`media/${filename}`, directory), bytes);
      variants.push({ src, width: dimensions.width });
      if (dimensions.width > largest.width) largest = { ...dimensions, src };
      totalBytes += bytes.length;
    }
    const previous = configuration.photos.find(photo => photo.id === id);
    photos[index] = { id, ...largest, alt: previous?.alt ?? `${configuration.photoAltPrefix} · ${index + 1}`, variants };
    if (++completed % 20 === 0 || completed === album.photos.length) console.log(`Cached ${completed}/${album.photos.length} album photos`);
  }
}));
const updated = GallerySchema.parse({ ...configuration, photos, albumTitle: album.title, syncedAt: new Date().toISOString() });
// Publish the manifest only after every download validates. Existing content remains usable on failure.
const temporary = new URL("gallery.json.tmp", directory);
await writeFile(temporary, JSON.stringify(updated, null, 2) + "\n", "utf8");
await rename(temporary, new URL("gallery.json", directory));
console.log(`Gallery ready: ${photos.length} photos, ${Math.round(totalBytes / 1024 / 1024)} MB. Restart the API (automatic in dev).`);
