# RoniElla Tours starter backend

Node.js 24 LTS + strict TypeScript. Independent sibling of `RoniEllaTours-web`; the React/JavaScript/Vite frontend is unchanged. No database, lead storage, CRM, admin endpoints or Google connections are added.

An enquiry sends one plain-text email to a fixed server-configured inbox. Registration means **enquiry only**, never a booking. `202 email_accepted` means Resend accepted the request; it does **not** confirm delivery, persistence or booking. Failures are never converted to success. Everything is awaited within the request.

## Local setup

Install Node 24 (see `.nvmrc`; with nvm, `nvm install 24` then `nvm use 24`). From the parent folder:

```powershell
cd RoniEllaTours-backend
npm ci
Copy-Item .env.example .env
npm run config:check
npm run dev
```

On macOS/Linux use `cp .env.example .env`. Local server binds to `127.0.0.1:3001`. The example explicitly enables local simulation and disables external abuse services. It requires no real credentials, logs no enquiries and stores nothing. Responses say `local_simulation`, never `email_accepted`. Simulation is prohibited whenever `NODE_ENV=production` **or** `VERCEL` is set, including previews. Omitted `NODE_ENV` defaults to production.

```sh
npm run typecheck
npm test
npm run build
npm run smoke
npm start
```

`npm start` runs the compiled local server and loads `.env`. `smoke` launches the built server on an ephemeral loopback port, exercises health and simulation and stops it. Tests mock every external service and require no credentials. Do not run a real submission during setup. `config:check` validates configuration without making external calls; errors name settings, never their secret values.

## Structure

- `api/health.ts`, `api/v1/leads.ts`: thin Vercel Node Functions.
- `src/http.ts`: shared HTTP boundary, bounded JSON, CORS, errors and request IDs.
- `src/validation.ts`: strict runtime schemas and inferred enquiry types.
- `src/enquiries.ts`: business logic and minimal transient enquiry model.
- `src/email.ts`: replaceable `EmailProvider`, Resend and explicit local simulation.
- `src/abuse.ts`: Turnstile and atomic shared Redis throttling.
- `src/config.ts`, `src/server.ts`: configuration and portable local Node entrypoint.

## API

`GET /api/health` → `200 {"status":"ok","service":"roniella-tours-backend","requestId":"..."}`. This is liveness, not an external-service readiness check. Invalid configuration can return 503. No credentials or dependency status are exposed.

`POST /api/v1/leads` requires `Content-Type: application/json` and a fresh UUID `Idempotency-Key` per logical enquiry. Maximum body: 16 KiB UTF-8, including already-parsed Vercel bodies. Unknown fields are rejected, including nested unknown fields. Compressed request bodies are unsupported.

```sh
curl http://127.0.0.1:3001/api/v1/leads \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 643a66dc-0fc3-4c05-9e36-f3bb143504d2' \
  --data '{"type":"contact","name":"Example Visitor","email":"visitor@example.com","phone":"+972501234567","message":"Please tell me about your tours.","consent":{"privacy":true},"source":{"page":"/contact","locale":"en"},"website":""}'
```

This is a shell example for bash; in PowerShell use `Invoke-RestMethod` with the same headers and JSON body, or `curl.exe` with appropriate quoting. Run only against the local simulation unless deliberately authorizing a real email later.

| Field | Contract |
|---|---|
| `type` | `contact`, `tour-interest`, `registration` |
| `name` | Required trimmed 1–120 characters, no control characters |
| `email` | Required valid email, ≤254 characters; used only as Reply-To |
| `phone` | Required 7–30 characters; digits, spaces, parentheses, hyphens, optional leading `+` |
| `destinationId`, `tourId` | Optional lowercase alphanumeric hyphenated identifiers, ≤100 characters; interest requires either, registration requires tourId |
| `message` | Optional, defaults to empty; ≤2000 characters; no unsafe controls |
| `consent` | `{ "privacy": true }`; registration additionally requires `"enquiryOnly": true`; no marketing consent implied |
| `source` | Required `{ "page": "/contact", "locale": "he" }`; path ≤200, no query strings; locale `he`, `en`, or `ru` |
| `website` | Optional honeypot, must remain empty |
| `turnstileToken` | Required in managed mode; maximum 2048 characters |

