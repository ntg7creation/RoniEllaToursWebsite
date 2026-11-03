import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { LocalContentRepository, defaultContentDirectory } from "../src/content-repository.js";
import { createApp } from "../src/app.js";

test("local files are authoritative, reloadable and validated without the source archive", async () => {
  const directory = await mkdtemp(join(tmpdir(), "roniella-content-"));
  try {
    await cp(defaultContentDirectory, directory, { recursive: true });
    const url = pathToFileURL(directory + "/");
    const homePath = join(directory, "pages/home.json");
    const home = JSON.parse(await readFile(homePath, "utf8"));
    home.title = "Edited from local JSON";
    await writeFile(homePath, JSON.stringify(home));
    const content = await (await LocalContentRepository.load(url)).getPublicContent();
    assert.equal(content.pages.find(page => page.path === "/")?.title, home.title);
    assert.equal(content.pages.find(page => page.path === "/tours/uzbekistan-april-2027/")?.blocks.filter(block => block.type === "heading" && /^יום \d/.test(block.text)).length, 9);
    home.heroMediaId = "missing-image";
    await writeFile(homePath, JSON.stringify(home));
    await assert.rejects(LocalContentRepository.load(url), /Unknown page media reference/);
    const manifestPath = join(directory, "index.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.pages[0].file = "../../outside.json";
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(LocalContentRepository.load(url), /regex|pattern|format/i);
  } finally {
    assert.ok(directory.startsWith(join(tmpdir(), "roniella-content-")));
    await rm(directory, { recursive: true });
  }
});

test("media API exposes only registered photos, never content JSON or arbitrary paths", async () => {
  const repository = await LocalContentRepository.load();
  const content = await repository.getPublicContent();
  const server = createApp(repository).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const filename = content.media[0]!.variants[0]!.src.split("/").at(-1)!;
    const image = await fetch(`${origin}/api/v1/media/${filename}`);
    assert.equal(image.status, 200); assert.match(image.headers.get("content-type")!, /^image\/jpeg/);
    assert.ok((await image.arrayBuffer()).byteLength > 1000);
    for (const file of ["index.json", "media.json", "credits.json", "missing.jpg", "..%2Findex.json"])
      assert.equal((await fetch(`${origin}/api/v1/media/${file}`)).status, 404);
    assert.equal((await fetch(`${origin}/api/v1/media/${filename}`, { method: "POST" })).status, 404);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
