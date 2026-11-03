# SSR and SEO audit — 2 November 2026

Audited site: https://roniella-web.vercel.app/

## Online recheck — 3 November 2026 (Israel time)

The previously local SEO/SSG changes are now visible in the deployed site.
This recheck was read-only; no deployments, content edits or indexing-setting
changes were made by the assistant.

- All 40 content pages returned 200, with 40 unique expected titles, descriptions,
  one H1, Hebrew/RTL markup, correct canonical URLs, Open Graph metadata and
  valid linked JSON-LD. Schema page URLs and social URLs matched canonicals.
- All 15 blog articles include their verified author meta; all 40 pages preserve
  the Google verification meta. Sampled article publication/modification tags
  were present in the original HTML.
- All 72 configured legacy redirects returned their expected 301 destinations.
  No broken checked internal links/fragments, duplicate HTML IDs, orphan pages,
  or failed checked assets were found. The crawl inspected 70 resource responses,
  including expected robots/sitemap/missing-page probes.
- None of the 40 saved HTML responses contained the removed legacy business name.
- Live `X-Roniella-Render: static` responses were observed for the blog listing,
  tours listing and Uzbekistan article; warm responses also returned `cached`.
  This verifies the deployed generated-HTML path, not just the local build.
- Home, China tour, Uzbekistan article and gallery worked in Chrome with scripts
  disabled and enabled. Main content and one H1 were present in both modes, the
  native itinerary disclosure worked without JavaScript, and no page errors were
  captured. Desktop/mobile screenshots were saved; no new visual redesign was
  performed in this recheck. A Googlebot-user-agent request also returned full
  content, canonical and schema; it is not a Search Console indexing result.

**Indexing remains intentionally disabled on this review deployment:** all 40
pages send `X-Robots-Tag: noindex, nofollow`, robots meta is noindex, robots.txt
returns `User-agent: *` / `Disallow: /`, and sitemap.xml returns 404. Canonicals
currently use `https://roniella-web.vercel.app`. Business-domain indexing should
only be enabled as part of that domain's launch, using the settings below and
the SSG deployment guide. The current Vercel URL is not ready to attract organic
search traffic while those review settings remain in place.

Evidence: [.qa/seo-online-2026-11-03/report.json](../.qa/seo-online-2026-11-03/report.json),
[sampled response headers](../.qa/seo-online-2026-11-03/headers.json), 40 raw HTML
files, and desktop/mobile screenshots in the same ignored directory.

The remaining sections record the original 2 November audit and its local fixes.

Subsequent SSG and editor-publishing work is documented in
[SSG and content publishing](ssg-and-content-publishing.md). Follow that guide's
API → frontend → database migrations order for the combined changes.
The frontend-only deployment instructions below describe the original SEO audit.

The deployed site genuinely renders its content on the server. The audit found
metadata and internal-link gaps, which are now fixed in the local frontend and
packaged into its Vercel build. These frontend fixes have **not** been deployed
by the assistant. No hosted environment variables, database content, indexing
settings, custom domains, or DNS records were changed during this audit.

## Scope and evidence

- HTTP fetches of all 40 known published page routes, inspecting the original
  response HTML rather than relying on hydrated browser content.
- All 72 configured legacy redirects, including query-based aliases.
- All same-site links and fragment destinations found in those HTML documents;
  a link-graph traversal starting at the homepage.
- Referenced image variants, stylesheets, fonts/preloads and favicon through
  HTTP HEAD checks. The initial crawl checked 58 media URLs. Gallery sampling
  is randomized, so later asset counts can differ.
- Homepage, China tour, Uzbekistan article and gallery opened in installed
  Chrome through Playwright with JavaScript disabled and enabled. Native
  itinerary disclosure was also exercised without JavaScript.
- Desktop and mobile screenshots captured. The live mobile homepage screenshot
  was displayed and visually reviewed.
- Separate local integration tests exercised the production/indexable mode,
  since the hosted review site is intentionally noindex.

Local evidence is deliberately Git-ignored:

- [Original live audit](../.qa/seo-live/report.json), raw HTML per route, and
  [mobile screenshot](../.qa/seo-live/home-mobile.png).
- [Fixed local build audit](../.qa/seo-fixed/report.json), raw HTML per route,
  desktop and mobile screenshots.

The route inventory comes from the checked-in 40-page manifest, and the crawler
also follows additional internal links encountered. This was not an
authenticated inventory of unpublished Supabase rows.

## Findings and resolution