Identifiers are syntax-validated, not checked against a duplicated tour catalog. Source and consent are visitor assertions, not verified identity or proof of consent. Model adds server-generated `id` and ISO `createdAt`; the ID derives from the idempotency UUID and is stable across retries. Without persistence, `createdAt` is this attempt's creation time, not a durable first-submission timestamp. It is deliberately omitted from the email payload and response to keep retries stable. The model exists only during the request.

Example production acceptance (only after the provider responds successfully with an email ID):

```json
{
  "status": "email_accepted",
  "enquiryId": "enq_<sha256>",
  "stored": false,
  "bookingConfirmed": false,
  "message": "Email provider accepted the enquiry. Delivery is not confirmed; no lead was saved and no booking was made.",
  "requestId": "<server-generated UUID>"
}
```

Local mode returns HTTP 200 with `status: "local_simulation"` and an explicit no-email/no-storage message. It is a development result, not submission success.

Errors always use `{ "error": { "code": "EMAIL_UNCONFIGURED", "message": "Email service is not configured." }, "requestId": "..." }`. Every application response has `X-Request-Id`, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Request IDs are generated by the server, never trusted from callers. OPTIONS returns empty 204 with the ID header.

| Status | Meaning |
|---|---|
| 400 | Malformed JSON or missing/invalid UUID idempotency key |
| 403 | Origin not allowed |
| 404 / 405 | Unknown endpoint / unsupported method (`Allow` supplied) |
| 409 | Resend idempotency conflict, including possible concurrent retry |
| 413 / 415 | Oversized body / unsupported media type or encoding |
| 422 | Invalid fields, honeypot hit, missing/rejected challenge |
| 429 | Shared throttle exceeded (`Retry-After` seconds) |
| 502 | Provider failure, timeout or invalid acceptance receipt; acceptance uncertain |
| 503 | Missing settings, abuse dependency failure, or unavailable processing |

