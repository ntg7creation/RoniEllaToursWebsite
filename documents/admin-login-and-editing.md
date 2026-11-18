# Admin Google login and editing

Implemented 3 November 2026 and deployed 5 November 2026. All migrations through
`20261105000900_content_management.sql` are applied to hosted Supabase, and
the owner's requested first admin account is active. Frontend environment
variables, the Supabase site URL and callback allowlist are configured.
The live page is https://roniella-web.vercel.app/admin/login.
Google sign-in was enabled by the owner on 5 November 2026. A real Google login
reached the admin check and exposed a one-character mismatch between the supplied
allowlist email and the verified account. The allowlist was corrected and the
misspelled entry disabled. The owner must retry login to complete admin-session
and editing acceptance. The content-management extension was deployed later on
5 November. Its local browser tests cover authenticated trip and body edits;
live checks cover public rendering, Google redirects and unauthorized requests.
No synthetic trip or test edit was written to the hosted site.

Content release deployments: frontend `dpl_GiAYf52ufhUyNk1ajcC1xvLu2V1X` and
backend `dpl_w87SDAsn8sfCAhT2kHvX6pvv83m3`. Both stable Vercel aliases are ready.

## Experience

Give approved editors the unlisted address `/admin/login` on the stable website
origin. It is excluded from public navigation and the sitemap and marked noindex.
The URL is not the security boundary: both the frontend server and PostgreSQL
check the signed-in account and the current manual allowlist.

After Google sign-in, admins return to the existing website. Hebrew Edit buttons
appear beside editable sections. A dialog edits the actual text, saves to
Supabase, then refreshes the page content. The sticky navbar has an admin-only
logout button at the left. At extreme text enlargement, a header taller than
45% of the viewport stops sticking so it cannot obscure most of the page.

The editor supports page titles and search descriptions; paragraphs, headings,
list items and table text; homepage/tour/contact/team/footer copy; business
details and the site notice; navigation labels, card summaries and video text.
Existing gallery copy and photo alt controls are retained. Editors browse the
shared Google Drive folder for page covers, cards and article body images.
The thumbnail grid defaults to newest uploads first, with older uploads,
filename and modification-date ordering, 48-photo paging and manual refresh.
The existing three design images remain available on their own tab.
Body images support custom alt text, captions and left/right/full-width placement.
Contributors upload photos in Drive, then editors refresh the selector.

Drive release deployed 8 November 2026: migration
`20261108001100_drive_photo_links.sql`; API `dpl_HWdeDKWyV4WGP3xzE3azc2ntAz1o`;
frontend `dpl_4o2dgNuKRDdHfWAtBuESueyBnT2r`. The configured folder is
`https://drive.google.com/drive/folders/1TILL118zzozt6e6gTCO8_HA3HjN3wJNE`.
Its URL is stored in the private `site_media_library` row. Each chosen asset
stores the stable Drive file ID, original file-view URL, folder URL and metadata
in `content_media`; the page/body references that asset. No photo bytes are
saved to Supabase, the repository or deployment. A bounded, credential-free
proxy serves a resized Drive rendition through the existing media route.
Changing the library folder uses an optimistic lock and records edit history.
It does not change existing selected file links or Drive sharing permissions.

Folder discovery reads the anonymous public folder's embedded JSON without
executing scripts. It requires no Drive OAuth credentials or API key. This
public-page format is not a versioned API; changed or paginated responses fail
visibly instead of silently hiding files. Previously selected images resolve
by file ID independently of folder discovery. The Google Photos gallery,
cached gallery files and its shuffle behavior are unchanged.

The collection, itinerary, image and SEO extension was deployed 8 November 2026.
Migration `20261108001000_editor_collections_and_seo.sql` is applied to the
existing Supabase project. The API deployment is
`dpl_E5RU1y1XgcQ1mLRke6mbGHfvbM4U`; the frontend deployment is
`dpl_J75EFFb4Pb9UZfCfQGTiqpMihhUY`. Both stable aliases are ready.
Before/after snapshots verified preservation of all 15 content tables,
including 40 pages and 1,211 blocks. No bootstrap seed or hosted test records
were used. All 40 public pages, API readiness, guest editor restrictions and
preview indexing settings passed live checks. Authenticated editing was
verified locally with the real PostgreSQL functions and simulated Google consent;
the release did not modify business content to test live editing.

