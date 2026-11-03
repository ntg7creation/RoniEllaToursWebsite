# Two Vercel projects

Use the existing GitHub repository `ntg7creation/RoniEllaToursWebsite`, branch
`rebuild-deployment`, for both projects. The older apps on `main` are not this
rebuild. Supabase is already populated; do not repeat the initial seed.

These instructions prepare a review site on Vercel's own domains. Do not attach
`roniellatours.com` or change DNS until the review site is approved.

## Repository layout change

The application now lives at the repository root in `front/`, `back/` and
`database/`. Before the first push containing this move, open **Settings →
Build and Deployment → Root Directory** for each existing Vercel project:

| Project | Previous Root Directory | New Root Directory |
| --- | --- | --- |
| `roniella-api` | `rebuild/backend` | `back` |
| `roniella-web` | `rebuild/frontend` | `front` |

Save both settings and keep **Include files outside Root Directory** enabled.
Root Directory is a project setting, so moving or editing `vercel.json` cannot
change it. If dashboard overrides are enabled, use the install/build commands
in the table below. Remove any custom Ignored Build Step that still checks
the previous paths. Keep the existing project IDs, domains, environment variables
and Git production branch (`rebuild-deployment`) for this layout change.

Push the complete move together, including the root `package.json` and
`package-lock.json`, `shared/`, `scripts/`, and both application folders. Deploy
the backend first and then the frontend: the hosted frontend build reads the
published backend to generate HTML. If both Git builds start together, confirm
the frontend used the intended API release and redeploy it after the API if
needed. Check backend `/ready` and frontend `/health` after deployment.

The database files moved to `database/supabase/`; this move does not change the
hosted database or require reapplying existing migrations or the seed. For future
Supabase operations use `npm.cmd run db:cli -- <command>` from the repository root.

## Import settings

Import the same repository twice in the same Vercel team, backend first:

| Setting | Backend | Frontend |
| --- | --- | --- |
| Suggested project name | `roniella-api` | `roniella-web` |
| Root Directory | `back` | `front` |
| Framework Preset | **Other** | **Other** |
| Include files outside Root Directory | **Enabled** | **Enabled** |
| Node.js | **24.x** | **24.x** |
| Install Command (provided in vercel.json) | `cd .. && npm ci` | `cd .. && npm ci` |
| Build Command (provided in vercel.json) | `cd .. && npm run build:vercel:api` | `cd .. && npm run build:vercel:web` |
| Output Directory | Leave override **off** | Leave override **off** |

Check the selected source branch and commit before deploying. Use
`rebuild-deployment` as these new projects' Production Branch while reviewing
this version. In each project's **Settings → Environments → Production →
Branch Tracking**, set the branch to `rebuild-deployment` and save. If the import
screen defaults to `main`, change that setting and create a deployment from
`rebuild-deployment`. A project built from `main` will not contain the rebuild.

A Git-triggered deployment labeled **Preview** does not replace the stable
Production URL and uses Preview environment variables. Check Branch Tracking if
pushes to this branch should update the existing Vercel review site.

Vercel's **Production** environment means its stable project URL. It does not
mean the existing business domain has moved. Keep our app's
`DEPLOYMENT_ENV=preview` and `ALLOW_INDEXING=false` even for that stable Vercel URL
until the actual domain cutover.

Both apps depend on `shared/`, root build scripts and the workspace lockfile,
which is why including files outside each Root Directory is required.

