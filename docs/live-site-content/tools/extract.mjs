import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  root,
  origin,
  hash,
  safePath,
  readJson,
  writeJson,
  urlKey,
  readableUrl,
} from "./common.mjs";
import { extractHtml, classify } from "./extraction.mjs";
import { initialPaths } from "./initial-paths.mjs";
import { validateRecord, ManifestSchema } from "./schema.mjs";
const runId = process.argv.find((a) => a.startsWith("--run-id="))?.slice(9);
if (!runId || !/^[a-zA-Z0-9-]+$/.test(runId))
  throw Error("Supply --run-id=<safe crawl run ID>");
const crawl = await readJson(`snapshots/${runId}/crawl.json`);
if (!crawl.finishedAt)
  throw Error("Crawl has not finished; wait before extraction");
const existing = await readJson("manifest.txt", null);
const publishInitial = process.argv.includes("--publish-initial");
if (existing && publishInitial)
  throw Error(
    "Refusing to overwrite an existing archive. Review staged changes instead.",
  );
const stageId =
  process.argv.find((a) => a.startsWith("--stage-id="))?.slice(11) ?? runId;
if (!/^[a-zA-Z0-9-]+$/.test(stageId)) throw Error("Invalid stage ID");
const base = publishInitial ? "" : `staging/${stageId}/`;
if (base && (await readJson(`${base}manifest.txt`, null)))
  throw Error(
    "Staged extraction already exists; use a new --stage-id rather than overwrite review work.",
  );
if (!publishInitial) await mkdir(safePath(base), { recursive: true });
const records = [];
const seen = new Set();
const differences = [];
for (const row of crawl.fetches) {
  if (seen.has(row.pageId)) continue;
  seen.add(row.pageId);
  const raw = row.snapshotPath
    ? await readFile(safePath(row.snapshotPath), "utf8")
    : "";
  const content = extractHtml(raw, row.finalUrl);
  const sourcePath = decodeURI(new URL(row.requestedUrl).pathname);
  const finalPath = decodeURI(new URL(row.finalUrl).pathname);
  const pageType = classify(sourcePath, content.bodyClass, row.httpStatus);
  const prior = existing?.pages.find((p) => p.pageId === row.pageId);
  const corrected = prior ? await readJson(prior.file) : null;
  const publicPath = corrected
    ? corrected.publicPath
    : row.httpStatus === 200 && !new URL(row.finalUrl).search
      ? (initialPaths[finalPath] ?? null)
      : null;
  const reviewNotes = [];
  if (!publicPath)
    reviewNotes.push(
      "Public path unresolved; do not redirect to an unrelated page.",
    );
  if (pageType === "tour")
    reviewNotes.push(
      "Keep this source trip page distinct. Do not merge itineraries/departures until later domain-model migration. All numeric/date/status normalization is an unverified candidate.",
    );
  if (
    [
      "categoryArchive",
      "destinationArchive",
      "authorArchive",
      "leadStatusTaxonomy",
    ].includes(pageType)
  )
    reviewNotes.push(
      "Taxonomy/archive preserved for explicit editorial review; no automatic retirement or consolidation.",
    );
  if (pageType === "leadStatusTaxonomy")
    reviewNotes.push(
      "Apparently internal lead-status taxonomy was publicly listed in the sitemap; source returns 404. Its purpose and future treatment are unresolved.",
    );
  if (pageType === "testimonials" && content.testimonials.length === 0)
    reviewNotes.push(
      "No textual quotes/attribution found in direct HTML. Source uses image-based testimonials; image references retained without downloading/OCR. No quotes invented.",
    );
  if (pageType === "videos")
    reviewNotes.push(
      "Video URLs preserved from Elementor settings; missing titles/descriptions remain null. External players/videos were not fetched.",
    );
  if (content.sourceSeo.htmlLanguage !== "he")
    reviewNotes.push(
      `Source HTML language is ${content.sourceSeo.htmlLanguage ?? "missing"} despite Hebrew display text.`,
    );
  const extractionStatus =
    row.httpStatus !== 200
      ? "sourceUnavailable"
      : reviewNotes.length
        ? "needsReview"
        : "extracted";
  const record = {
    schemaVersion: 1,
    pageId: row.pageId,
    pageType,
    sourceUrl: row.requestedUrl,
    sourcePath,
    finalUrl: row.finalUrl,
    publicPath,
    publicSlug:
      publicPath && publicPath !== "/"
        ? publicPath.split("/").filter(Boolean).at(-1)
        : null,
    retrievedAt: row.retrievedAt,
    httpStatus: row.httpStatus,
    redirectChain: row.redirectChain,
    contentHash: row.contentHash,
    snapshotPath: row.snapshotPath,
    retrievalMethod: "direct-http",
    httpHeaders: row.headers,
    discoverySources: row.discoverySources,
    extractionStatus,
    reviewNotes,
    decision: publicPath ? "preserve" : "unresolved",
    decisionReason: publicPath
      ? "Explicit saved path proposal; preserve this distinct source page"
      : "Source unavailable or path requires manual decision",
    ...content,
  };
  delete record.bodyClass;
  validateRecord(record);
  if (raw && hash(raw) !== record.contentHash)
    throw Error(`Snapshot hash mismatch ${record.pageId}`);
  records.push(record);
  await writeJson(`${base}pages/${record.pageId}.txt`, record);
  if (corrected && JSON.stringify(corrected) !== JSON.stringify(record))
    differences.push({
      pageId: record.pageId,
      existingFile: prior.file,
      baselineRecordHash: hash(JSON.stringify(corrected)),
      stagedFile: `${base}pages/${record.pageId}.txt`,
      sourceChanged: corrected.contentHash !== record.contentHash,
      mainTextChanged: corrected.main.text !== record.main.text,
      publicPathPreserved: corrected.publicPath === record.publicPath,
      note: "Existing record untouched. Review staged source and manually corrected fields before merging.",
    });
}
const pages = records.map((r) => ({
  pageId: r.pageId,
  file: `${base}pages/${r.pageId}.txt`,
  snapshotPath: r.snapshotPath,
  finalUrl: r.finalUrl,
  publicPath: r.publicPath,
  pageType: r.pageType,
  extractionStatus: r.extractionStatus,
  httpStatus: r.httpStatus,
}));
const urls = crawl.fetches.map((r) => ({
  requestedUrl: r.requestedUrl,
  finalUrl: r.finalUrl,
  pageId: r.pageId,
  outcome:
    r.outcome === "extracted" && r.redirectChain.length
      ? "redirected"
      : r.outcome,
  reason: r.error,
  discoverySources: r.discoverySources,
  redirectChain: r.redirectChain,
  httpStatus: r.httpStatus,
}));
for (const r of crawl.excludedUrls)
  urls.push({
    requestedUrl: r.url,
    finalUrl: null,
    pageId: null,
    outcome: "excluded",
    reason: crawl.sitemaps.some(s=>urlKey(s.requestedUrl)===urlKey(r.url)) ? "Sitemap already archived as a discovery resource; excluded from HTML page queue" : r.reason,
    discoverySources: r.discoverySources,
    redirectChain: [],
    httpStatus: null,
  });
