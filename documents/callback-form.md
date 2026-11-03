# Contact channels and callback requests

Implemented 3 November 2026. Prepared locally; no live deployment or database
update was performed by the assistant.

The main contact button now opens `https://wa.me/972505202480`. The existing
business number remains a `tel:0733744686` link and email remains a mail link.
Facebook and YouTube icons, with readable labels, appear beside each other in
the shared contact areas and footer. Their editable URLs are copy slots
`contact.whatsappUrl`, `social.facebookUrl`, and `social.youtubeUrl`.

## Form behavior

- Required: name, callback phone number, destination selection and privacy consent.
- Phone country defaults to Israel and can be changed. Country names and calling
  codes are displayed in a native select. `libphonenumber-js/max` checks the
  selected country's lengths and numbering rules on both client and server;
  accepted numbers are normalized to E.164 and saved with their country code.
- Email is optional. Supplied addresses are checked for syntax, common domain
  typos and server-side mail-domain DNS records. DNS errors give a retry message;
  an email can be omitted because the callback number is the required contact.
- Destinations come from published destination archive pages, plus an undecided
  option. The server validates the submitted choice against current content.
- The privacy checkbox starts unchecked and links to the site's `/privacy/`
  page. `/privacy-policy/` retains its existing redirect to that canonical page.
  The policy now contains factual details about callback collection and storage.
- Consent relates to responding to the inquiry; it does not sign up the visitor
  for marketing. The stored request includes policy version and consent time.
- Field errors are in Hebrew, associated with inputs, and focus is moved to the
  first error with JavaScript. Native POST submissions work without JavaScript,
  including server validation and preserved values on validation errors.
- Success is shown after storage acknowledges the request. Phone validation
  follows the user's choice of numbering checks without SMS; neither phone
  ownership nor individual email-mailbox ownership is claimed as verified.

The form is included in the shared editorial contact panel on the homepage and
tour pages and the general contact panel on the contact/other tour templates.
Generated HTML includes the form. Submission actions remain dynamic and are
excluded from the SSG document cache. React Router's normalized action URL is
used for source attribution; its internal `.data` URLs are not saved as sources.

## Storage and access

On Vercel, the authenticated backend calls `create_callback_request` using the
existing Supabase server credentials. New tables:

- `callback_requests`: private staff inbox containing contact details, selected
  destination, source page, consent, creation time and status.
- `callback_rate_limits`: short-lived hashed client identifiers and counters.

Both tables have RLS and deny anonymous/authenticated direct access. The server
role has only the required callback permissions; content tables remain read-only
to it. Requests never enter `read_site_content()`, SSG documents, sitemap, client
loader data or a public GET inbox endpoint. The backend logs no submitted PII.

Staff can review requests in **Supabase → Table Editor → callback_requests** and
mark their status `new`, `contacted` or `closed`. Subsequent Gmail notification
setup is documented in [Callback email setup](callback-email-setup.md). An owner
dashboard and SMS verification are not included.

There is an unadvertised honeypot, same-origin action checks, server input/body
limits, atomic database rate limiting (five accepted requests per client per
15 minutes), and UUID retry deduplication. The client identifier is hashed with
the existing interservice token; raw visitor IPs are not stored in the inbox.
Local development stores submissions in ignored `back/private-data/callbacks.jsonl`.
That file is not a public asset and is not used by Vercel.

## Deployment

No new hosted environment variables or service accounts are needed. The existing
Supabase server key and backend API token are used only by server code.

Run checks/builds from the repository root:

```powershell
npm.cmd run check:vercel
npm.cmd run test:callback:browser
```

For prebuilt deployment, build the frontend with the intended public origin and
indexing settings as described in `ssg-and-content-publishing.md`. The current
Vercel review site should continue using `ALLOW_INDEXING=false`.

This contact change's pending migrations are:

- `20261103000100_callback_requests.sql`: private inbox, rate limits and write RPC.
- `20261103000200_contact_channels.sql`: contact URLs and privacy disclosure.

For the already-updated online site, the user can apply these and deploy in order:

```powershell
npx.cmd supabase --workdir database db push --remote --skip-vault
npx.cmd vercel deploy --prebuilt --prod --cwd back
npx.cmd vercel deploy --prebuilt --prod --cwd front
```

No seed import is needed on the existing database. Builds and tests do not submit
requests to the live website or live database. Database and browser checks use
local test data only.

Validation passed: TypeScript, all 33 automated tests, database/seed round-trip,
production and Vercel builds/integration checks. Chrome tests exercised desktop
and mobile layouts, Israel/default country selection and a US length error,
phone/email/consent errors, successful submission, and the complete no-JavaScript
POST path. Screenshots are in ignored `.qa/callback-review/`.

## Main implementation files

- `shared/src/callback.ts`: phone/country validation, destination choices, URLs and shared types.
- `front/app/components/callback-form.tsx`, `social-links.tsx`, `callback.css`: accessible form and contact controls.
- `front/app/components/editorial-pages.tsx`, `archive-content.tsx`, `layout.tsx`: shared placement.
- `front/app/server/callback.server.ts`, `routes/content.tsx`: authenticated server action and country data.
- `back/src/callback-api.ts`, `callback-store.ts`, `app.ts`, `server.ts`, `vercel.ts`: validated private storage.
- `back/content/presentation.json`, `pages/contact.json`, `pages/privacy.json`, migrations and regenerated bootstrap seed: editable contact/privacy content.
- `back/tests/callback.test.ts`, `scripts/deployment-e2e.ts`, `scripts/callback-e2e.mjs`: validation, permissions, rate limits, submission and browser regression checks.
- Workspace package/lock files and `.gitignore`: phone validation dependency and ignored private development data.

References: [existing privacy policy](https://roniellatours.com/privacy-policy/),
[libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js),
[Vercel request headers](https://vercel.com/docs/headers/request-headers).
