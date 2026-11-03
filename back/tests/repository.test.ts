import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseSiteContent } from "@roniella/shared/site-content";
import { archiveRedirectLocation } from "@roniella/shared/archive-urls";
import {
  LocalContentRepository,
  type ContentRepository,
} from "../src/content-repository.js";
import { createApp } from "../src/app.js";
import { ArchiveContentRepository } from "../src/archive-repository.js";

test("default repository serves real archived pages through a validated public projection", async () => {
  const content = await (
    await LocalContentRepository.load()
  ).getPublicContent();
  assert.equal(content.contentSource, "liveArchive");
  assert.equal(content.schemaVersion, 2);
  assert.equal(content.pages.length, 40);
  assert.equal(content.pages.filter((p) => p.pageType === "tour").length, 6);
  assert.equal(
    content.pages.filter((p) => p.pageType === "article").length,
    15,
  );
  const china = content.pages.find((p) => p.path === "/tours/china-may-2027/")!;
  assert.ok(china.title.includes("מאי 2027"));
  assert.ok(
    china.blocks.some(
      (b) => b.type === "heading" && b.text.startsWith("היום הראשון"),
    ),
  );
  assert.ok(!content.pages.some((p) => p.path.includes("demo")));
  const response = JSON.stringify(content);
  assert.doesNotMatch(
    response,
    /privateToken|settingsRaw|snapshotPath|httpHeaders|rawText|formsDocumentation|guide-noa|guide-daniel/,
  );
  assert.equal(content.siteSettings.contact.email, "roniellatours@gmail.com");
  for (const page of content.pages)
    assert.ok(page.path === "/" || /^[a-z0-9/-]+$/.test(page.path));
  assert.deepEqual(parseSiteContent(content), content);
  const broken = structuredClone(content);
  broken.pages[1]!.path = broken.pages[0]!.path;
  assert.throws(() => parseSiteContent(broken), /collision|Canonical|slug/);
  const badReference = structuredClone(content);
  badReference.pages[0]!.cards.push({ pageId: "missing", summary: "" });
  assert.throws(() => parseSiteContent(badReference), /Unknown card page/);
});
test("archive startup rejects malformed data, missing pages and unsafe file references", async () => {
  const directory = await mkdtemp(join(tmpdir(), "roniella-archive-"));
  const url = pathToFileURL(directory + "/");
  try {
    await writeFile(join(directory, "manifest.txt"), "{bad json");
    await assert.rejects(
      ArchiveContentRepository.load(url),
      /Cannot read archive manifest/,
    );
    await writeFile(
      join(directory, "manifest.txt"),
      JSON.stringify({ schemaVersion: 99 }),
    );
    await assert.rejects(
      ArchiveContentRepository.load(url),
      /manifest validation failed/,
    );
    const manifest = JSON.parse(
      await readFile(
        new URL(
          "../../docs/live-site-content/manifest.txt",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    manifest.pages = manifest.pages
      .filter((p: { httpStatus: number }) => p.httpStatus === 200)
      .slice(0, 1);
    manifest.pages[0].file = "../../outside.txt";
    await writeFile(join(directory, "manifest.txt"), JSON.stringify(manifest));
    await assert.rejects(
      ArchiveContentRepository.load(url),
      /Unsafe archive page file/,
    );
    manifest.pages[0].file = `pages/${manifest.pages[0].pageId}.txt`;
    await writeFile(join(directory, "manifest.txt"), JSON.stringify(manifest));
    await assert.rejects(
      ArchiveContentRepository.load(url),
      /Cannot read archive pages/,
    );
    await mkdir(join(directory, "pages"));
    await writeFile(
      join(directory, manifest.pages[0].file),
      JSON.stringify({ schemaVersion: 1, pageId: manifest.pages[0].pageId }),
    );
    await assert.rejects(
      ArchiveContentRepository.load(url),
      /Archive page .* failed validation/,
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});
test("legacy aliases go straight to existing archived destinations, including public query aliases", async () => {
  const c = await (await LocalContentRepository.load()).getPublicContent();
  for (const rule of c.redirects) {
    assert.ok(c.pages.some((p) => p.path === rule.toPath));
    const url = new URL(rule.fromPath, "https://example.test");
    for (const [k, v] of Object.entries(rule.fromQuery))
      url.searchParams.set(k, v);
    url.searchParams.set("utm_source", "test");
    const location = archiveRedirectLocation(url, c.redirects)!;
    assert.ok(location.startsWith(rule.toPath));
    assert.equal(new URL(location, url).searchParams.get("utm_source"), "test");
    assert.equal(
      archiveRedirectLocation(new URL(location, url), c.redirects),
      null,
      "Redirect loop/chain",
    );
  }
  assert.equal(
    archiveRedirectLocation(
      new URL("https://example.test/הטיולים-שלנו/לא-קיים/"),
      c.redirects,
    ),
    null,
  );
});
test("API returns only public read-only archive content and sanitized JSON failures", async () => {
  const real = await LocalContentRepository.load();
  let fail = false;
  const repository: ContentRepository = {
    getPublicContent: async () => {
      if (fail) throw Error("private stack and secrets");
      return real.getPublicContent();
    },
  };
  const server = createApp(repository).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${origin}/health`)).status, 200);
    const response = await fetch(`${origin}/api/v1/content`);
    const content = parseSiteContent(await response.json());
    assert.equal(content.contentSource, "liveArchive");
    for (const method of ["POST", "PUT", "PATCH", "DELETE"])
      assert.equal(
        (await fetch(`${origin}/api/v1/content`, { method })).status,
        404,
      );
    fail = true;
    const failed = await fetch(`${origin}/api/v1/content`);
    assert.equal(failed.status, 500);
    assert.doesNotMatch(await failed.text(), /private stack|secrets|Error:/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
