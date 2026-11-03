# SSG, automatic regeneration, and SEO preservation

Implemented 2 November 2026. No hosted deployment or database update was performed.

## What is generated and how it stays current

The normal frontend build now uses React Router's native `prerender` support.
It discovers all published pages from one validated content snapshot and produces
39 complete HTML documents, including all 15 blog articles. The gallery remains
request-rendered so its photo selection can change.

`scripts/build-web.ts` chooses the build source:

- On Vercel, read the published backend API using the existing server-only
  `BACKEND_ORIGIN`, `BACKEND_API_TOKEN`, and optional protection-bypass secret.
  A failed request or invalid content fails the build; sample content is never
  substituted for a failed hosted read.
- Locally, use `BACKEND_ORIGIN` if explicitly configured; otherwise use the
  checked-in development content. The build reports which source was used.
- `SITE_ORIGIN` and `ALLOW_INDEXING` determine generated canonical URLs and
  indexing tags. Changing the final domain requires a new build.

The generated HTML is packaged inside the frontend server function, alongside
a content revision and environment manifest. It is deliberately kept out of
public static assets. Before serving a generated document, the runtime reads
current published content and checks its revision, origin, indexing mode, and
whether that page still exists. Matching pages use their build-time HTML.

When content changes, the same React Router loaders and SEO code generate fresh
HTML. A bounded cache of 100 documents per warm function avoids repeating that
render for the same content revision. The revision compares sorted object keys,
so PostgreSQL JSON ordering cannot cause false changes. Any changed content
invalidates that instance's cached documents; publication is checked first.

This is **SSG with application-managed regeneration**. It does not use Vercel's
durable ISR cache. Runtime cache entries can disappear on a cold start, and each
HTML request still checks the backend. This trades some static-hosting speed and
offline availability for reliable publication checks and simple deployment in
the existing single React Router function. It does not add a framework or cron.

The backend's existing 30-second content cache bounds normal edit visibility.
Regeneration happens on the next request after fresh content is available.
There is no background job rebuilding unvisited pages. If the backend is
unavailable, the runtime returns the existing safe 503 rather than serving a
potentially unpublished document. React Router data requests, redirects, query
URLs, error responses and gallery requests remain dynamic. Stale `.data` files
are removed from static output, so browser navigation gets current loader data.

The response header `X-Roniella-Render` identifies `static`, `regenerated`, or
`cached` documents. Dynamic gallery/data/error/redirect responses omit it.

## Owner publishing behavior

Migration `20261102000400_editor_seo_defaults.sql` makes `seo_title` optional.
The database projection preserves any custom title; otherwise it supplies
`ordinary page title | business name`. The frontend derives a missing description
from the page's text and generates canonical, social and schema tags centrally.

Publishing an article automatically adds it to the blog listing; publishing a
tour adds it to the tours listing. Existing curated card ordering and summaries
retain priority, and newly discovered pages follow them. Unpublished pages drop
out of these listings, navigation/featured references, redirects and sitemap.
Their URLs return 404 after the content cache refreshes, even if those pages
were included in the original SSG build. New routes render without a deployment.

Homepage featured tours and articles now resolve directly from `content_featured`,
including newly published pages that were never in the imported homepage cards.
Selecting a featured tour therefore does not require a second hidden homepage
card entry. New destinations use their actual title and assigned photo/placeholder.

The future editor still needs to collect a title, unique ASCII path, page type,
content, publication choice and display order. No editing interface is added in
this task. Paths should remain stable after publication; if a future editor
renames a path, it must create an old-to-new redirect in the same publishing
operation. Removing a page returns 404; it does not invent an unrelated redirect.

## Existing site comparison

Read the raw production HTML for the homepage, tours listing, blog listing and
all 15 articles linked from the blog on 2 November 2026. This inspected title,
meta, canonical, JSON-LD, main headings and article links directly from HTML,
without depending on post-load JavaScript. The original WordPress site was
not changed. This audit did not use Search Console or establish traffic counts.

Evidence: ignored `.qa/legacy-seo/report.json` and 18 original HTML files.
Repeat with `node scripts/audit-legacy-seo.mjs`.

- All 18 original page titles are preserved exactly in the rebuild.
- Four article meta descriptions were present; all four are preserved.
  The homepage description was corrected at the user's request to use the
  current business name. The other 13 inspected pages had no saved description;
  they receive the existing content-derived fallback.
- All 15 original author names were verified through Article/Person JSON-LD,
  imported as editable optional fields, and linked to the corresponding local
  author archives. Migration `20261102000500_verified_article_authors.sql`
  fills missing authors while preserving any already assigned by an editor.
- All original article publication/modification dates match the local values,
  including absent dates. Valid dates are emitted without inventing missing ones.
- The existing public Google Search Console verification meta tag is preserved
  in editable copy slot `seo.googleVerification`. Author meta tags and valid
  article publication/modification social tags are preserved alongside schema.
- The old schema labels the Hebrew pages `en`; the rebuild uses `he` and
  `he_IL` for social metadata. Its canonical, social, breadcrumb and schema
  references consistently use the configured origin and current page path.
- The old WordPress SearchAction is not carried over because the rebuild does
  not implement site search. Article images only claim assigned local imagery;
  social cards can use the existing shared brand photograph. Original WordPress
  image/logo URLs have not been hotlinked or imported in this task.

All 15 articles have mapped ASCII paths:

