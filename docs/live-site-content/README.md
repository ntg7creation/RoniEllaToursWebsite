# Current public-site content archive

Fresh source: **https://roniellatours.com/**. Crawl run **`2026-10-25-live-01`**, retrieved on **2026-10-25**. The old application/archive was not used as the content source. The archive adapter in `back/` can read the successful structured page records and serve a validated public projection to the SSR frontend; current runtime content comes from local JSON or Supabase. Raw HTML snapshots, scripts, forms and source HTTP/SEO implementation evidence are never served. See [runtime integration](../archive-integration.md).

The crawl requested 77 HTML candidates and resolved them to **43 stable page records**: **40 successful pages** and **3 unavailable source records**. It also accounts for 221 excluded image references, one sitemap-index reference excluded from the HTML page queue (but fetched as a discovery resource), 34 observed redirect aliases among the requested candidates, and four external navigational references. The page/asset inventory has 299 URLs; including robots/sitemap resources, 307 distinct same-site URLs are accounted for. Video, embed, image and metadata references remain on the corresponding records. See [coverage](reports/coverage.md) for exact counts, page types and every gap. This is a bounded public discovery graph, not a claim to export private or undiscoverable content.

## Files and format

All `.txt` **data files contain valid, pretty-printed UTF-8 JSON**, schema version 1. They can be parsed with `JSON.parse`; headings never need to be guessed. IDs use random UUIDs prefixed with `page-`, never page titles or URL filenames.

```text
docs/live-site-content/
  manifest.txt                 # URL/ID/file registry, outcomes, discovery and resource evidence
  site-settings.txt            # Observed contact/navigation/footer/widget/form documentation
  entity-links.txt             # Observed page relationships and guide-section references
  pages/<stablePageId>.txt      # Structured page records
  snapshots/<crawlRunId>/
    <stablePageId>.html         # Original direct-HTTP source HTML, evidence only
    crawl.json                 # HTTP journeys, headers, attempts, link discovery, exclusions
    robots.raw                 # Original robots text, not a JSON data file
    sitemap-*.xml               # Original index/child sitemap evidence
  reports/
    coverage.md
    seo-audit.md
    content-conflicts.md
    url-map.csv
    manual-review.md
    initial-extraction-review.json
  review-evidence.json          # Repeatable readable-text fidelity checks
  staging/<stageId>/            # Proposed later extractions and differences; never auto-merged
  tools/                       # Standalone Node tools, own npm lockfile; no database/server
```

Snapshots may contain legacy scripts and forms because they preserve the source response. **Do not execute them, serve this folder, or copy those scripts/forms into the frontend.** No images/videos were downloaded. HTML is parsed without script execution.

Each page record stores source URL/path, final URL, retrieval time, final HTTP status, full observed redirect chain, response headers, SHA-256 source hash, discovery sources, snapshot path, extraction/review status, explicit migration decision, and saved `publicPath`/`publicSlug`. `sourceIdentity` records a public WordPress post/author/taxonomy identity when present, allowing IDs to survive renamed source URLs. It does not grant or use private WordPress access.

`main.blocks` preserves ordered H1–H6 headings with original levels, paragraphs, lists and nested lists, tables/cells/spans, text containers and captions. Anchor IDs and link text/destinations/rel values are retained. FAQ/accordion entries and itinerary/terms ranges reference original content. Non-heading labels such as payment/cancellation/inclusion labels remain non-heading text and have additional `tour.labeledSections` references. There is no arbitrary-HTML content renderer.

Shared header navigation, footer, popups and article-related listings are separated from primary text. Only exact repeated shared navigation or identical responsive-only sections are deduplicated, with recorded evidence. Related article/tour cards retain their full text and source links. Article `excerpt` is an observed `og:description` candidate; displayed listing excerpts also remain in listing/card evidence. No new excerpt or SEO description was written. Visible authors/dates and structured-data author/date values are distinct; sitemap lastmod is never promoted to a publication date.

`sourceSeo` retains ordered title/meta/link entries, original canonicals, hreflang/alternate links, robots/googlebot directives, Open Graph/Twitter/verification/keyword tags, JSON-LD raw text plus parse result/error, headings, breadcrumbs and significant microdata/RDFa. Missing values remain empty arrays/null. `publicPath` is a separate proposal, not a replacement for source evidence. Source ratings/schema claims are not approved production facts. Meta keywords, when present, are historical evidence, not a Google ranking mechanism.

