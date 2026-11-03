# Callback form: frontend → backend → Gmail

The callback form sends an email to the business. Supabase is used only for
website content. Inquiry details are not written to a database or local files.

## Request flow

1. The frontend validates the name, country/phone, optional email, selected
   destination and consent. Destination choices come from published CMS content.
2. Its server action validates the submission again and calls the authenticated
   backend with the selected destination's display label. The API token stays
   server-side.
3. The backend independently validates the contact fields and checks a supplied
   email domain. Its email endpoint does not read the CMS or call a database RPC.
4. The backend awaits Gmail SMTP acceptance before returning success.
5. The form displays “תודה, הפנייה נשלחה!” only after successful sending.

The sender and recipient default to roniellatours@gmail.com. The visitor's
optional email becomes Reply-To; no acknowledgement is sent to the visitor.

## Failures and retries

Missing Gmail configuration, authentication failures and SMTP failures return
a visible error; they do not report that the inquiry was saved. Values remain in
the form so the visitor can correct them or contact the business by WhatsApp.

If the connection fails after sending, delivery may be uncertain. The form asks
the visitor to use WhatsApp before submitting again. There is no persistent
queue, background retry endpoint or automatic resend.

The backend keeps only temporary hashes, counters and completion promises in
process memory. It permits five new requests per client in 15 minutes and
suppresses duplicate clicks with the same submission ID within that process.
Vercel instances do not share this memory; these guards do not guarantee
exactly-once delivery across instances or restarts.

## Privacy and validation

Phone numbers are validated with libphonenumber-js and normalized to E.164.
Country defaults to Israel; invalid lengths/country combinations are rejected.
Email is optional and checked for syntax, common typos and mail-domain DNS.
Privacy consent is required and is included in the notification message.

Requests use the authenticated frontend/backend connection, same-origin form
checks, an 8 KB body limit, a honeypot and server-side validation. The business
recipient is configured by the server, never supplied by the visitor.
No contact details, mail credentials or raw SMTP errors are logged.

The privacy page describes email handling in Gmail and temporary in-memory
abuse protection. Legacy callback migrations remain in database history;
their tables/functions are no longer used by the application. Existing records
are not deleted automatically.

## Configuration and verification

See [Gmail setup](callback-email-setup.md) for the backend-only App Password.
Deploy both applications from main after a code change. Adding or changing
the Gmail secret requires redeploying the backend.

Run from the repository root:

~~~powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run check:vercel
npm.cmd run test:callback:browser
~~~

Unit tests use mocked SMTP and prove successful sending with the CMS unavailable,
authentication/validation, SMTP failures, duplicate suppression and rate limits.
Production integration tests deliberately clear Gmail credentials and verify
visible failure without callback SQL calls. Browser tests use a test-only
in-memory mail transport for successful JavaScript and native form submissions;
they do not send real email or save inquiry files.