Both `front/package.json` and `back/package.json` explicitly declare
`engines.node: "24.x"`. Vercel reads the package inside each configured Root
Directory when selecting the build runtime; the root workspace's engine range
and `.nvmrc` alone do not pin both Vercel projects. Keep these app declarations
aligned with the root Node 24 requirement and the generated `nodejs24.x` functions.
This package setting takes precedence over the dashboard's Node.js version.
See [Vercel's Node.js version overrides](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions#version-overrides-in-packagejson).

## 1. Backend environment and deployment

Generate a shared API token on your computer:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Add these values to `roniella-api` in Vercel. Select both Production and Preview
environment scopes if both will use this database:

| Variable | Value |
| --- | --- |
| `DEPLOYMENT_ENV` | `preview` |
| `CONTENT_PROVIDER` | `supabase` |
| `SUPABASE_URL` | `https://gmtguregvyuznaueqprk.supabase.co` |
| `SUPABASE_SECRET_KEY` | Your Supabase server secret key, starting with `sb_secret_` |
| `BACKEND_API_TOKEN` | The generated token |
| `SUPABASE_TIMEOUT_MS` | `8000` (optional; default) |
| `CONTENT_CACHE_MS` | `30000` (optional; default) |

Get the server key from the Supabase project's API Keys settings. It is not the
project reference, database password, or browser/publishable key. Enter it only
in the backend's environment settings. Do not paste secrets into Git or chat.

Deploy the backend. Visit its `/ready` endpoint: it should return
`{"status":"ready"}`. This verifies the live read function and confirms that
all database image references are present in this backend release. `/health`
only checks the handler; it does not verify Supabase.

The content endpoint `/api/v1/content` returns 401 without the shared token.
This is expected. The published travel photographs under `/photos/` are public
static assets, not protected content.

Copy the actual stable backend origin shown in Vercel, such as
`https://roniella-api-<your-suffix>.vercel.app`. Do not assume the suggested name
is available or use a dashboard URL.

## 2. Frontend environment and deployment

Add these to `roniella-web`, again for the intended Vercel environment scopes:

| Variable | Value |
| --- | --- |
| `DEPLOYMENT_ENV` | `preview` |
| `ALLOW_INDEXING` | `false` |
| `BACKEND_ORIGIN` | The actual backend HTTPS origin, without a path |
| `BACKEND_API_TOKEN` | Exactly the same generated token as the backend |
| `CONTENT_TIMEOUT_MS` | `12000` (optional; default) |

Leave `SITE_ORIGIN` unset for the first preview: the app uses Vercel's supplied
deployment URL for canonical links while indexing is disabled. Later you may
set it explicitly to the stable review URL. Production indexing always requires
an explicit HTTPS `SITE_ORIGIN`.

If Vercel Authentication protects the backend URL, generate a **Protection
Bypass for Automation** secret in the backend project's Deployment Protection
settings. Set that value as **`BACKEND_VERCEL_BYPASS_SECRET` on the frontend**.
This is separate from `BACKEND_API_TOKEN`. The frontend sends it only in a
server-side header to the configured backend; it is never placed in HTML,
client JavaScript, image URLs, or query strings. This also allows photo fetching
from a protected backend deployment. Do not copy the frontend's own bypass
secret by mistake.

Deploy the frontend and check `/health`, homepage, a tour, an article, and
`/gallery/`. All should load with images. `/robots.txt` should disallow crawling,
and `/sitemap.xml` should return 404 while `ALLOW_INDEXING=false`.

Initially, frontend previews deliberately use the stable backend origin set
above. If testing an incompatible API change, deploy that backend branch and
set `BACKEND_ORIGIN` to its matching preview URL in a branch-scoped frontend
environment override, along with the appropriate protection secret. Compatible
text-only changes appear at runtime without either project's rebuild.

## What the builds produce

Each project's build generates its own ignored `.vercel/output/` directory,
using Vercel's documented Build Output API v3:

- Frontend: one Node 24 SSR function and static client JS/CSS/fonts. All content
  URLs, redirects, resource routes, data requests and 404s go to React Router.
  Generated HTML is packaged inside the function and checked against current
  published content before use; gallery pages remain dynamic. There is no SPA
  fallback. See [content publishing](ssg-and-content-publishing.md).
- Backend: one Node 24 Express API function and `/photos/` static image files.
  Only image filenames are embedded in the function. Runtime text comes from
  Supabase, and no source JSON, SQL seeds, passwords, or album bytes enter it.
- Images retain their `/media/...` website URLs. The SSR resource route requests
  the authenticated backend media endpoint, follows only its exact approved
  same-origin `/photos/<filename>` redirect, and streams the image. Local/Docker
  file serving still works. The frontend deployment contains no travel photos.

Photo responses still pass through the frontend function. The build rejects
individual photos over 4,000,000 bytes to stay below Vercel's 4.5 MB response
limit. For substantially larger images/videos, move to direct object-storage
delivery rather than raising that limit. Static backend photos can be requested
directly if their URLs are known; they are intended for the public website.

The explicit output format preserves React Router **8.5.0**. At preparation,
`@vercel/react-router@1.3.7` declared React Router 7 peers, so the app uses its
existing official Node request listener instead of installing an incompatible
adapter or downgrading the router. `esbuild@0.28.2` packages the handlers with
their runtime dependencies. Environment secrets are read at runtime, not
compiled into build output. Builds do not run migrations or write to Supabase.
Hosted frontend builds read published content through the authenticated backend;
local builds use local content unless `BACKEND_ORIGIN` is set.

## Local checks

From the repository root:

```powershell
npm.cmd ci
npm.cmd run check:vercel
```

This runs TypeScript, unit tests, real PostgreSQL migration/content checks,
normal production builds and integration checks, then generates both Vercel
artifacts and runs those exact function bundles through a local HTTP harness.
The latter covers all 40 pages, 72 redirects, live database edits, new page
publication, draft filtering, SEO, gallery media, static assets, data requests,
protection-header forwarding and database outage recovery. No hosted database
or Vercel account is contacted by these tests.

The harness is not an emulator for Vercel infrastructure. Hosted routing,
deployment protection, regions and account configuration must still be checked
after your first real deployments. Choose a function region near the Supabase
project for both services.

## Updates and domain cutover

Once the projects are linked, pushes to their configured branches can trigger
Vercel deployments. Keep database changes backward compatible across releases.
For photo updates, sync the album and deploy the backend's new static files
before applying the reviewed gallery metadata SQL. The existing
[deployment guide](deployment.md) covers that workflow and backups.

After approving the review site, attach the business domain to the frontend
project and complete DNS/TLS setup yourself. Then set frontend
`DEPLOYMENT_ENV=production`, `SITE_ORIGIN=https://roniellatours.com`, and
`ALLOW_INDEXING=true`, redeploy, and verify canonicals, robots and sitemap.
The backend remains noindex regardless of its app environment label.

References: [Vercel monorepos](https://vercel.com/docs/monorepos),
[files outside the Root Directory](https://vercel.com/docs/monorepos/monorepo-faq),
[Build Output API](https://vercel.com/docs/build-output-api),
[function/static primitives](https://vercel.com/docs/build-output-api/primitives),
[protection bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation),
[function limits](https://vercel.com/docs/functions/limitations).
