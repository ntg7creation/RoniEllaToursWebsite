# Google reviews infrastructure

The Google account connection is deliberately inactive at the owner's request.
There are no copied reviews, hardcoded ratings/counts, WordPress dependencies,
Trustindex dependencies, or public demo reviews. The page links to the exact
Google listing provided by the owner until the direct connection is enabled.

## How it works

- `api/google-reviews.js` is a read-only server endpoint. It refreshes the owner's
  OAuth access token server-side and calls Google Business Profile's review list.
- Google returns up to 50 reviews per page, ordered by most recently updated.
  The UI supports additional pages; it is not limited to Places API's five reviews.
- The page fetches on entry, every five minutes while visible, and when returning
  to the tab. It renders Google's original text, author, date and individual stars.
  Ratings/counts come from the response. No positive-rating filter is applied.
- Long reviews expand inline. Failed background refreshes retain the last loaded
  content with a notice. No review data is persisted or stored in a CDN cache.
- Local Vite development and preview register the same handler as the serverless
  endpoint. Restart Vite after changing server configuration. Vercel must serve
  `/api/google-reviews` as a function, not rewrite it to the SPA.
- Other recommendations are independent records in `src/content/reviews.js`:
  `type: 'video'` (portrait/landscape YouTube or hosted clips), or `type: 'written'`
  with approved text. The empty catalog does not reuse general company videos.

## Activation later — not part of the current design pass

1. Obtain Google Business Profile API access for a Google Cloud project. Google
   may require an access application; owning a listing alone is not API approval.
2. Authorize the account managing this verified business with Google's
   `https://www.googleapis.com/auth/business.manage` scope and offline access.
   This is business-owner setup, not a visitor login on the website.
3. Identify the correct `accounts/.../locations/...` resource through Google's
   account/location APIs. The hexadecimal CID in the public search URL is not
   interchangeable with this authenticated resource identifier.
4. Put the four values from `.env.example` into `.env.local` for local development
   or the server's protected environment settings. Never use the `VITE_` prefix.
   Never send tokens in chat or commit them. No credentials have been created here.
5. Verify the returned business is the supplied listing, all current reviews are
   displayed, pagination works, and an actual Google update appears on refresh.
   Mocked tests verify application behavior only, not account authorization or
   how soon Google makes a new review available through its API.

The endpoint must run on a server/serverless host. Uploading only `dist/` to a
static file host will not enable it. No deployment was performed.

## Verification

`node --test scripts/google-reviews.test.mjs` tests read-only behavior, missing
configuration, pagination, preserved text, and safe upstream failures with mocked
Google responses. `node scripts/verify-reviews.mjs` checks responsive layout and
feed interactions using isolated network fixtures, never shipped to visitors.

References:
- https://developers.google.com/my-business/content/review-data
- https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
- https://developers.google.com/my-business/content/prereqs