for (const r of crawl.pendingUrls)
  urls.push({
    requestedUrl: r.url,
    finalUrl: null,
    pageId: r.pageId ?? null,
    outcome: "pending",
    reason: "Crawl limit reached",
    discoverySources: r.discoverySources,
    redirectChain: [],
    httpStatus: null,
  });
const manifest = {
  schemaVersion: 1,
  crawlRunId: runId,
  generatedAt: new Date().toISOString(),
  sourceOrigin: origin,
  pages,
  urls,
  resources: [crawl.robots, ...crawl.sitemaps],
  externalReferences: crawl.externalUrls,
  notes: [
    "Discovery graph contains all same-site HTML candidates and explicit exclusions. External URLs are references only.",
    "Sitemap lastmod is discovery evidence, never an editorial publication date.",
    "No archive data is imported by the rebuild runtime.",
  ],
};
ManifestSchema.parse(manifest);
const uniquePaths = new Map();
for (const p of pages) {
  if (!p.publicPath) continue;
  if (uniquePaths.has(p.publicPath))
    throw Error(
      `Public path collision: ${p.publicPath} (${p.pageId}, ${uniquePaths.get(p.publicPath)})`,
    );
  uniquePaths.set(p.publicPath, p.pageId);
}
await writeJson(`${base}manifest.txt`, manifest);
const home = records.find((r) => r.pageType === "home"),
  contact = records.find((r) => r.pageType === "contact");
