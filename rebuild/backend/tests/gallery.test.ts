import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePublicAlbum, jpegDimensions } from "../src/google-photos.js";
import { LocalContentRepository } from "../src/content-repository.js";
import { GallerySchema } from "../../shared/src/site-content.js";
import { selectGalleryPhotos } from "../../frontend/app/server/gallery.server.js";

function albumPage({ host = "lh3.googleusercontent.com", count = 1, continuation = "", type = 2 } = {}) {
  const metadata = Array(22).fill(null); metadata[1] = "Test album"; metadata[21] = count;
  const item = ["photo-one", [`https://${host}/pw/test`, 1200, 1600], null, null, null, null, null, null, type];
  return `AF_initDataCallback({key: 'ds:1', hash: '2', data:${JSON.stringify([null,[item],continuation,metadata])}, sideChannel: {}});`;
}
test("public album parser reads data without executing page JavaScript and rejects incomplete or unsafe imports", () => {
  const parsed = parsePublicAlbum(albumPage() + "<script>throw new Error('never execute')</script>");
  assert.equal(parsed.title, "Test album"); assert.equal(parsed.photos.length, 1);
  assert.deepEqual(parsed.photos[0], { sourceId: "photo-one", url: "https://lh3.googleusercontent.com/pw/test", width: 1200, height: 1600 });
  assert.throws(() => parsePublicAlbum("<html>Sign in</html>"), /unavailable/);
  assert.throws(() => parsePublicAlbum(albumPage({ count: 2 })), /incomplete/);
  assert.throws(() => parsePublicAlbum(albumPage({ continuation: "next-page" })), /incomplete/);
  assert.throws(() => parsePublicAlbum(albumPage({ host: "example.com" })), /host/);
  assert.throws(() => parsePublicAlbum(albumPage({ type: 3 })), /still photos/);
});
test("JPEG dimensions use actual frame size and reject HTML, truncated and malformed files", () => {
  const jpeg = Buffer.from([0xff,0xd8,0xff,0xc0,0,8,8,0x06,0x40,0x04,0xb0,3,0xff,0xd9]);
  assert.deepEqual(jpegDimensions(jpeg), { width: 1200, height: 1600 });
  assert.throws(() => jpegDimensions(Buffer.from("<html>error</html>")), /JPEG/);
  assert.throws(() => jpegDimensions(jpeg.subarray(0,8)), /segment/);
});
test("cached album is independent of Google at runtime, validated, and shuffling preserves originals and unique photos", async () => {
  const repository = await LocalContentRepository.load();
  const content = await repository.getPublicContent(), gallery = content.gallery!;
  assert.ok(gallery.photos.length >= gallery.displayCount);
  assert.ok(gallery.syncedAt);
  const original = gallery.photos.map(photo => photo.id);
  const sample = selectGalleryPhotos(gallery.photos, gallery.displayCount, () => 0);
  assert.equal(sample.length, gallery.displayCount);
  assert.equal(new Set(sample.map(photo => photo.id)).size, sample.length);
  assert.deepEqual(gallery.photos.map(photo => photo.id), original);
  for (const photo of gallery.photos) {
    for (const src of [photo.src, ...photo.variants.map(variant => variant.src)])
      assert.ok(await repository.getMedia(src.split("/").at(-1)!));
    assert.ok(Math.max(photo.width, photo.height) <= 1600);
  }
  assert.equal(GallerySchema.safeParse({ ...gallery, albumUrl: "https://example.com/album" }).success, false);
  assert.equal(GallerySchema.safeParse({ ...gallery, photos: [sample[0], sample[0]] }).success, false);
  assert.equal(GallerySchema.safeParse({ ...gallery, photos: [{ ...sample[0], src: "/media/../../secrets.json" }] }).success, false);
});