Tour exact strings remain authoritative evidence. Normalized date/price/status/duration values are labeled **unverified candidates** with block references and context. A discount deadline is not a departure date; a deposit or supplement is not the tour price. Contradictory years, URL/title differences, conditions and guide references are retained for review. The six source tour pages stay distinct; no evergreen China tour or merged departures were invented. `entity-links.txt` records relationships and five guide profile sections without copying biographies into invented standalone pages, and documents later model extensions.

Forms preserve public labels/options/consent as documentation only, without activating submission or collecting customer details. Image-based testimonials have image references but no invented transcription/attribution. Video references preserve public settings URLs; missing titles/descriptions remain null.

## Reproduce and validate

Use Node 24 LTS (24.11+), npm 11. From repository root (PowerShell shown):

```powershell
cd docs/live-site-content/tools
npm.cmd ci
npm.cmd run crawl -- --run-id=2026-10-25-next
npm.cmd run extract -- --run-id=2026-10-25-next
npm.cmd run validate -- --base=staging/2026-10-25-next/
node review.mjs --base=staging/2026-10-25-next/
```

Choose a new run ID for every fresh crawl. Requests are sequential, at least one second apart, with 20-second timeouts, two bounded retries/backoff, eight same-site redirect hops and a 400-candidate cap. Public pagination/shortlink numeric query forms are bounded; arbitrary query combinations, assets and administrative endpoints are explicitly excluded. External links are recorded without crawling their contents. The available browser tool had no connected browser; meaningful text was available directly in HTML. There was no browser fallback or REST supplementation to misrepresent as completed.

For the checked-in baseline, these commands perform local-only validation and regenerate reports without network requests:

```powershell
npm.cmd test
npm.cmd run validate
node review.mjs
npm.cmd run report
```

Validation checks JSON/schema shape, unique IDs/public paths, safe filenames, snapshot hashes, successful-page evidence, every sitemap URL's accounting, block ordering and relationship references. The fidelity check compares every readable text node in each successful primary HTML document against structured blocks and separated widget evidence; all 40 successful pages currently have zero unmatched snippets. This is not editorial approval, browser-render equivalence or accessibility certification.

## Later runs and manual corrections

Edit `pages/<id>.txt` when making reviewed corrections. Keep IDs and explicit public paths stable when Hebrew titles change. Re-run validation/reports. The crawler reuses IDs from the manifest, aliases and public WordPress identities. Source URLs never become filesystem paths.

Later `extract` commands write **only under `staging/<stageId>/`**, with `differences.json`, changed-source/text flags, baseline record hashes, and preserved saved path proposals. Existing baseline files are untouched. A stage cannot be overwritten; choose another `--stage-id=...` for another extraction. `--publish-initial` is only for the first empty archive and refuses to overwrite an existing manifest. No automated merge is performed: compare staged records, source HTML and manual corrections before selectively adopting changes and updating manifest references. The initial extraction refinements made in this milestone were reviewed against unchanged snapshots and recorded in `reports/initial-extraction-review.json`.

Reports are generated review documents, not another manually maintained content database. Do not edit their counts or CSV rows independently of records/manifest/tool inputs.

## URL migration boundary

[url-map.csv](reports/url-map.csv) has one row per discovered same-site URL, with requested/readable/encoded representations, final source URL, page ID, saved ASCII path, preserve/alias/unresolved/excluded decision, proposed status/reason, implementation status and normalized rule key. Equivalent Hebrew encodings do not require duplicate redirect rules.

All 40 successful archived pages are now served locally, and 72 observed aliases redirect directly to their real existing destinations. No real tour redirects to a demo; old demo detail URLs return 404. Observed older China aliases map to their actual final dated page, not an invented evergreen page. Unavailable pages and unknown WordPress query IDs remain 404. Source internal links and canonical metadata use the saved ASCII paths. Full Open Graph/structured-data/sitemap migration remains deferred; raw legacy SEO markup is not injected into the application.

The application retains Hebrew text/RTL, English ASCII URLs, one trailing-slash policy, runtime SSR, React Router discovery and staging noindex protections. Archived source indexing directives cannot override those protections. Editing structured content requires an API restart; path changes also require restarting/rebuilding the frontend. The original archive snapshots remain evidence and are unchanged.

Publicly unavailable information includes private SEO-plugin settings, ranking/traffic history, unpublished content and server redirect configuration not observable through these requests. No database, authentication, form processing, upload/photo pipeline, analytics, deployment, commit or push is included.