**ניהול יעדים** adds destination drafts, edits their name, description, date and
image, and removes/restores them. The home destination section and destination
pages use these same records. Dates accept exact dates, a month, free text such
as “טרם נקבע”, or an empty value. **ניהול מאמרים** provides the same draft,
publication and removal workflow for blog articles. Published articles appear
in the blog; the homepage displays the two newest featured articles.

**ימי המסלול** edits day titles and their content together, inserts days at a
chosen position, moves whole days and removes them. Stable anchors preserve day
grouping when a title no longer begins with “יום”. **אנשי הצוות** adds, edits,
reorders or removes complete guide profiles; the same profiles appear on the
homepage and guides page. Removed entries remain reversible until saving.

**SEO ותוויות** edits search title/description, topic labels, social sharing
title/description/image and per-page noindex. Article settings also expose the
author and publication date. Canonical URLs stay stable. Labels appear on the
article, in metadata and in BlogPosting structured data. Saved metadata uses the
existing content revision and regeneration path, so it appears in server HTML
on the next content-aware render and in subsequent static builds. The sitemap
omits pages marked noindex. This does not override deployment-wide noindex.

Use **ניהול טיולים** to add a trip. Enter its title, stable English URL slug,
summary, introduction and optional dates, duration, price, guide and status.
Creation saves a private draft. **פרטי הטיול** edits its metadata and card text;
**תוכן ומסלול** edits its body. **פרסום באתר** explicitly publishes it to its
own URL, the trips listing and homepage. **הסרה מהאתר** unpublishes it, removes
public references and returns 404 at its URL; the manager retains it for
restoration. No trip is permanently deleted by this interface.

Use **עריכת תוכן ומבנה** on any page to add, remove and reorder headings,
paragraphs and lists, or edit existing tables and nested list text. Section
anchors and inline links are preserved. The buttons beside individual blocks
open a smaller text editor. **טקסטים נוספים באתר** includes a searchable list
of presentation copy. Trip URLs and admin membership stay manual after creation.

Sessions use rolling 30-day, host-only HttpOnly cookies and Supabase refresh
tokens. HTTPS cookies are Secure and use the `__Host-` prefix; all use SameSite
Lax. No tokens are put in browser localStorage or public page HTML. Supabase's
session policy, revocation, cleared cookies or blocked cookies can end a session
earlier. Logging out ends the current device's Supabase session and clears its
cookies; other open tabs are notified. Other devices keep their own sessions.

## Hosted setup

Release status as of 5 November: the database, frontend variables, callback
allowlist, deployments and Google provider activation below are complete.
The instructions remain for maintenance or a replacement project. The deployed
login checks the provider's current setting on each attempt; provider activation
and manual allowlist corrections do not require another application deployment.

Use the existing Supabase project `roniella-tours`
(`gmtguregvyuznaueqprk`). Do not create a second content database or reapply the
bootstrap seed to the populated project.

1. Review the pending migrations and take a database backup using the existing
   release procedure. From the repository root, inspect with
   `npm.cmd run db:cli -- db push --remote --dry-run`. After review, apply pending
   migrations with `npm.cmd run db:cli -- db push --remote`. The new admin
   migrations are `20261103000800_admin_auth_and_editing.sql` and
   `20261105000900_content_management.sql`. Builds do not apply migrations automatically.
2. In Google Cloud / Google Auth Platform, configure the app's branding, audience
   and an OAuth **Web application** client. Use only basic identity scopes
   `openid`, email and profile. If the consent app is in Testing, add intended
   admins as test users. Follow Google's publishing requirements for the chosen
   audience before general use.
3. In the Google OAuth client, add this **Authorized redirect URI** exactly:
   `https://gmtguregvyuznaueqprk.supabase.co/auth/v1/callback`.
   This is Supabase's callback, not the site's `/admin/callback` URL. The app
   uses server redirects, so it does not need Google's browser One Tap script.
4. In Supabase **Authentication → Sign In / Providers → Google**, enable Google
   and enter the OAuth client ID and client secret there. Keep email verification
   enabled. Do not put the Google secret in this repository, browser code or chat.
5. In Supabase **Authentication → URL Configuration**, set the Site URL to the
   stable site origin. For the current review site, use
   `https://roniella-web.vercel.app`. Add this Redirect URL:
   `https://roniella-web.vercel.app/admin/callback`.
   The SDK adds a per-flow `sb_flow_id` query parameter; retain it through the
   redirect. Use Supabase's exact path allowlist, not a blanket wildcard across
   arbitrary Vercel projects. Use the stable domain for signing in.
