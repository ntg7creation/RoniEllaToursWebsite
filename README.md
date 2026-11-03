# Roniella Tours

Development and builds run from this repository root. The current application
has three main folders:

| Folder | Purpose |
| --- | --- |
| `front/` | React Router frontend, server rendering, components and assets |
| `back/` | Express API, content adapters, callback handling and local photos |
| `database/` | Supabase configuration, SQL migrations and initial content seed |

`shared/` holds schemas and URL helpers used by both applications. `scripts/`,
`deploy/`, `documents/` and `docs/` hold build tools, deployment configuration,
guides and source evidence. Dependencies use one root workspace lockfile.

The previous application directories and the `rebuild/` wrapper were removed.
Before pushing this layout, change the existing Vercel projects' **Root Directory**
to `back` for `roniella-api` and `front` for `roniella-web`, with **Include files
outside Root Directory** enabled. The checked-in `vercel.json` files still run
installation and builds from the parent repository root. See the
[migration instructions](documents/vercel-deployment.md#repository-layout-change).

**Vercel:** [two-project import settings and environment variables](documents/vercel-deployment.md).
Use `npm.cmd run check:vercel` to build and test both deployable artifacts locally.
The GitHub branch for this rebuild is `rebuild-deployment`.

**Deployment preparation:** [frontend/backend/Supabase deployment guide](documents/deployment.md). The project includes a PostgreSQL content schema, an initial content seed, a Supabase repository adapter, separate Docker targets, Compose/HTTPS examples and a validation-only CI workflow. Connected Vercel projects deploy from their configured Git branch once the project root settings match this layout. `npm.cmd run check:deployment` validates the setup locally.

Local development runs from **editable JSON files and photos in [`back/content/`](back/content/README.md)**: 40 pages, six distinct tours, 15 articles, five guide biographies, policies, destination/category/author archives, contact details and navigation. Hosted deployments use Supabase through the same API. Text was freshly copied from the public site on **2 November 2026**. The April Uzbekistan itinerary now includes Khiva and nine days.

The visual direction now follows the supplied **Modern Tour Company Website Figma export**: forest masthead/footer, cinematic photograph/gradient, gold calls to action and varied editorial sections. Regular Hebrew text uses **Assistant 400**, paired with Frank Ruhl Libre display headings. Explicit Home navigation is present. See the [latest Figma/content/SSR update](documents/local-content-and-figma-update.md). The [11-site research](documents/design-research.md), [first redesign](documents/redesign-review.md) and [two-page prototype](docs/editorial-prototype.md) remain historical design context.

## Run locally

Use Node **24 LTS**, minimum 24.11.0, and npm 11. From the repository root:

```powershell
npm.cmd ci
npm.cmd run dev
```

If a previous development process is running, stop it with Ctrl+C before restarting. `dev` builds the shared package and starts both processes:

| Process                                   | Development           | Production            |
| ----------------------------------------- | --------------------- | --------------------- |
| React Router Node SSR frontend, with Vite | http://127.0.0.1:5173 | http://localhost:3000 |
| Express public content API                | http://127.0.0.1:3001 | http://127.0.0.1:3001 |

Open the frontend address. Example real pages:

- http://127.0.0.1:5173/tours/
- http://127.0.0.1:5173/tours/china-may-2027/
- http://127.0.0.1:5173/tours/uzbekistan-march-2027/
- http://127.0.0.1:5173/blog/uzbekistan-silk-road/
- http://127.0.0.1:5173/guides/
- http://127.0.0.1:5173/prices-and-terms/

Production builds and the two production processes:

```powershell
npm.cmd run build
npm.cmd start
```

For production URLs replace `127.0.0.1:5173` with `localhost:3000`. Stop processes with Ctrl+C. The frontend uses the real React Router Node renderer, not Vite preview or a static SPA fallback.

## Backend and data flow

1. `back/src/content-repository.ts` reads `back/content/index.json`, `pages/*.json`, settings, redirects, presentation copy and media metadata at startup. It validates links, media assignments, filenames and real filesystem boundaries.
2. The original archive reader is retained separately in `archive-repository.ts`; it is not the runtime database. Source snapshots, legacy scripts/forms and private implementation evidence are not served. Distinct dated tours remain separate.
3. `GET /api/v1/content` returns schema version 2 with public text, presentation and photo metadata. `contentSource: "liveArchive"` describes its public-site provenance. `GET /api/v1/media/:filename` serves only registered photos. The backend's `/health` checks liveness and `/ready` checks validated content readiness. Hosted API routes require the shared frontend/backend token. The private callback submission and email queue routes are described in the [callback guide](documents/callback-form.md) and [email setup](documents/callback-email-setup.md).
4. Frontend **server loaders** request and validate the content, then React renders text, itinerary/terms, metadata and image URLs into complete HTML. `/media/:filename` streams the backend photo through a same-origin resource route. No travel photos are copied into frontend public/build. The browser does not need the separate API origin; content and images work without browser JavaScript.

The `ContentRepository` interface remains the storage boundary. `CONTENT_PROVIDER=files` uses the local folder; `CONTENT_PROVIDER=supabase` uses the read-only database adapter. The original `back/fixtures/demo-content.json` and version-1 domain schemas are retained only for regression tests and later domain-model work, with **no runtime fallback**. Old demo URLs return 404. Pages and redirects now resolve at runtime, so valid new database pages require no frontend rebuild.

## Edit content, paths and appearance

In file mode, edit **[`back/content/`](back/content/README.md)**. Page filenames are readable (for example `pages/tours-china-may-2027.json`); homepage display copy is in `presentation.json`, photography/credits in `media.json`, and actual JPEGs in `media/`. Preserve stable IDs and saved public paths. Development watches JSON edits and restarts the API; refresh the browser. File-mode production needs an API restart after edits. Page content and new/changed paths need no frontend rebuild because routes resolve through the API at runtime. In Supabase mode, edit the corresponding database rows; the default cache refresh is 30 seconds. Do not edit source snapshots as application content.

All successful archived paths now work locally. Legacy Hebrew paths and observed public query aliases redirect once to their actual existing destination. Routing query parameters are removed on redirect; other parameters/fragments remain meaningful. Unknown paths stay 404. Shared URL helpers are in `shared/src/archive-urls.ts`; titles never generate slugs. The frontend keeps React Router discovery/data handling enabled.

For appearance, start with **`front/app/design.css`** (shared tokens/compositions), **`editorial-pages.tsx`** (homepage and April tour) and **`travel-visuals.tsx`** (backend-driven photograph/credit rendering). `styles.css` retains archive structure; `editorial.css` retains tour interactions and print rules. Display copy stays separate from SEO titles. Fonts/licenses remain in `front/public/assets/fonts/` and `assets/editorial/`; photographs/provenance are in `back/content/media/`. The running website makes no requests to Google Fonts or an external image host.

For archive templates, edit **`front/app/components/archive-content.tsx`** and their shared rules in `design.css`. `content-sections.ts` groups validated source blocks for presentation; `archive-blocks.tsx` renders the safe block union. Hebrew RTL, real links, one H1, the skip link and visible keyboard focus remain.

The homepage now introduces trips, guides, reviews and articles in distinct sections. Tour pages have a trip summary, section links, a day-by-day expandable itinerary, visible pricing and separately expandable terms. Guides have individual profile cards. Articles have readable text widths and section navigation, collapsed on mobile. Native disclosure controls work with JavaScript disabled; the complete itinerary and terms remain in SSR HTML. Original content files and source facts are preserved.

The imported content is source evidence, not newly approved travel/legal information. Exact conflicting prices/dates/guide names remain unaltered; no invented prices or departure records fill gaps. The April prototype marks precise dates, duration, guide assignment and price as awaiting approval, with original wording in labeled source disclosures. Source-content notices and noindex remain. Legal text has a review notice. Nine text reviews are available on the testimonials page; the homepage selects two. Image-only testimonial transcriptions and approved guide portraits remain deferred. Videos use external links; contact uses phone/email links without forms.

## Configuration

Local file mode requires no credentials or `.env` file. Hosted Supabase settings are in the [deployment guide](documents/deployment.md). Basic server-only settings:

| Variable             | Default                     | Purpose                                                                                        |
| -------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `BACKEND_ORIGIN`     | `http://127.0.0.1:3001`     | Frontend-to-API origin; never exposed as a `VITE_` variable                                    |
| `SITE_ORIGIN`        | `http://localhost:3000`     | Absolute canonical origin; set to `http://127.0.0.1:5173` when checking development canonicals |
| `CONTENT_TIMEOUT_MS` | `12000`                     | Frontend API request timeout, integer 1–30000                                                  |
| `API_PORT`           | `3001`                      | API loopback port                                                                              |
| `CONTENT_DIRECTORY`  | `back/content/`          | Optional backend content-folder override; source archive is not a runtime dependency             |
| `PORT` / `HOST`      | React Router serve defaults | Frontend production listen settings                                                            |
| `ALLOW_INDEXING`     | false/unset                 | `true` requires `DEPLOYMENT_ENV=production` and an HTTPS `SITE_ORIGIN`                           |

Frontend documents/data use `Cache-Control: no-store` and default `X-Robots-Tag: noindex, nofollow`. The read-only API is also noindex. Source indexing directives never override staging protections. API failure, malformed data or timeout produces a useful frontend HTTP 503; missing records produce 404.

## Verify

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run smoke
npm.cmd run smoke:browser
npm.cmd run test:e2e
npm.cmd run test:editorial
npm.cmd run test:design
npm.cmd run test:files
```

The HTTP smoke starts production processes on 3400/3401, checks all 40 real pages and original tour/article text outside serialized scripts, metadata, 72 one-hop aliases, 404s, no demo/forms and backend-failure behavior. Browser smoke uses 3500/3501 and installed Chrome/Edge on Windows (`BROWSER_PATH` can override), or installed Playwright Chromium. It checks JavaScript-disabled pages/navigation, all real pages at desktop/mobile widths, hydrated navigation, refresh, source fragments, focus and browser errors. The UX end-to-end test uses 3600/3601 and checks the home → tours → detail → pricing → contact journey at 1440px/390px, keyboard controls, full source tour text, guide profiles, section links and JavaScript-disabled disclosures/navigation. It saves screenshots and measurements under `.qa/ux-after/`. Keep test ports free. All test-owned processes are cleaned up. See [UX review](docs/ux-review.md) for findings and visual comparisons.

Archive-only validation/extraction commands are in the **[archive README](docs/live-site-content/README.md)**. You do not need the archive tooling or a live-site connection to run the application. The fresh November crawl's full-text fidelity checks passed for all 40 available pages with zero unmatched snippets.

`test:editorial` uses 3700/3701 for the two prototypes at 1440/768/390/320px. It checks actual font faces/weights, photos/credits, selected contrast/control sizes, 200% text enlargement, keyboard navigation, disclosures, itinerary controls, print visibility/state restoration/PDF, hydration and JavaScript-disabled navigation. Screenshots, a font specimen, print PDF and metrics go under `.qa/editorial/`. These checks are not a full accessibility audit or a user study.

Local asset files are sufficient to build/run without an asset download. Optional `node scripts/design-assets.mjs` re-downloads only the selected public photos/fonts, with timeouts/retries and recorded licenses/hashes. It requires network access and overwrites those known asset files. It does not run during startup or change the content archive.

See **[runtime integration](docs/archive-integration.md)**, **[verification history](docs/verification.md)** and the **[full URL map](docs/live-site-content/reports/url-map.csv)**.

## Structure and deferred work

`front/` contains the SSR routes/components/server HTTP client; `back/` contains HTTP handlers and content adapters; `database/supabase/` contains the database configuration, migrations and seed; `shared/` contains browser-safe schemas/types and URL helpers. Run Supabase commands from this root through `npm.cmd run db:cli -- <command>`; see the [database guide](database/README.md). The root archive has its own independent extraction tools.

`test:design` uses 3800/3801 and captures seven representative templates at 1440/1024/768/390/320px, checking Hebrew font families, a single H1 and overflow. Full-page captures load the below-the-fold photographs before capture. Artifacts go in `.qa/redesign/`. `node scripts/reference-research.mjs` regenerates the public reference research screenshots/measurements and requires network access. These are optional QA commands, not runtime dependencies.

`test:files` uses 3900/3901 and an isolated content-directory copy. It proves two edited JSON revisions render as complete SSR text/metadata without a frontend rebuild or browser JavaScript, verifies backend image delivery and explicit Home navigation, then removes its test-owned files/processes.

Deferred: approved guide portraits/testimonial transcriptions, editorial/legal review, source-conflict resolution, formal accessibility/user testing, and normalized Tour/Departure migration. There is no custom admin UI, browser authentication, uploads, registration/payments or analytics. Callback submissions and optional Gmail notifications are implemented; see the linked setup guides. Database releases remain explicit operations, separate from application builds.

Framework references checked for installed React Router 8.5.0: [runtime rendering](https://reactrouter.com/8.5.0/start/framework/rendering), [routing](https://reactrouter.com/start/framework/routing), [route modules](https://reactrouter.com/start/framework/route-module), [server entry](https://reactrouter.com/api/framework-conventions/entry.server.tsx).