| Current rebuild path | Original title preserved |
| --- | --- |
| `/blog/uzbekistan-silk-road/` | Yes |
| `/blog/china-cultural-journey/` | Yes |
| `/blog/china-experience/` | Yes |
| `/blog/beijing/` | Yes |
| `/blog/athens/` | Yes |
| `/blog/ancient-china-facts/` | Yes |
| `/blog/ancient-greece-facts/` | Yes |
| `/blog/cairo/` | Yes |
| `/blog/pyramids/` | Yes |
| `/blog/aswan-dam/` | Yes |
| `/blog/alexandria/` | Yes |
| `/blog/dendera-zodiac/` | Yes |
| `/blog/memphis-saqqara/` | Yes |
| `/blog/hanging-church/` | Yes |
| `/blog/abu-simbel/` | Yes |

The `%D7...` appearance of Hebrew links is ordinary URL encoding, not a metadata
defect. The rebuild retains the existing 72 permanent legacy redirects,
including these article paths, `/בלוג/` → `/blog/`, and `/הטיולים-שלנו/` →
`/tours/`. At domain cutover these redirects must be served on the original
business domain; a working Vercel alias alone does not redirect old search links.

## Build and deployment

Existing Vercel build commands automatically include SSG; no new environment
variables are required on the hosted frontend. The existing API token must be
available to builds as well as runtime. Never prefix server credentials `VITE_`.

From the repository root, run `npm.cmd run check:vercel`. For a local prebuilt deployment,
set the intended public origin before building so its HTML is reusable online:

```powershell
$env:SITE_ORIGIN = 'https://roniella-web.vercel.app'
$env:ALLOW_INDEXING = 'false'
npm.cmd run build:vercel
```

Local file content can differ from Supabase; in that case the runtime immediately
regenerates from Supabase instead of serving the mismatched snapshot. To generate
directly from Supabase-backed content locally, also supply `BACKEND_ORIGIN` and
the existing server API token in the terminal environment. A Vercel hosted build
already has those settings and reads the published backend automatically.

Deploy the backward-compatible API and frontend **before** applying the new
database author fields. Both older applications validate a stricter response
shape; updating both first avoids that compatibility gap. The user manages
these actions:

```powershell
npx.cmd vercel deploy --prebuilt --prod --cwd back
npx.cmd vercel deploy --prebuilt --prod --cwd front
npx.cmd supabase --workdir database db push --remote --skip-vault
```

The pending migrations are the prior brand correction (003), editor SEO defaults
(004), and verified authors (005). Do not include seed data on the existing
database. No frontend or backend content writes occur during builds.

The current Vercel review site remains deliberately **noindex**. At business-domain
launch, use `DEPLOYMENT_ENV=production`, `ALLOW_INDEXING=true`, and
`SITE_ORIGIN=https://roniellatours.com` for the build and runtime, then rebuild and
deploy. Verify redirects, robots, sitemap and canonicals on that domain. Search
Console submission and ranking/traffic monitoring remain business launch steps.

## Validation

The deployment integration suite checks every existing page and all 72 redirects,
all 39 generated HTML artifacts, and the exact byte-for-byte static response. It
also exercises regenerated/cached responses, an edit to generated content,
publication without custom metadata, a curated title override, automatic blog
and tour discovery, unpublishing a generated page, React Router data requests,
sitemap updates, gallery/media, preview indexing guards and backend outage
recovery. No hosted CDN runtime or Google rich-result eligibility is asserted.

Completed checks: `npm run check:vercel` (TypeScript, 30 tests, database/seed
verification, production builds, standard and Vercel integration suites), then
TypeScript/build/Vercel integration rechecks after final cache and featured-card
changes. A hosted-style build using a local authenticated API fixture verified
one snapshot fetch and the intended Vercel canonical origin. Desktop/mobile Chrome
checks covered five page types with JavaScript on/off (20 combinations), real
content without scripts, RTL, headings, overflow and captured browser errors.
Homepage photos loaded after scrolling. Screenshots were inspected locally in
`.qa/ssg-review/`. No live deployment was used to claim these results.
Run `npm.cmd run test:ssg:browser` after building to repeat those browser checks
with installed Chrome. An additional local PostgreSQL upgrade check applied the
three pending migrations to the original committed seed and matched the current
content exactly, including verified authors and the public verification tag.

## Files involved in this change

- `scripts/build-web.ts`, `front/react-router.config.ts`, `front/package.json`:
  snapshot loading and native SSG build orchestration.
- `front/app/server/generated-pages.server.ts`, `content.server.ts`,
  `config.server.ts`, `routes/content.tsx`: generation, publication checks,
  revision cache, consistent loader content and build/runtime settings.
- `front/app/entry.server.tsx`, `routes.ts`: shared renderer documentation.
- `scripts/build-vercel.mjs`: package generated HTML and check total function size.
- `shared/src/site-content.ts`: stable revision serialization and optional authors.
- `front/app/server/seo.server.ts`, `front/tests/seo.test.ts`: verified author
  graph nodes and SEO validation, extending the previous audit work.
- `front/app/components/editorial-pages.tsx`: resolve featured pages dynamically.
- `database/supabase/migrations/20261102000400_editor_seo_defaults.sql`,
  `20261102000500_verified_article_authors.sql`: title defaults, automatic listing
  discovery and verified optional article authors.
- `back/content/pages/blog-*.json`, `back/content/presentation.json`, `scripts/content-seed.ts`,
  `database/supabase/seed.sql`: preserve verified authors in local/bootstrap content.
- `scripts/deployment-e2e.ts`, `scripts/ssg-browser-review.mjs`, `scripts/audit-legacy-seo.mjs`: regression coverage
  and repeatable original-site metadata inventory.
- `.gitignore`, this guide and `documents/seo-ssr-audit.md`: generated-file
  exclusions and updated operational documentation.

Sources: [original homepage](https://roniellatours.com/),
[original tours](https://roniellatours.com/הטיולים-שלנו/),
[original blog](https://roniellatours.com/בלוג/),
[React Router pre-rendering](https://reactrouter.com/how-to/pre-rendering),
[Google URL migration guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).
