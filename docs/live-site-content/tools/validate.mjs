import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { load } from "cheerio";
import { safePath, readJson, hash, urlKey } from "./common.mjs";
import { ManifestSchema, validateRecord } from "./schema.mjs";
export function unique(records, field) {
  const seen = new Set();
  for (const r of records) {
    if (r[field] === null) continue;
    assert.ok(!seen.has(r[field]), `Duplicate ${field}: ${r[field]}`);
    seen.add(r[field]);
  }
}
export async function validateArchive(base = "") {
  const manifest = await readJson(`${base}manifest.txt`);
  ManifestSchema.parse(manifest);
  unique(manifest.pages, "pageId");
  unique(manifest.pages, "publicPath");
  unique(manifest.urls, "requestedUrl");
  const records = [];
  const ids = new Set(manifest.pages.map((p) => p.pageId));
  for (const row of manifest.pages) {
    assert.match(
      row.file,
      new RegExp(`^(?:staging/[a-zA-Z0-9-]+/)?pages/${row.pageId}\\.txt$`),
    );
    const record = await readJson(row.file);
    validateRecord(record);
    assert.equal(record.pageId, row.pageId);
    assert.equal(record.publicPath, row.publicPath);
    assert.equal(record.finalUrl, row.finalUrl);
    assert.equal(
      record.publicSlug,
      record.publicPath && record.publicPath !== "/"
        ? record.publicPath.split("/").filter(Boolean).at(-1)
        : null,
      "Saved slug/path mismatch",
    );
    if (record.httpStatus === 200) {
      assert.ok(record.snapshotPath);
      assert.ok(
        record.main.blocks.length ||
          record.main.imageReferences.length ||
          record.videos.length,
        `No content preserved: ${record.pageId}`,
      );
    }
    if (record.snapshotPath) {
      const raw = await readFile(safePath(record.snapshotPath), "utf8");
      assert.equal(
        hash(raw),
        record.contentHash,
        `Snapshot changed: ${record.pageId}`,
      );
    }
    for (const [i, b] of record.main.blocks.entries())
      assert.equal(b.order, i, `Block order: ${record.pageId}`);
    for (const s of record.tour.sectionRanges) {
      assert.ok(s.startBlockOrder <= s.endBlockOrder);
      assert.ok(record.main.blocks[s.startBlockOrder]);
      assert.ok(record.main.blocks[s.endBlockOrder]);
    }
    records.push(record);
  }
  for (const url of manifest.urls) {
    if (url.pageId)
      assert.ok(ids.has(url.pageId), `Unresolved page ID: ${url.requestedUrl}`);
    if (["extracted", "redirected"].includes(url.outcome))
      assert.ok(
        url.pageId,
        `Successful URL has no record: ${url.requestedUrl}`,
      );
  }
  const knownUrls = new Set(manifest.urls.map((u) => urlKey(u.requestedUrl)));
  for (const resource of manifest.resources) {
    if (!resource.file?.endsWith(".xml")) continue;
    const $ = load(await readFile(safePath(resource.file), "utf8"), {
      xml: true,
    });
    $("url > loc").each((i, e) =>
      assert.ok(
        knownUrls.has(urlKey($(e).text().trim())),
        `Sitemap URL unaccounted: ${$(e).text()}`,
      ),
    );
  }
  const links = await readJson(`${base}entity-links.txt`);
  const entityIds = new Set((links.entities ?? []).map((e) => e.entityId));
  for (const e of links.entities ?? []) {
    assert.ok(ids.has(e.pageId));
    const p = records.find((p) => p.pageId === e.pageId);
    for (const i of [e.headingBlockOrder, ...e.biographyBlockOrders])
      assert.ok(p.main.blocks[i]);
  }
  for (const r of links.relationships) {
    assert.ok(ids.has(r.fromPageId));
    if (r.toPageId) assert.ok(ids.has(r.toPageId));
    if (r.toEntityId) assert.ok(entityIds.has(r.toEntityId));
  }
  await readJson(`${base}site-settings.txt`);
  const files = await readdir(safePath(`${base}pages`));
  assert.deepEqual(
    files.filter((f) => f.endsWith(".txt")).sort(),
    manifest.pages.map((p) => `${p.pageId}.txt`).sort(),
  );
  return {
    manifest,
    records,
    summary: {
      pages: records.length,
      successfulPages: records.filter((r) => r.httpStatus === 200).length,
      urls: manifest.urls.length,
      relationships: links.relationships.length,
      guideEntities: entityIds.size,
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const base =
    process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "";
  const result = await validateArchive(base);
  console.log("PASS archive validation", JSON.stringify(result.summary));
}
