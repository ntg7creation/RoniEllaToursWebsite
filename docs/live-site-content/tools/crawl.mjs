import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { load } from "cheerio";
import {
  root,
  origin,
  hash,
  safePath,
  readJson,
  writeJson,
  sameSite,
  urlKey,
  crawlDecision,
  publicIdentity,
} from "./common.mjs";

const option = (name) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
const runId =
  option("run-id") ?? new Date().toISOString().replace(/[:.]/g, "-");
if (!/^[a-zA-Z0-9-]+$/.test(runId))
  throw new Error("Use a safe alphanumeric crawl run ID");
const delayMs = Number(option("delay-ms") ?? 1000);
if (!Number.isFinite(delayMs) || delayMs < 700)
  throw new Error("Minimum crawl request interval is 700ms");
const limit = Number(option("max-pages") ?? 400);
const manifest = await readJson("manifest.txt", { pages: [], urls: [] });
const previousRun = await readJson(`snapshots/${runId}/crawl.json`, null);
if (previousRun)
  throw new Error(
    "Run already exists; choose another run ID. Existing evidence is never replaced.",
  );
await mkdir(safePath(`snapshots/${runId}`), { recursive: true });
const ids = new Map(
  manifest.urls.map((r) => [urlKey(r.requestedUrl), r.pageId]),
);
const identityIds = new Map();
for (const p of manifest.pages) {
  const record = await readJson(p.file);
  if (record.sourceIdentity) identityIds.set(record.sourceIdentity, p.pageId);
}
for (const p of manifest.pages) ids.set(urlKey(p.finalUrl), p.pageId);
const queue = new Map();
const excluded = new Map();
const external = new Map();
const sitemaps = [];
const fetches = [];
const robotsRules = [];
const state = {
  schemaVersion: 1,
  runId,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  origin,
  requestPolicy: {
    intervalMs: delayMs,
    timeoutMs: 20000,
    maxRetries: 2,
    maxPages: limit,
    maxRedirects: 8,
    userAgent: "RoniellaContentArchive/1.0 (public content migration)",
  },
  robots: null,
  sitemaps,
  fetches,
  excludedUrls: [],
  externalUrls: [],
  gaps: [],
};
let lastRequest = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function oneRequest(url) {
  await sleep(Math.max(0, lastRequest + delayMs - Date.now()));
  lastRequest = Date.now();
  return fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
    headers: {
      "User-Agent": state.requestPolicy.userAgent,
      Accept:
        "text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.9",
    },
  });
}
async function retrieve(url) {
  const attempts = [];
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      let current = url;
      const chain = [];
      const visited = new Set();
      for (let hop = 0; hop <= 8; hop++) {
        if (visited.has(current)) throw new Error("Redirect loop");
        visited.add(current);
        const response = await oneRequest(current);
        const headers = Object.fromEntries(response.headers);
        if (
          [301, 302, 303, 307, 308].includes(response.status) &&
          headers.location
        ) {
          const next = new URL(headers.location, current).href;
          chain.push({
            url: current,
            status: response.status,
            location: headers.location,
            resolvedLocation: next,
            headers,
          });
          await response.body?.cancel();
          if (!sameSite(next))
            return {
              requestedUrl: url,
              finalUrl: next,
              httpStatus: response.status,
              redirectChain: chain,
              headers,
              retrievedAt: new Date().toISOString(),
              body: null,
              attempts,
              outcome: "blocked",
              error: "External redirect recorded without fetching destination",
            };
          current = next;
          continue;
        }
        const body = await response.text();
        attempts.push({ attempt: attempt + 1, status: response.status });
        if (
          [408, 429, 500, 502, 503, 504].includes(response.status) &&
          attempt < 2
        ) {
          await sleep(Math.min(10000, 1500 * 2 ** attempt));
          break;
        }
        return {
          requestedUrl: url,
          finalUrl: current,
          httpStatus: response.status,
          redirectChain: chain,
          headers,
          retrievedAt: new Date().toISOString(),
          body,
          attempts,
          outcome: response.ok
            ? "extracted"
            : response.status === 401 || response.status === 403
              ? "blocked"
              : "failed",
          error: null,
        };
      }
    } catch (e) {
      attempts.push({ attempt: attempt + 1, error: e.message });
      if (attempt < 2) await sleep(1500 * 2 ** attempt);
    }
  }
  return {
    requestedUrl: url,
    finalUrl: url,
    httpStatus: null,
    redirectChain: [],
    headers: {},
    retrievedAt: new Date().toISOString(),
    body: null,
    attempts,
    outcome: "failed",
    error: "Request failed after bounded retries",
  };
}
function discover(value, source) {
  let url;
  try {
    url = urlKey(new URL(value, source.url ?? origin).href);
  } catch {
    return;
  }
  if (!sameSite(url)) {
    const e = external.get(url) ?? { url, discoverySources: [] };
    e.discoverySources.push(source);
    external.set(url, e);
    return;
  }
  const reason = crawlDecision(url);
  if (reason) {
    const e = excluded.get(url) ?? { url, reason, discoverySources: [] };
    e.discoverySources.push(source);
    excluded.set(url, e);
    return;
  }
  const pathname = new URL(url).pathname;
  if (robotsRules.some((rule) => rule && pathname.startsWith(rule))) {
    excluded.set(url, {
      url,
      reason: "robots.txt disallow",
      discoverySources: [source],
    });
    return;
  }
  const entry = queue.get(url) ?? {
    url,
    pageId: ids.get(url) ?? null,
    discoverySources: [],
    fetched: false,
  };
  if (
    !entry.discoverySources.some(
      (s) => JSON.stringify(s) === JSON.stringify(source),
    )
  )
    entry.discoverySources.push(source);
  queue.set(url, entry);
}
const robots = await retrieve(`${origin}/robots.txt`);
state.robots = {
  ...robots,
  body: undefined,
  file: `snapshots/${runId}/robots.raw`,
};
await writeFile(safePath(state.robots.file), robots.body ?? "", "utf8");
// Only rules applying to this crawler or * are relevant. Empty Disallow allows crawling.
let active = false;
for (const raw of (robots.body ?? "").split(/\r?\n/)) {
  const line = raw.split("#")[0].trim();
  const m = line.match(/^([^:]+):\s*(.*)$/);
  if (!m) continue;
  if (m[1].toLowerCase() === "user-agent")
    active = ["*", "roniellacontentarchive"].includes(m[2].toLowerCase());
  else if (active && m[1].toLowerCase() === "disallow" && m[2])
    robotsRules.push(m[2]);
}
const sitemapQueue = [
  ...new Set([
    `${origin}/sitemap_index.xml`,
    ...(robots.body ?? "")
      .split(/\r?\n/)
      .filter((x) => /^sitemap:/i.test(x))
      .map((x) => x.slice(x.indexOf(":") + 1).trim()),
  ]),
];
const seenMaps = new Set();
while (sitemapQueue.length) {
  const url = sitemapQueue.shift();
  if (seenMaps.has(url) || !sameSite(url)) continue;
  seenMaps.add(url);
  const response = await retrieve(url);
  const file = `snapshots/${runId}/sitemap-${sitemaps.length + 1}.xml`;
  await writeFile(safePath(file), response.body ?? "", "utf8");
  sitemaps.push({
    ...response,
    body: undefined,
    file,
    contentHash: hash(response.body ?? ""),
  });
  if (response.httpStatus !== 200) {
    state.gaps.push(`Sitemap unavailable: ${url}`);
    continue;
  }
  const $ = load(response.body, { xml: true });
  $("sitemap > loc").each((_i, el) => {
    const child = $(el).text().trim();
    if (sameSite(child)) sitemapQueue.push(child);
  });
  $("url").each((_i, el) =>
    discover($(el).find("loc").first().text().trim(), {
      kind: "sitemap",
      url,
      lastmod: $(el).find("lastmod").first().text().trim() || null,
    }),
  );
}
discover(origin + "/", { kind: "seed", url: origin + "/" });
for (const entry of queue.values()) {
  if (fetches.length >= limit) {
    state.gaps.push(`Crawl page limit ${limit} reached`);
    break;
  }
  const response = await retrieve(entry.url);
  const finalKey = urlKey(response.finalUrl);
  const identity =
    response.body && response.httpStatus === 200
      ? publicIdentity(load(response.body)("body").attr("class") ?? "")
      : null;
  entry.pageId =
    (identity ? identityIds.get(identity) : null) ??
    entry.pageId ??
    ids.get(finalKey) ??
    `page-${randomUUID()}`;
  if (identity) identityIds.set(identity, entry.pageId);
  ids.set(entry.url, entry.pageId);
  ids.set(finalKey, entry.pageId);
  const file = `snapshots/${runId}/${entry.pageId}.html`;
  const isHtml = /text\/html|application\/xhtml\+xml/i.test(
    response.headers["content-type"] ?? "",
  );
  // One snapshot per resolved page; aliases have their own HTTP journey in crawl.json/manifest.
  const already = fetches.find(
    (f) => f.pageId === entry.pageId && f.snapshotPath,
  );
  const snapshotPath =
    response.body !== null && isHtml ? (already?.snapshotPath ?? file) : null;
  if (snapshotPath && !already)
    await writeFile(safePath(snapshotPath), response.body, "utf8");
  const row = {
    ...response,
    body: undefined,
    pageId: entry.pageId,
    snapshotPath,
    contentHash: response.body !== null ? hash(response.body) : null,
    isHtml,
    discoverySources: entry.discoverySources,
  };
  if (response.outcome === "extracted" && !isHtml) {
    row.outcome = "excluded";
    row.error = "Response is not HTML";
  }
  fetches.push(row);
  entry.fetched = true;
  if (isHtml && response.body) {
    const $ = load(response.body);
    $(
      'a[href],link[rel="canonical"],link[rel="shortlink"],link[rel="next"],link[rel="prev"]',
    ).each((_i, el) => {
      const href = $(el).attr("href");
      if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) return;
      discover(new URL(href, response.finalUrl).href, {
        kind: $(el).is("a") ? "link" : "headLink",
        url: entry.url,
        text: $(el).text().replace(/\s+/g, " ").trim(),
        rel: $(el).attr("rel") ?? null,
      });
    });
  }
  console.log(
    `${fetches.length}: ${row.httpStatus ?? "ERR"} ${row.outcome} ${decodeURI(entry.url)}`,
  );
  if (fetches.length % 10 === 0) await saveState();
}
async function saveState() {
  for (const entry of queue.values()) {
    const f = fetches.find((f) => f.requestedUrl === entry.url);
    if (f) f.discoverySources = entry.discoverySources;
  }
  state.excludedUrls = [...excluded.values()];
  state.externalUrls = [...external.values()];
  state.pendingUrls = [...queue.values()].filter((e) => !e.fetched);
  await writeJson(`snapshots/${runId}/crawl.json`, state);
}
state.finishedAt = new Date().toISOString();
await saveState();
console.log(
  JSON.stringify({
    runId,
    fetched: fetches.length,
    pending: state.pendingUrls.length,
    excluded: excluded.size,
    external: external.size,
    sitemaps: sitemaps.length,
  }),
);