await writeJson(`${base}site-settings.txt`, {
  schemaVersion: 1,
  sourceOrigin: origin,
  crawlRunId: runId,
  languageEvidence: home?.sourceSeo.htmlLanguage ?? null,
  businessNameEvidence: home?.sourceSeo.htmlTitles ?? [],
  navigation: home?.shared.navigation ?? [],
  footer: home?.shared.footer ?? [],
  widgets: home?.shared.widgets ?? [],
  contactEvidence: records
    .filter((r) => ["home", "contact"].includes(r.pageType))
    .map((r) => ({
      pageId: r.pageId,
      sourceUrl: r.sourceUrl,
      links: [...r.internalLinks, ...r.externalLinks].filter((l) =>
        /^(tel:|mailto:)/.test(l.href),
      ),
      contactText: r.pageType === "contact" ? r.main.text : null,
    })),
  formsDocumentation: records
    .map((r) => ({ pageId: r.pageId, forms: r.forms }))
    .filter((r) => r.forms.length),
  sourceVerificationTags: records
    .filter((r) => r.sourceSeo.verificationTags.length)
    .map((r) => ({ pageId: r.pageId, tags: r.sourceSeo.verificationTags })),
  note: "Public source evidence, not approved settings for the demo runtime.",
});
const byUrl = new Map();
for (const u of urls) if (u.pageId) byUrl.set(urlKey(u.requestedUrl), u.pageId);
for (const r of records) byUrl.set(urlKey(r.finalUrl), r.pageId);
const relationships = [];
const relSeen = new Set();
const priorEntities = await readJson("entity-links.txt", { entities: [] });
const entities = [];
for (const page of records.filter((r) => r.pageType === "guides")) {
  for (const block of page.main.blocks.filter(
    (b) => b.type === "heading" && b.level === 3,
  )) {
    const prior = priorEntities.entities?.find(
      (e) =>
        e.pageId === page.pageId && e.sourceSelector === block.sourceSelector,
    );
    const next = page.main.blocks.find(
      (b) => b.order > block.order && b.type === "heading" && b.level <= 3,
    );
    entities.push({
      entityId: prior?.entityId ?? `guide-${randomUUID()}`,
      kind: "guideProfileSection",
      pageId: page.pageId,
      displayName: block.text,
      sourceSelector: block.sourceSelector,
      headingBlockOrder: block.order,
      biographyBlockOrders: page.main.blocks
        .filter(
          (b) =>
            b.order > block.order &&
            b.order < (next?.order ?? page.main.blocks.length),
        )
        .map((b) => b.order),
      note: "References original ordered source blocks; no separate biography copy or invented guide page.",
    });
  }
}
function add(fromPageId, toPageId, kind, evidence) {
  if (!toPageId || fromPageId === toPageId) return;
  const key = JSON.stringify([fromPageId, toPageId, kind, evidence]);
  if (relSeen.has(key)) return;
  relSeen.add(key);
  relationships.push({
    fromPageId,
    toPageId,
    kind,
    confidence: "observed",
    evidence,
  });
}
for (const r of records) {
  for (const link of r.main.links) {
    if (!link.resolvedUrl) continue;
    const dest = byUrl.get(urlKey(link.resolvedUrl));
    if (dest)
      add(r.pageId, dest, "mainContentLink", {
        text: link.text,
        url: link.resolvedUrl,
        sourceSelector: link.sourceSelector,
      });
  }
  for (const l of r.taxonomyLinks)
    if (l.url)
      add(r.pageId, byUrl.get(urlKey(l.url)), "taxonomyMembership", {
        label: l.text,
        url: l.url,
      });
  for (const node of r.jsonLdNodes) {
    if (node["@type"] === "Person" && node.url)
      add(r.pageId, byUrl.get(urlKey(node.url)), "structuredAuthor", {
        name: node.name ?? null,
        url: node.url,
      });
  }
  const m = r.sourcePath.match(/^\/המדינות\/([^/]+)/);
  if (m) {
    for (const link of r.main.links) {
      const target = records.find(
        (p) => p.pageId === byUrl.get(urlKey(link.resolvedUrl ?? r.sourceUrl)),
      );
      if (target?.pageType === "tour")
        add(target.pageId, r.pageId, "listedInDestination", {
          destinationLabel: m[1],
          listingPage: r.sourceUrl,
          cardText: link.text,
        });
    }
  }
  if (r.pageType === "tour")
    for (const e of entities) {
      const aliases =
        e.displayName === "איל מירון"
          ? ["איל מירון", "אייל מירון"]
          : [e.displayName];
      const matches = r.main.blocks.filter(
        (b) => b.text && aliases.some((a) => b.text.includes(a)),
      );
      if (matches.length)
        relationships.push({
          fromPageId: r.pageId,
          toEntityId: e.entityId,
          kind: "mentionsGuide",
          confidence: "observed",
          evidence: matches.map((b) => ({
            blockOrder: b.order,
            rawValue: b.text,
          })),
          note: "Observed name mention; assignment and role need review of the exact context.",
        });
    }
}
await writeJson(`${base}entity-links.txt`, {
  schemaVersion: 1,
  crawlRunId: runId,
  entities,
  relationships,
  unresolved: [
    {
      kind: "tourFamilyAndDeparture",
      note: "Distinct dated trip source pages remain separate page IDs. No new evergreen family/entity or deduplicated itinerary has been invented.",
    },
    {
      kind: "guideProfiles",
      note: "Guide biographies are ordered sections of the guides page, not invented independent pages. Relationships need owner-reviewed names/IDs before the later adapter.",
    },
    {
      kind: "datesPricesStatuses",
      note: "Exact strings and unverified normalization candidates reside on each source page. Contradictions require review.",
    },
  ],
  modelExtensionsNeeded: [
    "Archive block levels 1–6, tables, FAQ, anchors and source links extend the scaffold block union.",
    "Source/provenance, aliases, taxonomy/author archives and full SEO evidence need a later archive adapter.",
    "Dated source trip pages must be mapped explicitly to Tour/Departure later; do not merge by destination/title.",
    "Guide profiles need stable section/entity IDs after review.",
    "Image-based testimonials cannot be converted to quotes without approved transcription.",
  ],
});
await writeJson(`${base}differences.json`, {
  schemaVersion: 1,
  crawlRunId: runId,
  baselineManifest: existing ? "manifest.txt" : null,
  differences,
  newPageIds: records
    .filter((r) => !existing?.pages.some((p) => p.pageId === r.pageId))
    .map((r) => r.pageId),
  automaticOverwrite: false,
});
console.log(
  JSON.stringify({
    base: base || "archive root",
    records: records.length,
    urls: urls.length,
    relationships: relationships.length,
    differences: differences.length,
  }),
);
