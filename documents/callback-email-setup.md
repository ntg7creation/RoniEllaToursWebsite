# Gmail notifications from the Vercel backend

Prepared 3 November 2026. No production deployment, Google account changes,
secret updates, DNS edits or real email sends were performed by the assistant.

The backend can send callback notifications through the existing Gmail account.
Vercel hosts the backend; Gmail delivers the message. No business-domain changes,
custom sender domain, Resend account or new Vercel project are needed.

## Activate delivery

1. Sign in to Google as **roniellatours@gmail.com**.
2. Enable [Google 2-Step Verification](https://myaccount.google.com/security).
3. Open [App Passwords](https://myaccount.google.com/apppasswords), create an entry
   named `RoniElla Vercel`, and copy its generated 16-character password.
4. From the repository root, add it to the **backend** project:

```powershell
npx.cmd vercel env add GMAIL_APP_PASSWORD --environment production --cwd back
```

Choose **Secret**, then enter the Google App Password. This is a dedicated app
credential, not the normal Gmail sign-in password. It belongs in Vercel's secret
store, not source files, client variables or chat.

The username and recipient both default to `roniellatours@gmail.com`. Optional
backend Config variables `GMAIL_USER` and `CALLBACK_EMAIL_TO` can override these;
they do not need adding for the requested setup.

Google only offers App Passwords on eligible accounts with 2-Step Verification.
If the option is unavailable, check Google's [account requirements](https://support.google.com/accounts/answer/185833).
No actual Gmail delivery has been verified without the account credential.

## Apply and deploy

New migrations:

- `20261103000300_callback_email_queue.sql`: private notification jobs, leases and delivery status.
- `20261103000400_callback_email_privacy.sql`: factual Gmail disclosure and a backward-compatible v2 consent record.

After adding the Secret, use the prepared artifacts or rebuild them before
deployment. A local frontend build should use the Vercel review origin:

```powershell
$env:SITE_ORIGIN = 'https://roniella-web.vercel.app'
$env:ALLOW_INDEXING = 'false'
npm.cmd run build:vercel
npx.cmd supabase --workdir database db push --remote --skip-vault
npx.cmd vercel deploy --prebuilt --prod --cwd back
npx.cmd vercel deploy --prebuilt --prod --cwd front
```

Hosted builds use the already configured backend settings. Email credentials
are runtime-only backend settings and are never baked into frontend builds.
Changing a Vercel environment variable requires a new backend deployment.

Submit one real callback after deployment and check the Gmail inbox and Sent
folder. SMTP acceptance is recorded as `sent`; it is not a guarantee of inbox
placement. Customer details also remain in Supabase `callback_requests`.

## Submission error diagnosed separately

The deployment logs for `roniella-khlly7q25-natais-projects.vercel.app` showed
`Bad Request` inside React Router's `singleFetchAction` on `POST /_.data`.
That stack location is its action-origin/CSRF check, before the callback backend
runs. The previous Node adapter derived an internal HTTP origin after Vercel
terminated HTTPS, so the browser's HTTPS Origin did not match.

`front/vercel-handler.mjs` now uses the existing underlying Node fetch adapter
with proxy handling enabled only under `VERCEL=1`, preserving Vercel's public
forwarded protocol/host. The request handler is wrapped so the adapter's client
address is not accidentally passed as React Router's load context. No wildcard
action origins or disabled CSRF protection were introduced.

The Vercel bundle integration test simulates TLS termination and a unique Vercel
hostname, verifies that a valid origin reaches field validation, and verifies
that an unrelated origin remains blocked. The frontend fix requires redeployment;
the missing email provider was not the cause of that page error.

## Delivery behavior

1. Validate the inquiry and save it privately in Supabase.
2. The database creates a private `callback_email_jobs` entry in the same transaction.
3. If Gmail is configured, the backend claims that job and awaits SMTP delivery
   over TLS to `smtp.gmail.com:465` before finishing the HTTP request.
4. Send a Hebrew HTML/plain-text message to the business, including name, callback
   phone/country, optional email, destination and source page. A supplied visitor
   email becomes Reply-To; no customer acknowledgement email is sent.
5. Mark successful SMTP acceptance and retain pending/failed status separately.

Failure to send a notification never discards a saved inquiry or asks the visitor
to resubmit a successfully saved inquiry. There are no fire-and-forget sends that
could be suspended when a Vercel function returns. No sensitive SMTP errors or
credentials are logged or exposed to visitors.

## Pending mail and safe retries

Review `callback_email_jobs` in Supabase. It contains private operational status
and is excluded from the public content projection, HTML and client data.

- `pending`: not configured yet, or a definite temporary/configuration failure.
- `sending`: claimed for delivery, with a short lease preventing concurrent sends.
- `sent`: Gmail's SMTP server accepted the notification.
- `failed`: attempts exhausted, expired retry window or ambiguous SMTP outcome.

An authenticated backend-only endpoint can retry one due pending notification:
`POST /api/v1/callbacks/retry-notifications`, using the existing backend bearer
token. It returns operational booleans, not inquiry details. No automatic cron
schedule is installed. Retry backoff is five minutes, with a maximum of five
attempts and a 23-hour window after the first attempt.

SMTP does not provide an exactly-once delivery guarantee. A timeout after sending
DATA, or an expired sending lease, is marked `delivery_unknown` for manual review
rather than automatically risking duplicate notifications. Check Gmail Sent and
the inbox before manually resetting such a job. A stable Message-ID is supplied
for tracing, but it is not treated as a provider idempotency guarantee.

Already existing inquiries predating the email migration are not automatically
mass-emailed. The private callback inbox remains the source of truth.

## Validation

Tests use mocked SMTP delivery and local PostgreSQL only; they never use a real
App Password. They cover recipient/Reply-To, HTML escaping, stable message IDs,
authentication failures, uncertain delivery, private queue grants, atomic leases,
backoff, retries, successful status and exclusion from public content. Deployment
tests explicitly clear Gmail credentials to prevent accidental real sends.

Completed validation: TypeScript, all 36 automated tests, database/seed checks,
production builds, Vercel bundle integration (including HTTPS forwarded-origin
acceptance and unrelated-origin rejection), and desktop/mobile callback browser
checks with and without JavaScript. Prepared artifacts target the existing
Vercel review URL with indexing disabled. Real Gmail delivery remains untested
until the account's App Password is configured by the user.

Main files: `back/src/callback-email.ts`, callback API/store wiring,
`front/vercel-handler.mjs`, the two new migrations, the privacy page and seed,
`back/tests/callback-email.test.ts`, `scripts/deployment-e2e.ts`, workspace
package/lock files and `deploy/.env.example`.

Sources: [Google App Passwords](https://support.google.com/accounts/answer/185833),
[SMTP on Vercel](https://vercel.com/kb/guide/serverless-functions-and-smtp),
[Nodemailer Gmail guide](https://nodemailer.com/guides/using-gmail).
