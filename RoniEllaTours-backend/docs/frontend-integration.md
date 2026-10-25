# Later frontend connection (no frontend changes made)

Inspected `src/components/forms/{ContactForm,InterestForm,RegistrationForm}.jsx`, `src/services/forms.js`, content modules, Hebrew/English page catalogs, both API handlers and architecture/language/review documentation in `RoniEllaTours-web`. No applicable AGENTS.md was found in this folder, its ancestors or the frontend tree. The frontend is currently intentionally disabled and validates locally; preserve that state until the following work is authorized.

## Mapping the existing forms

| Form | New payload |
|---|---|
| Contact | `type: contact`, `fullName → name`, phone/email/message, privacy consent |
| Interest | `type: tour-interest`, join firstName/lastName into name; `destination → destinationId` (`china`, `uzbekistan`, `greece`), phone/email, privacy consent |
| Registration | `type: registration`, simple name and contact inputs, canonical `tourId` from the tour slug (not translated tourTitle), privacy and enquiry-only consent |

Registration currently collects `idNumber`, `passport`, gender, room type, food preference and notes, and its consent says the form sends nothing. **Redesign that form before connecting it.** Remove sensitive/detail collection, replace the consent with accurate privacy and enquiry-only acknowledgements and obtain those explicitly. Do not merely relabel the existing consent or spread its object into a request. Do not forward old notes automatically. Basic first/last names can be joined and mobile mapped to phone after the simplified form is adopted. Add a visible instruction not to enter passports, identity, payment or medical information in messages.

Use explicit field mapping in `src/services/forms.js`. Add current locale and a public pathname without query strings as source. Continue local validation for usability, but regard server validation as authoritative. Destination/tour IDs are stable identifiers; labels can change language.

## Request lifecycle

Later configure a public backend base URL (for example `VITE_BACKEND_URL`); this is not a credential. A separate Vercel project means an absolute backend URL unless a deliberate same-origin proxy is added. Configure the actual frontend origin in backend `ALLOWED_ORIGINS`. Even same-origin browser POSTs may carry Origin, so include the website origin. Keep existing `/api/google-reviews` and `/api/translate` routing untouched.

1. Build the allowlisted payload and generate `crypto.randomUUID()` for a new logical enquiry. Keep it through retries; do not regenerate it on network failure. Do not put personal data in browser logs or durable local storage.
2. Add a Turnstile widget with public site key and action `lead`; send its token as `turnstileToken`. Keep hidden honeypot `website` empty and inaccessible to keyboard/screen readers. Configure approved frontend domains in Turnstile and `TURNSTILE_HOSTNAMES`.
3. POST JSON with `Idempotency-Key`. Disable duplicate submit clicks while pending. On each retry obtain a fresh Turnstile token but preserve the original enquiry and key. Editing enquiry content starts a new logical submission; never automatically do that after an ambiguous timeout.
4. Only `202` with `status === 'email_accepted'` may show “Your enquiry was accepted by our email service; delivery and booking are not confirmed.” `200 local_simulation` must show the explicit development notice, never the production success UI.
5. For validation errors retain input and display the error. For 429 honor `Retry-After`. For 502/network timeout preserve input/key and explain uncertainty; bounded retries within 24 hours may be offered. For 409 stop automatic retries: content mismatch needs correction; concurrent retries may be retried after a short pause with identical data. For 503 explain unavailability and offer the existing phone/email contact options. Never pretend a failure was submitted.
6. Handle JSON and non-JSON errors. Surface the request ID for support without logging input. Clearing the form should follow acceptance only, never an unavailable response. Update the existing FormNotice, submit labels and Hebrew/English messages together.

```js
// Future service-layer example, not installed in the frontend.
const response = await fetch(`${backendUrl}/api/v1/leads`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': enquiryKey },
  body: JSON.stringify(payload),
});
const data = await response.json().catch(() => null);
const accepted = response.status === 202 && data?.status === 'email_accepted';
// Render acceptance, simulation or error explicitly; response.ok alone is insufficient.
```

## Existing Google integrations

`api/google-reviews.js` is a read-only Business Profile adapter using server OAuth credentials, pagination and normalized ratings. Missing config returns 503; errors are sanitized. It is intentionally inactive. `api/translate.js` uses Cloud Translation v2 on allowlisted public English catalogs, validates placeholders, batches requests and has a bounded 24-hour process cache and concurrency guard. No visitor form data is translated. Vite registers these handlers locally; Vercel also bundles English catalogs.

This backend reuses the useful conventions of injectable fetch, server-only configuration, timeouts, no-store responses and sanitized errors. It does not duplicate or activate either integration. The translation memory cache is an optimization, not distributed protection or storage.

A later migration should move one handler at a time with tests preserving the existing response contracts, locale bundling, attribution, fallback notices and pagination. Update service URLs or add an explicit proxy, then retire the old endpoint so there is one owner. Preserve Google's access approval requirements and secret handling. Add shared quotas/cache where needed; do not migrate a process counter as a distributed guarantee. That migration requires separate authorization and no Google connection is activated here.