6. In Vercel's **frontend** project `roniella-web`, set `SUPABASE_URL` to
   `https://gmtguregvyuznaueqprk.supabase.co` and `SUPABASE_PUBLISHABLE_KEY` to this
   project's publishable API key (a legacy `anon` key is also accepted). Keep
   `SITE_ORIGIN=https://roniella-web.vercel.app` for this release. Do not use
   `VITE_` prefixes or put `SUPABASE_SECRET_KEY` in the frontend. The backend
   retains its existing server secret for public content reads.
7. Add the actual admin Google email using the SQL below. The first account
   requested by the owner has been added manually; future accounts use the same
   procedure. No real admin address is inferred or seeded by migrations.
8. Deploy backend then frontend from the reviewed source. On the stable URL,
   complete the acceptance check below. A new deployment is required after
   changing Vercel environment variables. Unique deployment URLs redirect the
   login page to `SITE_ORIGIN` so cookies and callback origin remain consistent.

When the business domain is launched, update `SITE_ORIGIN`, Supabase Site URL and
the app callback allowlist together. The Google redirect URI stays on Supabase
unless the Supabase Auth domain itself changes. Cookies are host-only, so admins
sign in again when moving between domains.

Official references: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[server clients and cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[server-side Auth considerations](https://supabase.com/docs/guides/auth/server-side/advanced-guide),
[session lifecycle](https://supabase.com/docs/guides/auth/sessions).

## Manually manage admins

On 11 November 2026, `oren.tal@connvisor.com` and
`yaniv.ozana@connvisor.com` were added to the existing hosted project's
`public.site_admins` allowlist with `active = true`. A separate read-back
confirmed both entries. Each person still needs to complete their own Google
sign-in; no business content was changed for this access update.

Run as the project owner in Supabase SQL Editor. Replace the placeholder with
the person's exact Google email, normalized to lowercase. They can be added
before their first login.

```sql
insert into public.site_admins(email, active)
values (lower(trim('ADMIN_GOOGLE_EMAIL_HERE')), true)
on conflict (email) do update set active = true;
```

Revoke access without deleting content or edit history:

```sql
update public.site_admins
set active = false
where email = lower(trim('ADMIN_GOOGLE_EMAIL_HERE'));
```

Revocation is checked on every editor read/save and session check, even when the
browser has an unexpired session cookie. Existing tabs may show an old button
until their next check, but cannot save. A successful Google login by an account
outside this list creates no admin privileges. Do not grant browser roles direct
write access to the tables or add an admin flag to editable user metadata.

`site_edit_history` records the editor, field, old value, new value and time. It
is private and can be inspected by the project owner. There is no automated undo
UI; restoring an older value should still check the current value first.

## Local development

Ordinary file-mode development needs no Auth credentials and shows no admin
buttons. The editor writes to Supabase; to see those changes, run the backend
against the **same** Supabase project as frontend Auth. File mode intentionally
does not write JSON through this editor. Prefer an isolated development project.

For a hosted development Supabase project, enable Google there and allow
`http://127.0.0.1:5173/admin/callback`. Set these process environment variables
before `npm.cmd run dev`: `CONTENT_PROVIDER=supabase`, `SUPABASE_URL`,
`SUPABASE_SECRET_KEY` (backend), `SUPABASE_PUBLISHABLE_KEY` (frontend), and
`SITE_ORIGIN=http://127.0.0.1:5173`. Use the existing secure environment-loading
workflow; Vite `.env` files alone are not the documented source for server
`process.env`. Never commit a populated environment file. Local Supabase's
`config.toml` lists local callback URLs but does not enable Google automatically.

Container configuration accepts the same frontend Auth variables through
`deploy/compose.yml` and the commented example in `deploy/.env.example`.

## Security and publishing behavior

Google OAuth uses PKCE. The server verifies the user through Supabase Auth and
checks a matching verified Google identity. PostgreSQL independently checks the
Google identity, active allowlist entry and live Supabase session for each RPC.
Only the bounded admin functions are executable by authenticated users;
content, membership and history tables remain closed to direct browser access.
The public content backend retains its read-only grants.

All admin responses are private/no-store/noindex. POST mutations require a
same-origin Origin header. Field changes use explicit allowlists; trip and body
commands use bounded schemas and independent PostgreSQL validation. HTML and
membership are not editable. Changes are atomic, include expected-value or
page-revision conflict detection and are recorded in private history.
A conflict retains the draft and offers an explicit reload. Unknown save results
ask the editor to reload before retrying.

Admin identity is fetched separately from shared public HTML, preventing admin
controls or account details from being cached into visitor pages. Admin content
requests bypass the backend's public snapshot cache. Every public content read
also checks a monotonic database revision, so other serverless instances discard
stale snapshots immediately after a committed edit. Generated HTML is compared
against the current content hash and rendered again when needed. New trip paths
work without rebuilding the site. Already-open visitor pages update on their
next navigation/reload, not through live push notifications.

Migration `20261105000900_content_management.sql` adds trip details, publication
commands, body editing, private creation-request deduplication, revision tracking
and additional editable presentation text. It preserves existing content and
does not reapply the bootstrap seed. Existing-trip details are initialized from
their card text when first edited; owners should review dates and guide fields
alongside older itinerary/pricing prose before publishing changes.

## Validation and release acceptance

Photo editing also covers the fixed home hero, the “הגישה שלנו” photograph,
and the decorative photograph on the April tour. For the home hero, signed-in
editors use **עריכת תמונת הרקע** beside **עריכת פתיח דף הבית**. Elsewhere, use
**עריכת תמונה** directly on the photograph. Choose from the shared Drive folder,
then press **שמירת התמונה**. Each section saves its own assignment and revision;
removing a photograph retains the editor control so it can be added again.

On both the home page and `/guides/`, **עריכת איש הצוות והתמונה** opens the
corresponding guide. Use **תמונת איש הצוות**, then **שמירת תוכן העמוד**. Portraits
are stored in the existing shared guide profile and follow that profile when
reordered. Removing a portrait restores the initials. Drive source links and
temporary-photo license disclosures are no longer rendered by the website.
The file references and existing provenance metadata remain in the content
records; selecting a photo does not create a stored copy of its image bytes.

Reproducible local checks (no hosted writes):

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run db:verify
npm.cmd run test:admin:database
npm.cmd run build
npm.cmd run test:admin:browser
```

The browser test uses installed Chrome, temporary PostgreSQL and a local
GoTrue/PostgREST protocol double on ports 4900–4902. Google consent is simulated;
the application SDK, PKCE verification, cookies, refresh, SQL permissions, inline
editing and revocation use the real application flow. Screenshots and failures
are saved under ignored `.qa/admin/`. It does not prove that hosted Google
credentials or callback configuration are correct.

Local verification on 3 November 2026 passed 44 unit/API tests, the PostgreSQL
admin permission/conflict tests and the full browser flow. Browser checks include
PKCE, cookie persistence and refresh, unlisted accounts, CSRF rejection, edit
conflicts, revocation, logout across tabs, mobile overflow and automated axe
checks of the login and edit dialog. Screenshots were visually reviewed at
desktop and 320px mobile widths. These checks do not replace hosted acceptance.

After configuration and deployment, check with one allowlisted Google account
and one unlisted account: sign in, reload and reopen the browser, edit a harmless
agreed text field, restore it, confirm another tab sees the change, log out, and
confirm direct editor requests are denied. Remove an admin while signed in and
confirm their next save is rejected. Check the actual mobile navbar and keyboard
flow. Record the result before describing Google login as live.

## Deployment verification — 5 November 2026

- Backend: `dpl_GiE9ioJzAEh43tsvvV5G5MJuKYgZ`, stable alias
  `https://roniella-api.vercel.app`; tested build uploaded using the CLI.
- Frontend: `dpl_EdR4cQB8gcm5JbVyJbdWFxVEUxNP`, stable alias
  `https://roniella-web.vercel.app`; current workspace source built on Vercel
  using production environment variables. These CLI deployments did not commit
  or push the working tree to Git.
- Hosted build used Node 24 and generated 39 pages from the published backend.
  The database retains 40 published pages and all 123 gallery descriptions.
- Live checks passed for health, home, gallery, a tour, contact and admin login.
  The login response is private/no-store/noindex; anonymous editor reads and
  cross-origin saves are denied. The sticky header and narrow mobile login page
  were checked; no browser runtime errors occurred.
- Google remained disabled during verification. Clicking sign-in correctly
  displayed the setup-pending message. No real Google account was signed in and
  no hosted content edits or test emails were submitted.
- Ignored `.qa/deploy-admin-before.json` stores the pre-release content/admin/
  migration-history snapshot; `.qa/deploy-admin-live-results.json` and
  `.qa/admin/live-login-*.png` record the live review. `.vercelignore` excludes
  credentials, local backups and review artifacts from CLI source uploads.