Platform-generated errors (for example Vercel's own body limit or timeout) can occur before this handler and need not match this envelope. The frontend must tolerate non-JSON failures.

## Server configuration

Never prefix secrets with `VITE_`. `.env.example` contains no credentials. Do not commit `.env` or `.vercel`.

| Setting | Purpose / default |
|---|---|
| `NODE_ENV` | `production` by default; explicit `development` for local mode |
| `EMAIL_PROVIDER` | `resend` default; `local` only on local development/test |
| `EMAIL_FROM` | One bare address on a Resend-verified sender domain |
| `EMAIL_TO` | One fixed internal recipient; no browser override |
| `RESEND_API_KEY` | Server-only sending key |
| `ALLOWED_ORIGINS` | Comma-separated exact origins, no paths/trailing slashes/wildcards; empty denies requests containing Origin |
| `ABUSE_MODE` | `managed` default; `disabled` only local development/test |
| `TURNSTILE_SECRET_KEY` | Cloudflare server-side verification secret |
| `TURNSTILE_HOSTNAMES` | Comma-separated allowed frontend hostnames, without scheme/port; required in managed mode |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared Redis HTTPS endpoint and token allowing EVAL, INCR, EXPIRE, TTL |
| `RATE_HASH_SECRET` | Random ≥32-character server secret for HMAC email bucket keys |
| `RATE_NAMESPACE` | `roniella` default; distinct per environment, shared across its instances |
| `RATE_WINDOW_SECONDS` | 600; 1–86400 |
| `RATE_GLOBAL_LIMIT` | 100 attempts/window; 1–100000 |
| `RATE_EMAIL_LIMIT` | 5 attempts/address/window; 1–10000 |
| `PORT` | Local server port, 3001 default |

Production requires externally configured Resend, Turnstile and shared Upstash Redis; none is provisioned by this repository. Missing services prevent submissions. Health can still be live when services are unconfigured. Review quotas, hosting firewall limits, sender verification and monitoring before making the endpoint public.

### Abuse and privacy limitations

Global throttling happens before body parsing; valid enquiries also consume an HMAC email bucket. Each increment and expiration is one atomic Redis Lua operation, shared across cold starts/instances. Only counters and pseudonymous keys are stored, with expiration; Redis is not a lead database. Failed submissions and retries also consume quota. Redis failure rejects submissions, never falls back to memory. No untrusted IP headers are used. Limits are global and per email, **not per visitor**: attackers can rotate addresses or exhaust the global budget, denying legitimate submissions. Add host-level firewall/IP rate limits with correctly trusted proxy configuration for volumetric attacks. Fixed windows can burst near their boundary. Redis calls themselves have a cost.

Turnstile verification requires success, an allowed hostname and action `lead`. Use domain restrictions on the widget and real production keys. Tokens are short-lived and single use: obtain a fresh token on each HTTP retry, retaining the same enquiry and idempotency key. Honeypot hits return an honest rejection. CORS is only a browser policy; callers without Origin still require all managed protection. It is neither authentication nor spam protection.

Only allowlisted enquiry fields are accepted. Passport, ID, demographic, dietary/medical and other registration-specific fields are rejected. Free text cannot reliably be classified: callers must be instructed not to enter sensitive information in names/messages; this starter cannot guarantee detection of sensitive information pasted into otherwise permitted text. Never forward the old registration object. Emails necessarily contain basic contact information; restrict inbox access and set retention policies. Application code logs neither personal data nor bodies, secrets or raw upstream errors. Configure hosting/APM/provider logging and retention accordingly.

### Retry / idempotency contract

Resend receives `Idempotency-Key: enquiry-v1/<UUID>` and a deterministic email payload. [Resend retains keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). A timeout may follow acceptance, so retry the **same key and unchanged enquiry** within that window. Changed content under the same key is rejected by Resend; a genuinely new enquiry needs a new key. Turnstile/honeypot metadata and server attempt timestamps are excluded from the email. Do not change fixed sender, recipient or email template during an in-flight retry window: they affect payload equality. The template namespace is fixed to `enquiry-v1`.

There is no local idempotency store or exactly-once guarantee. A new key or a retry after expiration can send another email. A replay still passes abuse controls. Provider acceptance and response bodies are not persisted here. If uncertainty remains beyond 24 hours, contact the office rather than blindly resending. A provider replacement must deliberately implement comparable idempotency or add durable server-side deduplication first. Local simulation does not exercise provider deduplication.

## Vercel deployment instructions (not performed)

1. Create a **separate** Vercel project with Root Directory `RoniEllaTours-backend` if the parent is the repository root, or `.` if this folder is its own repository. Do not point the frontend project at it.
2. Select Framework Preset **Other**, Node.js **24.x**, install `npm ci`, build `npm run build`. Do not set a static output directory to `dist`: Vercel must discover and compile `api/**/*.ts` as Node Functions. `dist` is for portable local hosting.
3. Set server environment variables above in the intended environment. Use `NODE_ENV=production`, `EMAIL_PROVIDER=resend`, `ABUSE_MODE=managed` for previews too; no mock fallback is allowed on Vercel. Set exact frontend origins, including explicit authorized preview origins if needed. Use separate Redis namespaces/secrets for preview and production.
4. Function files expose `/api/health` and `/api/v1/leads`; no SPA rewrite is needed. `vercel.json` sets a 30-second maximum; dependency timeouts total at most roughly 19 seconds (two Redis checks, challenge, email), leaving handler overhead. No background worker is required.
5. After an explicitly authorized deployment, check health and configuration. Coordinate any real-email end-to-end test separately. Do not activate the frontend until its integration and consent copy are ready.

The Node HTTP handler is shared by local hosting and Vercel; external services use standard fetch APIs. Another host can call `createHandler` from its Node server (configure binding/proxy/timeouts there). [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js), [supported versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Node LTS schedule](https://github.com/nodejs/Release), [Upstash REST API](https://upstash.com/docs/redis/features/restapi), [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

See [frontend integration](docs/frontend-integration.md) and [future roadmap](docs/roadmap.md). Local and mocked verification cannot establish real deliverability, Redis availability, Turnstile configuration or a successful Vercel deployment.
