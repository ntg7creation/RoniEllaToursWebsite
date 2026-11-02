import { writeFile, mkdir } from "node:fs/promises";
import { validateArchive } from "./validate.mjs";
import { safePath, readJson, urlKey, readableUrl } from "./common.mjs";
const { manifest, records, summary } = await validateArchive();
const crawl = await readJson(`snapshots/${manifest.crawlRunId}/crawl.json`);
await mkdir(safePath("reports"), { recursive: true });
const write = (name, body) =>
  writeFile(safePath(`reports/${name}`), body + "\n", "utf8");
const escape = (s) =>
  String(s ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
const table = (heads, rows) =>
  [
    heads.join(" | "),
    heads.map(() => "---").join(" | "),
    ...rows.map((r) => r.map(escape).join(" | ")),
  ].join("\n");
const counts = (rows, key) =>
  Object.entries(
    rows.reduce((a, r) => ((a[r[key]] = (a[r[key]] ?? 0) + 1), a), {}),
  );
const pagesById = new Map(records.map((r) => [r.pageId, r]));
const byUrl = new Map(manifest.urls.map((r) => [urlKey(r.requestedUrl), r]));
const totalObservedUrls=new Set([...manifest.urls.map(r=>urlKey(r.requestedUrl)),...manifest.resources.map(r=>urlKey(r.requestedUrl))]).size;
const imageExclusions=crawl.excludedUrls.filter(r=>/\.(?:jpg|jpeg|png|webp|gif|svg|ico)$/i.test(new URL(r.url).pathname)).length;
const gaps = manifest.urls.filter((r) =>
  ["failed", "blocked", "pending"].includes(r.outcome),
);
const review = await readJson("review-evidence.json", null);
await write(
  "coverage.md",
  `# Public crawl coverage — ${manifest.crawlRunId}

Generated from manifest.txt and immutable HTTP evidence. This is a bounded public-site archive, not a claim about undiscoverable/private pages.

${summary.pages} distinct page records and snapshots: ${summary.successfulPages} successful pages, ${summary.pages - summary.successfulPages} unavailable source records. ${crawl.fetches.length} HTML candidates were requested. The candidate inventory has ${manifest.urls.length} URLs, including ${crawl.excludedUrls.length} non-page references (${imageExclusions} image references; the sitemap index is also listed there as a resource excluded from the HTML queue). Robots and all sitemap resources were fetched separately: ${totalObservedUrls} unique same-site URLs across candidate/resource inventories. ${crawl.externalUrls.length} external navigational references were recorded without fetching their contents. Video/embed/image/metadata URL references also remain in individual records.

## URL outcomes

${table(["Outcome", "Count"], counts(manifest.urls, "outcome"))}

## Distinct page types

${table(["Page type", "Count"], counts(records, "pageType"))}

## Discovery evidence

- robots.txt: HTTP ${crawl.robots.httpStatus}; ${crawl.robots.file}. Its empty Disallow permits this crawl.
- Fresh index and all ${crawl.sitemaps.length - 1} child sitemaps were read, without assuming a fixed list.
- Sitemaps: ${crawl.sitemaps.map((s) => s.requestedUrl).join(", ")}.
- Followed same-site header/footer, article/tour/category/archive links, canonical/shortlink aliases and next/previous pagination links. No pagination links remained pending. No tag archive link/sitemap was discovered; this is absence in the observed graph, not proof that none exist.
- Rate: at least ${crawl.requestPolicy.intervalMs}ms between requests, 20-second timeout, at most two retries with exponential backoff, at most eight same-site redirect hops and ${crawl.requestPolicy.maxPages} candidates. No login, form submission, private endpoint, external site, video or photo download.
- No browser surface was connected to the available browser tool. Primary text was present in HTML; the testimonials page contains image references instead of text quotes, so no OCR/transcription was invented. Video URLs were present in public Elementor settings; missing titles/descriptions stay missing.
- No WordPress REST supplementation was necessary. Sitemap lastmod remains discovery evidence only.

## All failed/blocked/pending HTML candidates

${table(
  ["Requested URL", "HTTP status", "Decision / gap"],
  gaps.map((u) => [
    readableUrl(u.requestedUrl),
    u.httpStatus,
    u.reason ??
      "Source returns an error; public path unresolved; do not redirect to homepage",
  ]),
)}

## Content gaps and review

- Image-only testimonials: original image URL/alt/caption references retained; quote and attribution text cannot be recovered without a separately approved transcription/OCR task.
- Individual video titles/descriptions not present in source remain null. External video availability/content was not checked.
- Public 404s include a sitemap-listed lead-status taxonomy and old tour links; these remain unresolved, not silently retired.
- All source wording, SEO, guide bios, travel terms and conflicting values are evidence requiring review, not approved production facts.
- Fidelity check: ${review ? `${review.rows.length} successful pages compared; ${review.rows.filter((r) => r.missingText.length).length} pages with unmatched readable text nodes` : "not yet run; see review.mjs"}.
- Manual spot comparisons are documented in manual-review.md; these do not certify every source claim.
- Unavailable publicly: SEO-plugin private settings, rankings/traffic history, unpublished content and server redirect rules not observable through these requests. None were inferred.

## Inventory and explicit decisions

Every discovered page/asset candidate is listed in manifest.urls and url-map.csv; robots/sitemap resources are additionally listed in manifest.resources. Asset/non-HTML/API/query exclusions are retrieval decisions, not editorial retirement of taxonomy/content. External references are recorded separately. All ${records.filter((r) => r.publicPath).length} available pages have explicit saved ASCII path proposals; unavailable pages are unresolved. No successful taxonomy page was automatically excluded.

${table(
  ["ID", "Type", "Status", "Proposed path", "Source path"],
  records.map((p) => [
    p.pageId,
    p.pageType,
    p.httpStatus,
    p.publicPath ?? "UNRESOLVED",
    readableUrl(p.sourceUrl),
  ]),
)}
`,
);
const audit = [];
const add = (p, issue, evidence) =>
  audit.push([p.pageId, p.publicPath ?? p.sourcePath, issue, evidence]);
for (const p of records) {
  if (p.httpStatus !== 200) continue;
  const s = p.sourceSeo;
  if (!s.htmlTitles.length || s.htmlTitles.every((t) => !t.trim()))
    add(p, "Missing title", "No nonempty HTML title");
  if (s.htmlTitles.length > 1)
    add(p, "Multiple titles", JSON.stringify(s.htmlTitles));
  if (
    !s.sourceMetaDescriptions.length ||
    s.sourceMetaDescriptions.every((t) => !t?.trim())
  )
    add(
      p,
      "Missing meta description",
      "Source is missing; no replacement invented",
    );
  if (s.sourceMetaDescriptions.length > 1)
    add(p, "Multiple descriptions", JSON.stringify(s.sourceMetaDescriptions));
  const h1 = s.headings.filter((h) => h.level === 1);
  if (h1.length !== 1)
    add(
      p,
      h1.length ? "Multiple H1s" : "Missing H1",
      JSON.stringify(h1.map((h) => h.text)),
    );
  if (s.canonicalEntries.length !== 1)
    add(p, "Missing/multiple canonical", JSON.stringify(s.canonicalEntries));
  if (
    s.sourceCanonicalUrl &&
    urlKey(s.sourceCanonicalUrl) !== urlKey(p.finalUrl)
  )
    add(p, "Canonical differs from final URL", s.sourceCanonicalUrl);
  const directives = [
    ...s.robots.map((m) => m.content ?? ""),
    p.httpHeaders["x-robots-tag"] ?? "",
  ];
  if (
    directives.some((d) => /\bnoindex\b/.test(d)) &&
    directives.some((d) => /(?:^|[, ])index(?:[, ]|$)/.test(d))
  )
    add(p, "Robots conflict", JSON.stringify(directives));
  if (s.htmlLanguage !== "he")
    add(
      p,
      "Unexpected HTML locale",
      `lang=${s.htmlLanguage ?? "missing"}; Hebrew body retained`,
    );
  for (const m of s.openGraph.filter(
    (m) => m.property === "og:locale" && m.content !== "he_IL",
  ))
    add(p, "Unexpected Open Graph locale", m.content);
  for (const j of s.jsonLd)
    if (j.parseStatus === "invalid") add(p, "Invalid JSON-LD", j.error);
  for (const n of p.jsonLdNodes) {
    if (n.inLanguage && !/^he(?:[-_]|$)/.test(n.inLanguage))
      add(
        p,
        "Questionable structured-data locale",
        `${n["@type"]}: inLanguage=${n.inLanguage}`,
      );
    if (n.aggregateRating)
      add(
        p,
        "Structured rating needs visible-evidence review",
        JSON.stringify(n.aggregateRating),
      );
    if (n["@type"] === "Article" && !p.article.visibleDates.length)
      add(
        p,
        "Structured date is not a visible editorial date",
        `datePublished=${n.datePublished ?? "missing"}; not replaced by sitemap lastmod`,
      );
  }
  for (const l of p.internalLinks) {
    if (!l.resolvedUrl) continue;
    const target = byUrl.get(urlKey(l.resolvedUrl));
    if (target && ["failed", "blocked"].includes(target.outcome))
      add(
        p,
        "Broken internal link",
        `${l.text}: ${readableUrl(l.resolvedUrl)} (${target.httpStatus})`,
      );
  }
}
for (const field of ["htmlTitles", "sourceMetaDescriptions"]) {
  const values = new Map();
  for (const p of records.filter((p) => p.httpStatus === 200))
    for (const v of p.sourceSeo[field])
      if (v?.trim()) {
        const list = values.get(v) ?? [];
        list.push(p);
        values.set(v, list);
      }
  for (const [v, list] of values)
    if (list.length > 1)
      for (const p of list)
        add(
          p,
          `Duplicate ${field}`,
          `${JSON.stringify(v)} shared with ${list
            .filter((q) => q !== p)
            .map((q) => q.pageId)
            .join(", ")}`,
        );
}
const pathGroups = new Map();
for (const p of records)
  if (p.publicPath) {
    const a = pathGroups.get(p.publicPath) ?? [];
    a.push(p.pageId);
    pathGroups.set(p.publicPath, a);
  }
const collisions = [...pathGroups].filter(([, ids]) => ids.length > 1);
await write(
  "seo-audit.md",
  `# Source SEO audit

Observations below preserve current wording and duplicate entry order. Source canonicals/directives are evidence only; the rebuild keeps its own ASCII canonicals and noindex protections. Keywords, if present, are historical evidence and are not treated as a Google ranking mechanism.

${table(["Page ID", "Proposed/source path", "Observation", "Evidence"], audit)}

## URL collision review

${collisions.length ? JSON.stringify(collisions) : "No proposed ASCII path collisions detected. Six distinct tour records have six distinct paths. Older China aliases resolve to dated pages; no evergreen China page was invented."}

## Proposed fixes (not applied to live content)

Review missing/duplicate metadata and heading structure; reconcile source canonical/locale/robots differences; verify structured-data claims and authors/dates against visible content; repair broken links only after deciding valid destination records. Future integration must update internal links, canonical, og:url, structured-data URLs, sitemap URLs and share links together. Keep wording unchanged until editorial optimization is requested. Do not copy source indexing directives into staging.
`,
);
const conflicts = [];
for (const p of records.filter((p) => p.pageType === "tour")) {
  const title = p.sourceSeo.headings.find((h) => h.level === 1)?.text ?? "";
  const years = [...title.matchAll(/20\d{2}/g)].map((m) => m[0]);
  for (const obs of p.tour.observations.filter((o) => o.kind === "date"))
    if (years.length && !years.includes(obs.rawValue.slice(-4)))
      conflicts.push([
        p.pageId,
        "Different year in title and dated body condition",
        `Title: ${title}; exact date: ${obs.rawValue}; block ${obs.blockOrder}: ${obs.context}`,
      ]);
  if (p.sourcePath.includes("אפריל-2") && title.includes("סוכות"))
    conflicts.push([
      p.pageId,
      "Source slug/title conflict",
      `Source path says April-2; H1 is ${title}. Saved proposal uses sukkot-2027 without changing the source.`,
    ]);
  conflicts.push([
    p.pageId,
    "Tour source values require contextual review",
    `Itinerary heading entries: ${p.tour.itinerary.length}. Monetary strings: ${
      p.tour.observations
        .filter((o) => o.kind === "price")
        .map((o) => `${o.rawValue} [block ${o.blockOrder}]`)
        .join("; ") || "none recognized (no zero invented)"
    }. Dates/statuses remain exact source observations, not approved departures.`,
  ]);
}
for (const p of records.filter((p) =>
  ["home", "tours", "destinationArchive"].includes(p.pageType),
)) {
  for (const card of p.cards) {
    if (/2027/.test(card.text) && /2025/.test(card.text))
      conflicts.push([p.pageId, "Card title/date-year conflict", card.text]);
  }
}
for (const p of records) {
  if (p.main.text.includes("shimara.co.il"))
    conflicts.push([
      p.pageId,
      "Accessibility statement names another domain",
      "www.shimara.co.il occurs in the source statement; retained for review.",
    ]);
  if (
    p.main.text.includes("עמק המלכים") &&
    p.main.text.includes("טיולי העולם העתיק")
  )
    conflicts.push([
      p.pageId,
      "Mixed business names",
      "Both עמק המלכים and טיולי העולם העתיק appear in the source; no name was silently replaced.",
    ]);
}
await write(
  "content-conflicts.md",
  `# Source content conflicts and unresolved normalization

These are observations and review candidates, not corrections or approved prices/schedules. Read full contexts in the referenced page's ordered blocks and raw HTML.

${table(["Page ID", "Observation", "Exact source context / interpretation limit"], conflicts)}

## Cross-record constraints

- Tour cards, headings, body conditions and destination listings are retained independently. A date in an early-booking/payment condition is not automatically a departure date; a supplement/discount is not the tour price.
- Normalized date/price/status fields are explicitly unverified candidates. Unknown/ambiguous values remain absent/null; range conflicts are not repaired. Durations and itinerary heading counts may differ (including combined travel days) and require review.
- The six distinct source tours are not merged. No new evergreen China page, tour-family itinerary copy or future departure record was invented. Guide profiles reference existing source blocks; name variants remain review evidence.
- Taxonomy/author archives are preserved under distinct proposed URLs; lead-status/new is a publicly listed 404 and unresolved. No automatic taxonomy retirement.
- Source testimonials are image-based; no customer quotation/attribution was invented. Video title/description gaps stay null.
- Public forms are documented only. No fields, consent text or legacy scripts are activated by this archive.
`,
);
// The local read-only archive adapter now serves all successful registered pages.
const columns = [
  "oldRequestedUrl",
  "oldRequestedUrlReadable",
  "oldRequestedUrlEncoded",
  "finalSourceUrl",
  "pageId",
  "proposedNewAsciiPath",
  "decision",
  "proposedRedirectStatus",
  "reason",
  "implementationStatus",
  "redirectRuleKey",
];
const csvEscape = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
const csv = [columns.map(csvEscape).join(",")];
for (const u of manifest.urls) {
  const p = pagesById.get(u.pageId);
  const path = p?.publicPath ?? null;
  const self =
    path &&
    new URL(u.requestedUrl).pathname === path &&
    !new URL(u.requestedUrl).search;
  const decision =
    u.outcome === "excluded"
      ? "excluded"
      : !path
        ? "unresolved"
        : u.outcome === "redirected"
          ? "alias"
          : "preserve";
  const status = path ? (self ? 200 : 301) : null;
  const active = path && p?.httpStatus === 200 && ["extracted","redirected"].includes(u.outcome);
  const reason =
    u.reason ??
    (decision === "alias"
      ? "Observed source redirect alias; proposed rule goes directly to saved final destination"
      : path
        ? "Preserve distinct source page with saved ASCII path"
        : "Public source unavailable; do not redirect to an unrelated page");
  const implementationStatus = active ? (self ? "served locally from archive" : "enabled locally: existing archived destination") : "not enabled";
  csv.push(
    [
      u.requestedUrl,
      readableUrl(u.requestedUrl),
      new URL(u.requestedUrl).href,
      u.finalUrl ?? "",
      u.pageId ?? "",
      path ?? "",
      decision,
      status ?? "",
      reason,
      implementationStatus,
      urlKey(u.requestedUrl),
    ]
      .map(csvEscape)
      .join(","),
  );
}
await write("url-map.csv", csv.join("\n"));
console.log(
  JSON.stringify({
    reports: 4,
    auditObservations: audit.length,
    conflictObservations: conflicts.length,
    urlMapRows: manifest.urls.length,
  }),
);