| Check | Live deployment audited | Local fix / verification |
| --- | --- | --- |
| HTTP responses | All 40 content pages returned 200 | Preserved |
| Server-rendered content | Real Hebrew content present before scripts execute | Preserved; verified again without JavaScript |
| Titles | 40 unique titles, one title per page | Preserved explicit database values |
| Canonical URLs | One per page, correct public path and configured Vercel origin | Preserved; sharing and schema URLs now use the same origin/path |
| Main headings | One H1 per page | Preserved |
| Language / direction | `lang="he"`, `dir="rtl"` | Preserved |
| Descriptions | Missing on 35 pages | Added content-derived fallbacks; explicit descriptions retain priority |
| Structured data | Absent from all 40 pages | Added connected Organization, WebSite and page nodes; breadcrumbs on internal pages and BlogPosting on articles |
| Open Graph / social cards | Absent from all 40 pages | Added title, description, canonical URL, site name, locale, image and Twitter card metadata |
| Fragment links | Seven rendered links had missing targets | Repaired contact/lead/footer targets and removed the obsolete Elementor popup behavior |
| Internal discovery | Six pages had no crawlable link path from the homepage | Added terms footer link and destination/author/category links on relevant listings |
| Images | Referenced assets loaded; all rendered images had alt and dimensions | Preserved; new social metadata dimensions match actual selected JPEG variants |
| Legacy URLs | All 72 returned expected 301 destinations | Preserved |
| Unknown page | Real HTTP 404 | Preserved; error pages noindex |
| Browser startup | No captured page errors on sampled pages | Preserved after changes |

The orphan pages were `/authors/oren-tal/`, `/authors/roni/`,
`/authors/yaniv-ozana/`, `/category/general/`, `/destinations/greece/`, and
`/prices-and-terms/`. The fixed build has no orphan pages within the audited
inventory.

The northern Greece source linked to a photo section that did not exist. It now
has an honest "photos will be added" section at that anchor; no unrelated tour
photographs were substituted. The old contact-page WhatsApp popup is now a
clearly labeled link to the actual contact section; no unverified WhatsApp
number was invented.

## Metadata behavior

`front/app/server/seo.server.ts` creates metadata from the validated runtime
content. A saved `seo_description` wins. If it is empty, a concise excerpt is
derived from the current page's text or listing content. This requires no seed
reimport or database schema changes. Curated descriptions can later be entered
in Supabase to override the fallback.

The schema graph uses stable absolute IDs for the organization, website, page,
breadcrumbs and article. `isPartOf`, `publisher`, `breadcrumb`,
`mainEntity`, and `mainEntityOfPage` references resolve to nodes in the same
graph. Breadcrumb items are real page URLs; the visible breadcrumb trail and
schema share their data source. Open Graph URL equals the canonical URL.

React Router serializes and escapes JSON-LD through its metadata API. Article
publication/modification dates are included only when valid. Author names,
ratings, availability, prices and offers are not invented. Article schema only
uses a page's assigned image. Social cards use that image or the site's existing
Samarkand photograph as a shared brand fallback; custom share artwork can be
added later. There is no false claim of a logo or search function.

The site is Hebrew-only, so alternate-language `hreflang` tags were not added.
There are no real translated URL equivalents to link. Existing route paths,
explicit titles, canonical behavior and SEO descriptions were preserved.

## Indexing and the final domain

The live site currently has:

```text
DEPLOYMENT_ENV=preview
ALLOW_INDEXING=false
SITE_ORIGIN=https://roniella-web.vercel.app
```

Observed behavior: robots meta and `X-Robots-Tag` contain noindex, `/robots.txt`
disallows crawling, and `/sitemap.xml` returns 404. These are the intentional
review-site settings, not a broken sitemap implementation.

The local production-mode integration test verifies that enabling indexing
produces the index/follow page metadata, a crawlable robots.txt referencing the
sitemap, and a sitemap with all 40 published canonical URLs. New published
database pages enter the sitemap at runtime; drafts disappear. Unknown pages
retain their 404/noindex behavior.

When the business domain is actually attached and ready to replace the old site,
set the **frontend** to the following and redeploy:

```dotenv
DEPLOYMENT_ENV=production
SITE_ORIGIN=https://roniellatours.com
ALLOW_INDEXING=true
```

Then recheck the final domain, HTTPS/host redirects, robots, sitemap, canonical
and social/schema URLs. Verify ownership in Google Search Console, submit the
sitemap, and use URL Inspection for representative pages. None of those hosted
account/domain actions was performed during this audit.

## Brand correction requested after the audit

The user requested removal of the imported legacy business name. Local content
now uses **טיולי העולם העתיק** throughout 14 affected pages, including article
and archive text, the terms page, and a rewritten homepage SEO description.
The outdated affiliation inside a customer quotation is omitted with `[…]`;
the quotation is not rewritten to claim the customer used the current name.

Migration `20261102000300_current_brand_copy.sql` updates 37 existing fields,
including a nested list item. Each update matches the exact old value so it
does not overwrite independently edited database copy. The bootstrap seed was
regenerated for new installations only. **Do not reseed the live database.**

Apply the pending migration from the repository root when ready:

```powershell
npx.cmd supabase --workdir database db push --remote --skip-vault
```

The assistant has not applied this hosted database change. With the current
SSR setup, database copy changes reach subsequent renders after the backend's
30-second content cache expires; this text update does not require a frontend
deployment. The separate SEO frontend fixes above still require deployment.

Verified locally: upgrading the old content produces exactly the corrected
content, repeating the update is harmless, independently edited copy survives,
all 30 automated tests pass, and database/seed verification passes. The command
above uses the installed Supabase CLI v3 syntax and does not include seed data.

### SSR versus automatic prebuilding

The current React Router configuration enables runtime SSR and does not enable
`prerender`. A Vercel `--prebuilt` deployment uploads compiled server functions
and browser assets; it does not mean all content pages have been generated as
static HTML. The backend reads Supabase and the frontend renders complete HTML,
including content and SEO metadata, before sending the response.

- **SSG:** generate page HTML during a build. Database edits require a new build
  to update those pages; a database edit alone is not a Git push/build trigger.
- **ISR:** cache generated HTML and regenerate it on an interval or on demand.
  This is not currently configured in our custom Vercel Build Output adapter.
- **Current SSR:** generate HTML on request using runtime database content.
  This already supplies crawlable HTML, without requiring SSG or ISR.

Keeping SSR currently preserves prompt editorial updates and server-randomized
gallery selection. If adding ISR later, keep gallery shuffle requests dynamic
and account for React Router data responses, SEO environment settings, error
responses and database changes in the cache/revalidation design.

References: [React Router pre-rendering](https://reactrouter.com/how-to/pre-rendering),
[Vercel ISR](https://vercel.com/docs/incremental-static-regeneration).

Also review the older date-sensitive descriptions, tour dates/prices and source
content notices before public launch. Metadata mechanics alone do not validate
the factual currency of the imported editorial content.

## Validation and limits

- TypeScript checks, all 30 automated tests, database migration/seed verification,
  normal production builds, and standard deployment integration checks passed.
- Both Vercel artifacts built. The actual bundled handlers passed the local
  integration harness, including 40 pages, 72 redirects, SEO, images, database
  edits/new routes, outage recovery and protection-header forwarding.
- The fixed local crawl reported zero findings for its metadata, internal URL,
  fragment, schema-reference and reachability checks across the 40 pages.
- Social image dimensions were compared with the actual backend JPEG bytes.
- No Google Rich Results Test, Search Console indexing result, external social
  sharing preview, full third-party link crawl or field Core Web Vitals report
  was obtained. JSON-LD syntax/reference checks do not guarantee a rich result
  or search ranking. Homepage HTML was about 388 KB uncompressed in the live
  audit; performance tuning is a separate opportunity, not an SSR failure.

The local fixed crawl preceded the final social-image dimension correction;
the correction was subsequently checked by unit tests and the Vercel bundle
integration tests. No link/page layout changes followed that crawl.

## Deploy and recheck

The current local frontend `.vercel/output/` contains the fixes. From the repository root:

```powershell
npx.cmd vercel deploy --prebuilt --prod --cwd front
```

Only the frontend needs redeployment for these SEO changes. This uses the
existing Vercel URL and existing preview/noindex settings. After deployment:

```powershell
node scripts/seo-audit.mjs https://roniella-web.vercel.app after-deploy
```

For a future fresh checkout, run `npm.cmd ci` and `npm.cmd run check:vercel`
before deploying the generated output.

## Files changed for this audit

- `front/app/server/seo.server.ts`: metadata and linked schema construction.
- `front/app/routes/content.tsx`: SSR metadata and consistent breadcrumbs.
- `front/app/components/archive-blocks.tsx`: obsolete popup link replacement.
- `front/app/components/archive-content.tsx`: missing section targets and archive discovery.
- `front/app/components/layout.tsx`: footer anchor and terms link.
- `front/app/design.css`: compact archive navigation styling.
- `front/tests/seo.test.ts`: metadata, references, dates and image-dimension checks.
- `scripts/seo-audit.mjs`: repeatable read-only live/local crawl and browser audit.
- `scripts/deployment-e2e.ts`: SSR descriptions, Open Graph and schema assertions.
- `package.json`: include frontend SEO tests in the existing test command.
- `documents/seo-ssr-audit.md`: this report.

The working tree also contains the earlier, already-deployed backend diagnostic
logging changes and Vercel-generated local ignore files. They are separate from
this frontend audit. No Git push was made, since the repository is now connected
to automatic Vercel deployments and the user is managing deployment.

References: [Google's JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics),
[breadcrumb markup](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb),
[article markup](https://developers.google.com/search/docs/appearance/structured-data/article),
[organization markup](https://developers.google.com/search/docs/appearance/structured-data/organization),
[Open Graph protocol](https://ogp.me/).
